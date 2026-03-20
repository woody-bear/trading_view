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
        symbols = _get_us_stocks()
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
        "AAPL": "Apple", "MSFT": "Microsoft", "GOOGL": "Alphabet", "AMZN": "Amazon",
        "NVDA": "NVIDIA", "META": "Meta", "TSLA": "Tesla", "JPM": "JPMorgan",
        "V": "Visa", "UNH": "UnitedHealth", "XOM": "Exxon", "MA": "Mastercard",
        "HD": "Home Depot", "PG": "P&G", "COST": "Costco", "AVGO": "Broadcom",
        "LLY": "Eli Lilly", "MRK": "Merck", "ABBV": "AbbVie", "KO": "Coca-Cola",
        "PEP": "PepsiCo", "CRM": "Salesforce", "CSCO": "Cisco", "ADBE": "Adobe",
        "NKE": "Nike", "TXN": "Texas Inst", "QCOM": "Qualcomm", "AMGN": "Amgen",
        "INTC": "Intel", "IBM": "IBM", "CAT": "Caterpillar", "BA": "Boeing",
        "GE": "GE", "SBUX": "Starbucks", "GS": "Goldman", "AMD": "AMD",
        "NFLX": "Netflix", "DIS": "Disney", "PYPL": "PayPal", "UBER": "Uber",
        "SQ": "Block", "SHOP": "Shopify", "SNOW": "Snowflake", "PLTR": "Palantir",
        "COIN": "Coinbase", "CRWD": "CrowdStrike", "NET": "Cloudflare",
        "ARM": "Arm", "SMCI": "Super Micro", "MU": "Micron", "MRVL": "Marvell",
        "PANW": "Palo Alto", "NOW": "ServiceNow", "ORCL": "Oracle",
        "ABNB": "Airbnb", "RIVN": "Rivian", "NIO": "NIO", "SOFI": "SoFi",
        "F": "Ford", "GM": "GM", "PFE": "Pfizer", "MRNA": "Moderna",
        "ENPH": "Enphase", "FSLR": "First Solar", "ON": "ON Semi",
    }


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
