"""코스피/코스닥/미국 전체 종목 스캔 — 스퀴즈 단계 높은 순 Top N 추출."""

import asyncio
from dataclasses import dataclass

import pandas as pd
import yfinance as yf
from loguru import logger

import numpy as np

from indicators.bollinger import calculate_bb, detect_squeeze
from indicators.ema import calculate_ema
from indicators.macd import calculate_macd
from indicators.rsi import calculate_rsi
from indicators.volume import calculate_volume_ratio

SCAN_MIN_CANDLES = 60

# ── 인덱스별 종목 분류 ────────────────────────────────────────
# NASDAQ 100 (QQQ) 구성 종목
_NASDAQ100_SYMBOLS: set[str] = {
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "TSLA", "AVGO", "COST", "GOOGL", "NFLX",
    "AMD", "ADBE", "QCOM", "TXN", "INTU", "CSCO", "AMGN", "AMAT", "SBUX", "ISRG",
    "MU", "LRCX", "REGN", "VRTX", "PANW", "GILD", "ADI", "KLAC", "CRWD", "SNPS",
    "CDNS", "MRVL", "MCHP", "PAYX", "DDOG", "NXPI", "WDAY", "ON", "DXCM", "BIIB",
    "ILMN", "ABNB", "ANSS", "INTC", "MNST", "ZS", "PYPL", "ARM", "ADP", "BKNG",
    "SMCI", "PLTR", "COIN", "NET", "SOFI", "EA", "TTWO", "SWKS", "QRVO", "TER",
    "ENTG", "ACLS", "GTLB", "ZM", "OKTA",
}


@dataclass
class ScanResult:
    symbol: str
    name: str
    market_type: str
    price: float
    change_pct: float
    rsi: float
    bb_pct_b: float
    bb_width: float
    squeeze_level: int
    macd_hist: float
    volume_ratio: float
    confidence: float
    trend: str = "NEUTRAL"  # BULL / BEAR / NEUTRAL


def _check_trend(df: pd.DataFrame, ema: dict) -> str:
    """
    EMA 정배열 기반 추세 판정.
    상승추세 (BULL) 조건:
      1. EMA 20 > EMA 50 > EMA 200 (정배열)
      2. 현재가 > EMA 20 (단기 이평선 위)
      3. EMA 20 최근 5일 기울기 양수 (상승 중)
    """
    e20 = ema.get("ema_20")
    e50 = ema.get("ema_50")
    e200 = ema.get("ema_200")
    if e20 is None or e50 is None or e200 is None:
        return "NEUTRAL"
    if len(e20.dropna()) < 10 or len(e50.dropna()) < 10 or len(e200.dropna()) < 10:
        return "NEUTRAL"

    price = float(df["close"].iloc[-1])
    last_e20 = float(e20.iloc[-1])
    last_e50 = float(e50.iloc[-1])
    last_e200 = float(e200.iloc[-1])

    # EMA 20 기울기 (최근 5일)
    e20_recent = e20.dropna().tail(5)
    e20_slope = (float(e20_recent.iloc[-1]) - float(e20_recent.iloc[0])) if len(e20_recent) >= 5 else 0

    # 정배열 + 가격 위 + 기울기 양수 → BULL
    if last_e20 > last_e50 > last_e200 and price > last_e20 and e20_slope > 0:
        return "BULL"

    # 역배열 → BEAR
    if last_e20 < last_e50 < last_e200 and price < last_e20:
        return "BEAR"

    return "NEUTRAL"


async def scan_market(market_type: str, top_n: int = 3, min_squeeze: int = 1, trend_only: bool = True) -> list[ScanResult]:
    logger.info(f"[{market_type}] 스캔 시작")

    if market_type in ("KOSPI", "KOSDAQ"):
        symbols = _get_kr_stocks(market_type)
        suffix = ".KS" if market_type == "KOSPI" else ".KQ"
        tickers = [f"{s}{suffix}" for s in symbols.keys()]
    elif market_type == "US":
        symbols = {**_get_us_stocks(), **_get_us_etfs()}
        tickers = list(symbols.keys())
    else:
        return []

    logger.info(f"[{market_type}] {len(tickers)}개 다운로드 중...")
    df_all = await asyncio.to_thread(_batch_download, tickers)
    if df_all is None or df_all.empty:
        logger.warning(f"[{market_type}] 다운로드 실패")
        return []

    results: list[ScanResult] = []
    for ticker in tickers:
        try:
            df = _extract_ticker(df_all, ticker)
            if df is None or len(df) < SCAN_MIN_CANDLES:
                continue

            bb = calculate_bb(df)
            squeeze = detect_squeeze(df)
            rsi = calculate_rsi(df)
            macd = calculate_macd(df)
            vol = calculate_volume_ratio(df)
            ema = calculate_ema(df)

            last_sq = int(squeeze.iloc[-1]) if not pd.isna(squeeze.iloc[-1]) else 0
            if last_sq < min_squeeze:  # min_squeeze 이상만 포함
                continue

            # 추세 판정
            trend = _check_trend(df, ema)
            if trend_only and trend != "BULL":
                continue

            last_rsi = float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50
            last_pctb = float(bb["pct_b"].iloc[-1]) if bb.get("pct_b") is not None and not pd.isna(bb["pct_b"].iloc[-1]) else 0.5
            last_bbw = float(bb["width"].iloc[-1]) if bb.get("width") is not None and not pd.isna(bb["width"].iloc[-1]) else 0
            last_macd = float(macd["histogram"].iloc[-1]) if macd.get("histogram") is not None and not pd.isna(macd["histogram"].iloc[-1]) else 0
            last_vol = float(vol.iloc[-1]) if not pd.isna(vol.iloc[-1]) else 1.0
            price = float(df["close"].iloc[-1])
            prev_price = float(df["close"].iloc[-2]) if len(df) >= 2 else price
            change = ((price - prev_price) / prev_price * 100) if prev_price != 0 else 0

            score = last_sq * 25
            if trend == "BULL": score += 15
            if last_rsi < 40: score += 10
            if last_pctb < 0.3: score += 5
            if last_macd > 0: score += 5
            if last_vol > 1.0: score += 5

            if market_type in ("KOSPI", "KOSDAQ"):
                sym = ticker.replace(".KS", "").replace(".KQ", "")
                name = symbols.get(sym, sym)
            else:
                sym = ticker
                name = symbols.get(ticker, ticker)

            results.append(ScanResult(
                symbol=sym, name=name, market_type=market_type,
                price=price, change_pct=round(change, 2),
                rsi=round(last_rsi, 1), bb_pct_b=round(last_pctb, 4),
                bb_width=round(last_bbw, 4), squeeze_level=last_sq,
                macd_hist=round(last_macd, 4), volume_ratio=round(last_vol, 1),
                confidence=round(score, 1), trend=trend,
            ))
        except Exception:
            continue

    results.sort(key=lambda r: (r.squeeze_level, r.confidence), reverse=True)
    top = results[:top_n]
    trend_label = " (상승추세만)" if trend_only else ""
    logger.info(f"[{market_type}] 완료{trend_label}: {len(results)}개 중 Top {len(top)}")
    return top


def _get_kr_stocks(market_type: str) -> dict[str, str]:
    """한국 주요 종목."""
    kospi = {
        "005930": "삼성전자", "000660": "SK하이닉스", "005380": "현대차",
        "000270": "기아", "068270": "셀트리온", "035420": "NAVER",
        "005490": "POSCO홀딩스", "012330": "현대모비스", "055550": "신한지주",
        "105560": "KB금융", "003670": "포스코퓨처엠", "006400": "삼성SDI",
        "051910": "LG화학", "066570": "LG전자", "003550": "LG",
        "032830": "삼성생명", "086790": "하나금융지주", "034730": "SK",
        "015760": "한국전력", "010140": "삼성중공업", "012450": "한화에어로스페이스",
        "009150": "삼성전기", "028260": "삼성물산", "018260": "삼성SDS",
        "033780": "KT&G", "096770": "SK이노베이션", "017670": "SK텔레콤",
        "030200": "KT", "036570": "엔씨소프트", "011200": "HMM",
        "034020": "두산에너빌리티", "009540": "HD한국조선해양", "042660": "한화오션",
        "329180": "HD현대중공업", "267260": "HD현대", "000810": "삼성화재",
        "316140": "우리금융지주", "003490": "대한항공", "047050": "포스코인터내셔널",
        "010950": "S-Oil", "035720": "카카오", "259960": "크래프톤",
        "352820": "하이브", "004020": "현대제철", "021240": "코웨이",
        "090430": "아모레퍼시픽", "051900": "LG생활건강", "010130": "고려아연",
        "011170": "롯데케미칼", "003230": "삼양식품", "078930": "GS",
        "004170": "신세계", "069620": "대웅제약", "097950": "CJ제일제당",
    }
    kosdaq = {
        "247540": "에코프로비엠", "086520": "에코프로", "403870": "HPSP",
        "196170": "알테오젠", "041510": "에스엠", "293490": "카카오게임즈",
        "112040": "위메이드", "263750": "펄어비스", "035900": "JYP Ent.",
        "145020": "휴젤", "068760": "셀트리온제약", "383220": "F&F",
        "328130": "루닛", "039030": "이오테크닉스", "058470": "리노공업",
        "257720": "실리콘투", "095340": "ISC", "036930": "주성엔지니어링",
        "240810": "원익IPS", "357780": "솔브레인", "078340": "컴투스",
        "067630": "에이치엘비", "214150": "클래시스", "060310": "3S",
        "090460": "비에이치", "131970": "테스나", "322510": "제이앤티씨",
        "064760": "티씨케이", "089030": "테크윙", "099190": "아이센스",
    }
    return kospi if market_type == "KOSPI" else kosdaq


def _get_us_stocks() -> dict[str, str]:
    return {
        # ── 대형 기술주 ──
        "AAPL": "Apple", "MSFT": "Microsoft", "GOOGL": "Alphabet", "AMZN": "Amazon",
        "NVDA": "NVIDIA", "META": "Meta", "TSLA": "Tesla", "AVGO": "Broadcom",
        "CRM": "Salesforce", "CSCO": "Cisco", "ADBE": "Adobe", "AMD": "AMD",
        "NFLX": "Netflix", "INTC": "Intel", "IBM": "IBM", "ORCL": "Oracle",
        "NOW": "ServiceNow", "PANW": "Palo Alto", "CRWD": "CrowdStrike",
        "PLTR": "Palantir", "NET": "Cloudflare", "SNOW": "Snowflake",
        "ARM": "Arm", "SMCI": "Super Micro", "MU": "Micron", "MRVL": "Marvell",
        "SHOP": "Shopify", "SQ": "Block", "COIN": "Coinbase", "UBER": "Uber",
        "ABNB": "Airbnb", "PYPL": "PayPal", "SOFI": "SoFi",
        # ── 추가 기술/소프트웨어 ──
        "INTU": "Intuit", "WDAY": "Workday", "VEEV": "Veeva", "DDOG": "Datadog",
        "ZS": "Zscaler", "OKTA": "Okta", "HUBS": "HubSpot", "ZM": "Zoom",
        "TWLO": "Twilio", "DOCN": "DigitalOcean", "RBLX": "Roblox",
        "EA": "Electronic Arts", "TTWO": "Take-Two Interactive", "U": "Unity",
        "ADP": "Automatic Data Processing", "PAYX": "Paychex", "PAYC": "Paycom",
        "CDNS": "Cadence Design", "SNPS": "Synopsys", "ANSS": "ANSYS",
        "DELL": "Dell Technologies", "HPQ": "HP Inc", "HPE": "HP Enterprise",
        "WDC": "Western Digital", "STX": "Seagate", "NTAP": "NetApp",
        "ESTC": "Elastic", "GTLB": "GitLab", "DXCM": "DexCom",
        # ── 반도체 ──
        "TXN": "Texas Inst", "QCOM": "Qualcomm", "LRCX": "Lam Research",
        "AMAT": "Applied Materials", "KLAC": "KLA", "ON": "ON Semi",
        "ADI": "Analog Devices", "MPWR": "Monolithic Power",
        "NXPI": "NXP Semiconductors", "MCHP": "Microchip Technology",
        "SWKS": "Skyworks", "QRVO": "Qorvo", "TER": "Teradyne",
        "ENTG": "Entegris", "WOLF": "Wolfspeed", "ACLS": "Axcelis",
        # ── 금융 ──
        "JPM": "JPMorgan", "V": "Visa", "MA": "Mastercard", "GS": "Goldman",
        "BAC": "Bank of America", "WFC": "Wells Fargo", "MS": "Morgan Stanley",
        "C": "Citigroup", "BLK": "BlackRock", "SCHW": "Schwab",
        "AXP": "AmEx", "BX": "Blackstone", "KKR": "KKR",
        "SPGI": "S&P Global", "MCO": "Moody's", "ICE": "Intercontinental Exchange",
        "CME": "CME Group", "NDAQ": "Nasdaq Inc",
        "PGR": "Progressive", "AFL": "Aflac", "MET": "MetLife", "PRU": "Prudential",
        "USB": "US Bancorp", "PNC": "PNC Financial", "TFC": "Truist",
        "COF": "Capital One", "DFS": "Discover Financial",
        "FIS": "Fidelity Natl Info", "FISV": "Fiserv", "GPN": "Global Payments",
        "APO": "Apollo Global", "ARES": "Ares Management",
        # ── 헬스케어 ──
        "UNH": "UnitedHealth", "LLY": "Eli Lilly", "MRK": "Merck",
        "ABBV": "AbbVie", "PFE": "Pfizer", "MRNA": "Moderna",
        "JNJ": "Johnson&Johnson", "TMO": "Thermo Fisher", "ABT": "Abbott",
        "AMGN": "Amgen", "GILD": "Gilead", "ISRG": "Intuitive Surgical",
        "VRTX": "Vertex", "REGN": "Regeneron", "MDT": "Medtronic",
        "BMY": "Bristol-Myers Squibb", "ELV": "Elevance Health",
        "CVS": "CVS Health", "CI": "Cigna", "HUM": "Humana", "CNC": "Centene",
        "SYK": "Stryker", "BSX": "Boston Scientific", "EW": "Edwards Lifesciences",
        "BIIB": "Biogen", "ILMN": "Illumina", "ALNY": "Alnylam",
        "IQV": "IQVIA", "A": "Agilent", "MCK": "McKesson", "CAH": "Cardinal Health",
        # ── 소비재 (임의) ──
        "KO": "Coca-Cola", "PEP": "PepsiCo", "PG": "P&G", "COST": "Costco",
        "WMT": "Walmart", "HD": "Home Depot", "MCD": "McDonald's",
        "NKE": "Nike", "SBUX": "Starbucks", "TGT": "Target",
        "LOW": "Lowe's", "TJX": "TJX", "DIS": "Disney",
        "BKNG": "Booking Holdings", "EXPE": "Expedia", "ABNB": "Airbnb",
        "MAR": "Marriott", "HLT": "Hilton", "H": "Hyatt",
        "RCL": "Royal Caribbean", "CCL": "Carnival",
        "MGM": "MGM Resorts", "WYNN": "Wynn Resorts", "LVS": "Las Vegas Sands",
        "CMG": "Chipotle", "YUM": "Yum Brands", "DPZ": "Domino's",
        "ROST": "Ross Stores", "ULTA": "Ulta Beauty", "BBY": "Best Buy",
        "LYFT": "Lyft", "DASH": "DoorDash",
        # ── 소비재 (필수) ──
        "PM": "Philip Morris", "MO": "Altria", "CL": "Colgate-Palmolive",
        "MDLZ": "Mondelez", "KHC": "Kraft Heinz", "GIS": "General Mills",
        "MNST": "Monster Beverage", "STZ": "Constellation Brands", "KR": "Kroger",
        # ── 산업재 ──
        "CAT": "Caterpillar", "BA": "Boeing", "GE": "GE", "HON": "Honeywell",
        "UPS": "UPS", "RTX": "RTX", "DE": "Deere", "LMT": "Lockheed Martin",
        "MMM": "3M", "UNP": "Union Pacific",
        "FDX": "FedEx", "NSC": "Norfolk Southern", "CSX": "CSX",
        "ETN": "Eaton", "EMR": "Emerson Electric", "ITW": "Illinois Tool Works",
        "PH": "Parker Hannifin", "ROK": "Rockwell Automation",
        "LHX": "L3Harris", "NOC": "Northrop Grumman", "GD": "General Dynamics",
        "WM": "Waste Management", "RSG": "Republic Services",
        "CARR": "Carrier Global", "OTIS": "Otis Worldwide",
        # ── 에너지 ──
        "XOM": "Exxon", "CVX": "Chevron", "COP": "ConocoPhillips",
        "SLB": "Schlumberger", "EOG": "EOG Resources",
        "OXY": "Occidental Petroleum", "DVN": "Devon Energy",
        "MPC": "Marathon Petroleum", "VLO": "Valero Energy", "PSX": "Phillips 66",
        "HAL": "Halliburton", "BKR": "Baker Hughes",
        "WMB": "Williams", "KMI": "Kinder Morgan", "OKE": "ONEOK",
        "LNG": "Cheniere Energy",
        # ── 통신/미디어/소셜 ──
        "T": "AT&T", "VZ": "Verizon", "TMUS": "T-Mobile", "CMCSA": "Comcast",
        "CHTR": "Charter Communications",
        "SNAP": "Snap", "PINS": "Pinterest", "SPOT": "Spotify", "RDDT": "Reddit",
        "MTCH": "Match Group",
        # ── 유틸리티/재생에너지 ──
        "NEE": "NextEra Energy", "AEP": "AEP", "D": "Dominion Energy",
        "SO": "Southern Company", "DUK": "Duke Energy",
        "ENPH": "Enphase", "FSLR": "First Solar", "PLUG": "Plug Power",
        "BE": "Bloom Energy",
        # ── 리츠 ──
        "O": "Realty Income", "AMT": "American Tower", "CCI": "Crown Castle",
        "EQIX": "Equinix", "DLR": "Digital Realty",
        "PSA": "Public Storage", "PLD": "Prologis",
        "SPG": "Simon Property", "VICI": "VICI Properties",
        # ── 전기차/모빌리티 ──
        "F": "Ford", "GM": "GM", "RIVN": "Rivian", "NIO": "NIO",
        "LCID": "Lucid Motors", "XPEV": "XPeng", "LI": "Li Auto",

        # ════════════════════════════════════════════════════
        # 확장 종목 (+600: S&P500 전체 + 국제 ADR + 성장주)
        # ════════════════════════════════════════════════════

        # ── NASDAQ 100 완성 (누락분) ──
        "ADSK": "Autodesk", "FAST": "Fastenal", "IDXX": "IDEXX Labs",
        "VRSK": "Verisk Analytics", "CPRT": "Copart", "ODFL": "Old Dominion Freight",
        "PCAR": "PACCAR", "FANG": "Diamondback Energy", "KDP": "Keurig Dr Pepper",
        "DLTR": "Dollar Tree", "CSGP": "CoStar Group", "SAIA": "Saia",
        "FTNT": "Fortinet", "LULU": "Lululemon", "GEHC": "GE Healthcare",
        "TSCO": "Tractor Supply", "EXPE": "Expedia",

        # ── S&P 500 소재(Materials) ──
        "LIN": "Linde", "APD": "Air Products", "SHW": "Sherwin-Williams",
        "ECL": "Ecolab", "NEM": "Newmont", "FCX": "Freeport-McMoRan",
        "CF": "CF Industries", "DOW": "Dow", "DD": "DuPont",
        "PPG": "PPG Industries", "CE": "Celanese", "EMN": "Eastman Chemical",
        "RPM": "RPM International", "BALL": "Ball Corp", "PKG": "Packaging Corp",
        "IP": "International Paper", "AVY": "Avery Dennison", "SEE": "Sealed Air",
        "ALB": "Albemarle", "FMC": "FMC Corp", "IFF": "Intl Flavors",
        "MOS": "Mosaic", "CTVA": "Corteva",

        # ── S&P 500 소비재-임의(Consumer Discretionary) 추가 ──
        "ORLY": "O'Reilly Auto", "AZO": "AutoZone", "TSCO": "Tractor Supply",
        "DHI": "D.R. Horton", "LEN": "Lennar", "PHM": "PulteGroup",
        "NVR": "NVR", "TOL": "Toll Brothers", "KMX": "CarMax",
        "AN": "AutoNation", "PAG": "Penske Auto",
        "ETSY": "Etsy", "W": "Wayfair", "CHWY": "Chewy",
        "DKNG": "DraftKings", "PENN": "PENN Entertainment",
        "LYV": "Live Nation", "PARA": "Paramount", "WBD": "Warner Bros Discovery",
        "QSR": "Restaurant Brands", "SHAK": "Shake Shack",
        "ONON": "On Holding", "DECK": "Deckers", "SKX": "Skechers",
        "PVH": "PVH Corp", "RL": "Ralph Lauren", "VFC": "VF Corp",
        "HBI": "Hanesbrands", "CPRI": "Capri Holdings",
        "NWSA": "News Corp", "FOX": "Fox Corp",

        # ── S&P 500 소비재-필수(Consumer Staples) 추가 ──
        "TSN": "Tyson Foods", "HRL": "Hormel", "K": "Kellanova",
        "CPB": "Campbell Soup", "MKC": "McCormick", "HSY": "Hershey",
        "CAG": "ConAgra", "SJM": "J.M. Smucker", "LW": "Lamb Weston",
        "WBA": "Walgreens Boots", "SFM": "Sprouts Farmers",
        "SYY": "Sysco", "PFGC": "Performance Food",
        "BJ": "BJ's Wholesale", "GO": "Grocery Outlet",
        "EL": "Estee Lauder", "KMB": "Kimberly-Clark", "CHD": "Church & Dwight",
        "CLX": "Clorox", "SCI": "Service Corp",

        # ── S&P 500 헬스케어 추가 ──
        "ZBH": "Zimmer Biomet", "BAX": "Baxter", "BDX": "Becton Dickinson",
        "STE": "Steris", "HOLX": "Hologic", "NTRA": "Natera",
        "EXAS": "Exact Sciences", "VEEV": "Veeva Systems",
        "INSP": "Inspire Medical", "PODD": "Insulet",
        "NBIX": "Neurocrine Bio", "EXEL": "Exelixis",
        "ITCI": "Intra-Cellular Therapies", "AXSM": "Axsome Therapeutics",
        "HALO": "Halozyme", "SRPT": "Sarepta Therapeutics",
        "RARE": "Ultragenyx", "PTCT": "PTC Therapeutics",
        "MOH": "Molina Healthcare", "HCA": "HCA Healthcare",
        "THC": "Tenet Healthcare", "UHS": "Universal Health Services",
        "HIMS": "Hims & Hers", "MTD": "Mettler-Toledo",
        "ICLR": "ICON", "MEDP": "Medpace",
        "TECH": "Bio-Techne", "ACAD": "Acadia Pharmaceuticals",
        "JAZZ": "Jazz Pharmaceuticals", "PRGO": "Perrigo",
        "MASI": "Masimo", "IRTC": "iRhythm Technologies",
        "TNDM": "Tandem Diabetes", "DXCM": "DexCom",

        # ── S&P 500 금융 추가 ──
        "AIG": "AIG", "CB": "Chubb", "HIG": "Hartford Financial",
        "CINF": "Cincinnati Financial", "GL": "Globe Life",
        "MKL": "Markel", "WRB": "W.R. Berkley",
        "ALLY": "Ally Financial", "OMF": "OneMain Financial",
        "HBAN": "Huntington Bancshares", "KEY": "KeyCorp",
        "MTB": "M&T Bank", "RF": "Regions Financial",
        "CFG": "Citizens Financial", "FITB": "Fifth Third Bancorp",
        "WBS": "Webster Financial", "PNFP": "Pinnacle Financial",
        "NTRS": "Northern Trust", "STT": "State Street",
        "MSCI": "MSCI", "BR": "Broadridge", "EFX": "Equifax",
        "TRU": "TransUnion", "AMP": "Ameriprise Financial",
        "BEN": "Franklin Resources", "IVZ": "Invesco",
        "TROW": "T. Rowe Price", "RJF": "Raymond James",
        "LNC": "Lincoln National", "UNM": "Unum Group",
        "WTW": "Willis Towers Watson", "AON": "Aon",
        "MMC": "Marsh & McLennan",
        "AFRM": "Affirm", "UPST": "Upstart", "HOOD": "Robinhood",
        "LC": "LendingClub", "SFM": "Sprouts Farmers",

        # ── 기술 추가 (엔터프라이즈/클라우드/SaaS) ──
        "ANET": "Arista Networks", "GDDY": "GoDaddy",
        "CTSH": "Cognizant", "EPAM": "EPAM Systems",
        "JNPR": "Juniper Networks", "FFIV": "F5",
        "VRSN": "VeriSign", "AKAM": "Akamai Technologies",
        "PTC": "PTC", "AZPN": "Aspen Technology",
        "BILL": "BILL Holdings", "PCTY": "Paylocity",
        "SMAR": "Smartsheet", "ASAN": "Asana", "DBX": "Dropbox",
        "ZI": "ZoomInfo", "BRZE": "Braze",
        "TTD": "The Trade Desk", "MGNI": "Magnite",
        "CGNX": "Cognex", "TDY": "Teledyne Technologies",
        "KLIC": "Kulicke & Soffa", "LSCC": "Lattice Semiconductor",
        "SITM": "SiTime", "FORM": "FormFactor",
        "ONTO": "Onto Innovation", "COHR": "Coherent",
        "MKSI": "MKS Instruments",

        # ── 산업재 추가 ──
        "EXPD": "Expeditors Intl", "CHRW": "CH Robinson",
        "JBHT": "JB Hunt Transport", "XPO": "XPO",
        "SAIA": "Saia", "WERN": "Werner Enterprises",
        "GWW": "W.W. Grainger", "SNA": "Snap-on",
        "SWK": "Stanley Black & Decker", "PNR": "Pentair",
        "IEX": "IDEX", "AME": "Ametek",
        "TRMB": "Trimble", "GRMN": "Garmin",
        "AXON": "Axon Enterprise", "PWR": "Quanta Services",
        "DY": "Dycom Industries", "TT": "Trane Technologies",
        "JCI": "Johnson Controls", "RRX": "Rexnord",
        "RKLB": "Rocket Lab", "ACHR": "Archer Aviation",
        "JOBY": "Joby Aviation",

        # ── 에너지 추가 ──
        "APA": "APA Corp", "CTRA": "Coterra Energy",
        "HES": "Hess Corp", "MRO": "Marathon Oil",
        "OVV": "Ovintiv", "PXD": "Pioneer Natural Resources",
        "SM": "SM Energy", "MTDR": "Matador Resources",
        "CHK": "Chesapeake Energy", "RRC": "Range Resources",
        "AR": "Antero Resources", "EQT": "EQT Corp",
        "NOG": "Northern Oil & Gas",

        # ── 유틸리티 추가 ──
        "AES": "AES Corp", "AWK": "American Water Works",
        "CMS": "CMS Energy", "CNP": "CenterPoint Energy",
        "DTE": "DTE Energy", "ED": "Consolidated Edison",
        "EIX": "Edison International", "ES": "Eversource Energy",
        "ETR": "Entergy", "EXC": "Exelon",
        "FE": "FirstEnergy", "LNT": "Alliant Energy",
        "NI": "NiSource", "NRG": "NRG Energy",
        "PCG": "PG&E", "PPL": "PPL Corp",
        "SRE": "Sempra Energy", "WEC": "WEC Energy",
        "XEL": "Xcel Energy",

        # ── 리츠 추가 ──
        "EQR": "Equity Residential", "ESS": "Essex Property Trust",
        "CPT": "Camden Property Trust", "MAA": "Mid-America Apartment",
        "IRM": "Iron Mountain", "WY": "Weyerhaeuser",
        "EXR": "Extra Space Storage", "CUBE": "CubeSmart",
        "NNN": "NNN REIT", "WPC": "W.P. Carey",
        "ADC": "Agree Realty", "STAG": "STAG Industrial",
        "REXR": "Rexford Industrial", "WELL": "Welltower",
        "VTR": "Ventas", "PEAK": "Healthpeak Properties",
        "SBAC": "SBA Communications", "AMH": "American Homes 4 Rent",
        "INVH": "Invitation Homes", "IIPR": "Innovative Industrial",
        "COLD": "Americold Realty",

        # ── 국제 ADR (한국 투자자 인기) ──
        "TSM": "TSMC", "BABA": "Alibaba", "JD": "JD.com",
        "PDD": "PDD Holdings", "BIDU": "Baidu",
        "NVO": "Novo Nordisk", "ASML": "ASML Holding",
        "SAP": "SAP SE", "TM": "Toyota Motor",
        "SONY": "Sony Group", "HMC": "Honda Motor",
        "SE": "Sea Limited", "MELI": "MercadoLibre",
        "NU": "Nu Holdings", "GRAB": "Grab Holdings",
        "INFY": "Infosys", "WIT": "Wipro",
        "AZN": "AstraZeneca", "GSK": "GSK",
        "NVS": "Novartis", "RHHBY": "Roche",
        "BP": "BP", "SHEL": "Shell",
        "TD": "Toronto-Dominion", "RY": "Royal Bank Canada",
        "BNS": "Bank of Nova Scotia", "BMO": "BMO Financial",
        "UL": "Unilever", "BTI": "British American Tobacco",

        # ── 크립토/블록체인 관련 ──
        "MSTR": "MicroStrategy", "RIOT": "Riot Platforms",
        "MARA": "Marathon Digital", "CLSK": "CleanSpark",
        "HUT": "Hut 8 Mining", "CIFR": "Cipher Mining",
        "BITF": "Bitfarms", "IREN": "Iris Energy",

        # ── 핀테크/결제 추가 ──
        "MQ": "Marqeta", "PAYO": "Payoneer",
        "OPEN": "Opendoor Technologies", "RDFN": "Redfin",
        "COMP": "Compass",

        # ── 바이오테크 성장주 ──
        "BNTX": "BioNTech", "NVAX": "Novavax",
        "ARQT": "Arcutis Biotherapeutics", "RCKT": "Rocket Pharmaceuticals",
        "ARVN": "Arvinas", "KYMR": "Kymera Therapeutics",
        "IMVT": "Immunovant", "DAWN": "Day One Biopharmaceuticals",
        "PRAX": "Praxis Precision Medicine",

        # ── 인기 밈/소매투자자 종목 ──
        "GME": "GameStop", "AMC": "AMC Entertainment",
        "BB": "BlackBerry", "NOK": "Nokia",
    }



def _get_us_etfs() -> dict[str, str]:
    from routes.search import _US_ETFS
    return _US_ETFS


def _batch_download(tickers: list[str]) -> pd.DataFrame | None:
    try:
        return yf.download(tickers, period="1y", interval="1d", progress=False, auto_adjust=True, threads=True)
    except Exception as e:
        logger.error(f"배치 다운로드 실패: {e}")
        return None


def _extract_ticker(df_all: pd.DataFrame, ticker: str) -> pd.DataFrame | None:
    try:
        if isinstance(df_all.columns, pd.MultiIndex):
            if ticker not in df_all.columns.get_level_values(1):
                return None
            df = df_all.xs(ticker, level=1, axis=1)
        else:
            df = df_all
        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.columns = ["open", "high", "low", "close", "volume"]
        df = df.dropna(subset=["close"])
        return df if len(df) >= SCAN_MIN_CANDLES else None
    except Exception:
        return None
