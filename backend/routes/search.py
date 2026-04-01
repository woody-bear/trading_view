import asyncio

from fastapi import APIRouter
from loguru import logger

router = APIRouter(tags=["search"])

_kr_cache: dict[str, dict] = {}  # {symbol: {name, market_type}}


async def _ensure_kr_cache():
    global _kr_cache
    if _kr_cache:
        return
    # pykrx 시도 → 실패 시 주요 종목 하드코딩
    try:
        from pykrx import stock

        def load():
            result = {}
            for mkt in ("KOSPI", "KOSDAQ"):
                try:
                    tickers = stock.get_market_ticker_list(market=mkt)
                    for t in tickers:
                        name = stock.get_market_ticker_name(t)
                        result[t] = {"name": name, "market_type": mkt}
                except Exception:
                    pass
            return result

        _kr_cache = await asyncio.to_thread(load)
        if _kr_cache:
            # ETF 하드코딩 보충 (pykrx ETF API가 장외시간 에러나므로)
            for sym, info in _KR_ETFS.items():
                if sym not in _kr_cache:
                    _kr_cache[sym] = info
            logger.info(f"KR 종목 캐시 로드 완료: {len(_kr_cache)}개")
            return
    except Exception:
        pass

    # 주요 종목 하드코딩 fallback
    _kr_cache = {**_get_kr_major_stocks(), **_KR_ETFS}
    logger.info(f"KR 종목 캐시 (하드코딩): {len(_kr_cache)}개")


@router.get("/search")
async def search_symbols(q: str, market: str = ""):
    """종목 검색 — stock_master DB 우선, fallback 하드코딩."""
    if not q or len(q) < 1:
        return {"results": []}

    q_upper = q.strip().upper()

    # 미국 시장 검색 포함 여부 & 티커처럼 보이는 짧은 쿼리인지 판단
    # (1~5자 알파벳 → 정확한 US 티커일 가능성 높음)
    is_us_market = market in ("", "US")
    looks_like_ticker = is_us_market and q_upper.isalpha() and len(q_upper) <= 5

    # 티커처럼 보이면 yfinance 정확 조회를 먼저 실행 (비동기 병렬)
    yf_exact_task = None
    if looks_like_ticker:
        import asyncio
        yf_exact_task = asyncio.create_task(_search_yfinance(q_upper))

    # 큐레이션 종목 우선 정렬용 세트 (BUY 조회종목리스트)
    from services.scan_symbols_list import ALL_US_TICKERS, ALL_KR_SYMBOLS
    _curated = ALL_US_TICKERS | ALL_KR_SYMBOLS

    def _prioritize(results: list[dict]) -> list[dict]:
        """큐레이션 종목을 먼저, 심볼 완전 일치를 최상단으로 정렬 (기존 순서 유지)."""
        exact  = [r for r in results if r["symbol"] == q_upper and r["symbol"] in _curated]
        curate = [r for r in results if r["symbol"] != q_upper and r["symbol"] in _curated]
        others = [r for r in results if r["symbol"] not in _curated]
        return exact + curate + others

    # 1순위: stock_master DB 검색 (전종목)
    from services.stock_master import search_master, get_master_count
    master_count = await get_master_count()
    master_results = []
    if master_count > 0:
        master_results = await search_master(q, market, limit=20)

    # yfinance 결과 병합 (심볼 완전 일치를 맨 앞에, 큐레이션 우선)
    if yf_exact_task is not None:
        yf_exact = await yf_exact_task
        if yf_exact:
            existing_syms = {r["symbol"] for r in master_results}
            new_yf = [r for r in yf_exact if r["symbol"] not in existing_syms]
            merged = _prioritize(master_results + new_yf)
            return {"results": merged[:20]}

    if master_results:
        return {"results": _prioritize(master_results)}

    # 2순위: fallback (하드코딩 + yfinance)
    results = []
    q_upper = q.upper()
    q_lower = q.lower()

    # 한국 종목 (한글 이름 검색)
    if market in ("", "KR"):
        await _ensure_kr_cache()
        for sym, info in _kr_cache.items():
            if len(results) >= 10:
                break
            name = info["name"]
            if q in name or q_upper in sym:
                results.append({
                    "symbol": sym,
                    "name": name,
                    "market": "KR",
                    "market_type": info["market_type"],
                    "display": f"{name} ({sym}) - {info['market_type']}",
                })

    # 미국 종목 (하드코딩 + yfinance 실시간 검색)
    if market in ("", "US"):
        from services.market_scanner import _get_us_stocks
        us = {**_get_us_stocks(), **_US_ETFS}
        found_us = set()
        for ticker, name in us.items():
            if len(results) >= 15:
                break
            if q_upper in ticker or q_lower in name.lower():
                found_us.add(ticker)
                results.append({
                    "symbol": ticker,
                    "name": name,
                    "market": "US",
                    "market_type": "US",
                    "display": f"{name} ({ticker})",
                })
        # 하드코딩에 없으면 yfinance로 실시간 검색 시도 (1글자 티커도 허용)
        if len(results) < 15 and q_upper not in found_us:
            yf_results = await _search_yfinance(q_upper)
            for r in yf_results:
                if r["symbol"] not in found_us and len(results) < 15:
                    results.append(r)

    # 암호화폐 (심볼 검색)
    if market in ("", "CRYPTO"):
        for sym, name in _CRYPTO_PAIRS.items():
            if len(results) >= 20:
                break
            if q_upper in sym or q_lower in name.lower():
                results.append({
                    "symbol": sym,
                    "name": name,
                    "market": "CRYPTO",
                    "market_type": "CRYPTO",
                    "display": f"{name} ({sym})",
                })

    return {"results": _prioritize(results)[:20]}


_CRYPTO_PAIRS: dict[str, str] = {
    "BTC/USDT": "Bitcoin", "ETH/USDT": "Ethereum", "BNB/USDT": "BNB",
    "XRP/USDT": "Ripple", "ADA/USDT": "Cardano", "SOL/USDT": "Solana",
    "DOGE/USDT": "Dogecoin", "DOT/USDT": "Polkadot", "AVAX/USDT": "Avalanche",
    "MATIC/USDT": "Polygon", "LINK/USDT": "Chainlink", "UNI/USDT": "Uniswap",
    "ATOM/USDT": "Cosmos", "LTC/USDT": "Litecoin", "ETC/USDT": "Ethereum Classic",
    "FIL/USDT": "Filecoin", "APT/USDT": "Aptos", "ARB/USDT": "Arbitrum",
    "OP/USDT": "Optimism", "NEAR/USDT": "NEAR Protocol", "AAVE/USDT": "Aave",
    "SUI/USDT": "Sui", "SEI/USDT": "Sei", "TIA/USDT": "Celestia",
    "INJ/USDT": "Injective", "PEPE/USDT": "Pepe", "SHIB/USDT": "Shiba Inu",
    "WIF/USDT": "dogwifhat", "BONK/USDT": "Bonk", "RENDER/USDT": "Render",
}


def _get_kr_major_stocks() -> dict[str, dict]:
    """한국 주요 종목 하드코딩 (pykrx 장애 시 fallback)."""
    stocks = {
        # KOSPI 주요
        "005930": ("삼성전자", "KOSPI"), "000660": ("SK하이닉스", "KOSPI"),
        "005380": ("현대차", "KOSPI"), "000270": ("기아", "KOSPI"),
        "068270": ("셀트리온", "KOSPI"), "035420": ("NAVER", "KOSPI"),
        "005490": ("POSCO홀딩스", "KOSPI"), "012330": ("현대모비스", "KOSPI"),
        "055550": ("신한지주", "KOSPI"), "105560": ("KB금융", "KOSPI"),
        "003670": ("포스코퓨처엠", "KOSPI"), "006400": ("삼성SDI", "KOSPI"),
        "051910": ("LG화학", "KOSPI"), "066570": ("LG전자", "KOSPI"),
        "003550": ("LG", "KOSPI"), "032830": ("삼성생명", "KOSPI"),
        "086790": ("하나금융지주", "KOSPI"), "010130": ("고려아연", "KOSPI"),
        "034730": ("SK", "KOSPI"), "015760": ("한국전력", "KOSPI"),
        "010140": ("삼성중공업", "KOSPI"), "012450": ("한화에어로스페이스", "KOSPI"),
        "009150": ("삼성전기", "KOSPI"), "028260": ("삼성물산", "KOSPI"),
        "018260": ("삼성에스디에스", "KOSPI"), "033780": ("KT&G", "KOSPI"),
        "096770": ("SK이노베이션", "KOSPI"), "017670": ("SK텔레콤", "KOSPI"),
        "030200": ("KT", "KOSPI"), "036570": ("엔씨소프트", "KOSPI"),
        "011200": ("HMM", "KOSPI"), "034020": ("두산에너빌리티", "KOSPI"),
        "009540": ("HD한국조선해양", "KOSPI"), "042660": ("한화오션", "KOSPI"),
        "329180": ("HD현대중공업", "KOSPI"), "267260": ("HD현대", "KOSPI"),
        "000810": ("삼성화재", "KOSPI"), "316140": ("우리금융지주", "KOSPI"),
        "003490": ("대한항공", "KOSPI"), "047050": ("포스코인터내셔널", "KOSPI"),
        "010950": ("S-Oil", "KOSPI"), "011170": ("롯데케미칼", "KOSPI"),
        "035720": ("카카오", "KOSPI"), "259960": ("크래프톤", "KOSPI"),
        "352820": ("하이브", "KOSPI"), "003230": ("삼양식품", "KOSPI"),
        "004020": ("현대제철", "KOSPI"), "021240": ("코웨이", "KOSPI"),
        "090430": ("아모레퍼시픽", "KOSPI"), "051900": ("LG생활건강", "KOSPI"),
        # KOSDAQ 주요
        "247540": ("에코프로비엠", "KOSDAQ"), "086520": ("에코프로", "KOSDAQ"),
        "403870": ("HPSP", "KOSDAQ"), "196170": ("알테오젠", "KOSDAQ"),
        "041510": ("에스엠", "KOSDAQ"), "293490": ("카카오게임즈", "KOSDAQ"),
        "112040": ("위메이드", "KOSDAQ"), "263750": ("펄어비스", "KOSDAQ"),
        "035900": ("JYP Ent.", "KOSDAQ"), "145020": ("휴젤", "KOSDAQ"),
        "068760": ("셀트리온제약", "KOSDAQ"), "091990": ("셀트리온헬스케어", "KOSDAQ"),
        "383220": ("F&F", "KOSDAQ"), "328130": ("루닛", "KOSDAQ"),
        "039030": ("이오테크닉스", "KOSDAQ"), "058470": ("리노공업", "KOSDAQ"),
        "257720": ("실리콘투", "KOSDAQ"), "095340": ("ISC", "KOSDAQ"),
        "036930": ("주성엔지니어링", "KOSDAQ"), "240810": ("원익IPS", "KOSDAQ"),
    }
    return {k: {"name": v[0], "market_type": v[1]} for k, v in stocks.items()}


# ── 한국 ETF 하드코딩 ──────────────────────────────────────

_KR_ETFS: dict[str, dict] = {k: {"name": v[0], "market_type": v[1]} for k, v in {
    # 국내 주요 ETF
    "069500": ("KODEX 200", "KOSPI"), "229200": ("KODEX 코스닥150", "KOSPI"),
    "114800": ("KODEX 인버스", "KOSPI"), "122630": ("KODEX 레버리지", "KOSPI"),
    "252670": ("KODEX 200선물인버스2X", "KOSPI"),
    "005930": ("삼성전자", "KOSPI"),  # 이미 주식에 있으면 덮어쓰기 안 됨
    "133690": ("TIGER 미국나스닥100", "KOSPI"), "371460": ("TIGER 차이나전기차SOLACTIVE", "KOSPI"),
    "381180": ("TIGER 미국테크TOP10 INDXX", "KOSPI"), "381170": ("TIGER 미국S&P500", "KOSPI"),
    "360750": ("TIGER 미국S&P500", "KOSPI"), "379800": ("KODEX 미국S&P500TR", "KOSPI"),
    "379810": ("KODEX 미국나스닥100TR", "KOSPI"),
    "261240": ("TIGER 미국MSCI리츠(합성 H)", "KOSPI"),
    "305720": ("KODEX 2차전지산업", "KOSPI"), "364690": ("KODEX Fn반도체", "KOSPI"),
    "091160": ("KODEX 반도체", "KOSPI"), "091170": ("KODEX 은행", "KOSPI"),
    "091180": ("KODEX 자동차", "KOSPI"),
    "161510": ("ARIRANG 고배당주", "KOSPI"), "329750": ("TIGER CD금리투자KIS(합성)", "KOSPI"),
    "365780": ("ACE 미국빅테크TOP7 Plus", "KOSPI"),
    "411060": ("ACE 미국나스닥100", "KOSPI"),
    "148070": ("KOSEF 국고채10년", "KOSPI"), "152380": ("KODEX 국채선물10Y", "KOSPI"),
    "153130": ("KODEX 단기채권", "KOSPI"), "182490": ("TIGER 단기채권액티브", "KOSPI"),
    "308620": ("KODEX 미국채10년선물", "KOSPI"),
    "304660": ("KODEX 미국채울트라30년선물(H)", "KOSPI"),
    "453810": ("TIGER 미국30년국채프리미엄액티브(H)", "KOSPI"),
    "451600": ("TIGER 미국채10년선물인버스", "KOSPI"),
    "439870": ("TIGER 미국채30년스트립액티브(합성 H)", "KOSPI"),
    "130730": ("KOSEF 단기자금", "KOSPI"),
    "132030": ("KODEX 골드선물(H)", "KOSPI"), "319640": ("TIGER 골드선물(H)", "KOSPI"),
    "271060": ("KODEX 3대농산물선물(H)", "KOSPI"),
    "130680": ("TIGER 원유선물Enhanced(H)", "KOSPI"),
    "217770": ("TIGER 원유선물인버스(H)", "KOSPI"),
}.items()}


# ── 미국 ETF/채권 하드코딩 ──────────────────────────────────

_US_ETFS: dict[str, str] = {
    # 주요 지수 ETF
    "SPY": "SPDR S&P 500 ETF", "QQQ": "Invesco QQQ (Nasdaq 100)",
    "DIA": "SPDR Dow Jones ETF", "IWM": "iShares Russell 2000",
    "VOO": "Vanguard S&P 500", "VTI": "Vanguard Total Stock",
    "VTV": "Vanguard Value", "VUG": "Vanguard Growth",
    "RSP": "Invesco S&P 500 Equal Weight", "MDY": "SPDR S&P MidCap 400",
    "IJR": "iShares S&P SmallCap 600",
    # 섹터 ETF
    "XLK": "Technology Select SPDR", "XLF": "Financial Select SPDR",
    "XLE": "Energy Select SPDR", "XLV": "Health Care Select SPDR",
    "XLI": "Industrial Select SPDR", "XLC": "Communication Svc SPDR",
    "XLY": "Consumer Discretionary SPDR", "XLP": "Consumer Staples SPDR",
    "XLB": "Materials Select SPDR", "XLU": "Utilities Select SPDR",
    "XLRE": "Real Estate Select SPDR",
    "SOXX": "iShares Semiconductor", "SMH": "VanEck Semiconductor",
    "ARKK": "ARK Innovation", "ARKW": "ARK Next Gen Internet",
    "XBI": "SPDR S&P Biotech", "IBB": "iShares Biotechnology",
    "HACK": "ETFMG Prime Cyber Security", "BOTZ": "Global X Robotics & AI",
    "LIT": "Global X Lithium & Battery",
    # 채권 ETF
    "TLT": "iShares 20+ Year Treasury", "TLH": "iShares 10-20 Year Treasury",
    "IEF": "iShares 7-10 Year Treasury", "SHY": "iShares 1-3 Year Treasury",
    "SHV": "iShares Short Treasury Bond", "GOVT": "iShares US Treasury Bond",
    "BND": "Vanguard Total Bond", "AGG": "iShares Core US Aggregate Bond",
    "BNDX": "Vanguard Total Intl Bond",
    "LQD": "iShares Investment Grade Bond", "HYG": "iShares High Yield Bond",
    "JNK": "SPDR Bloomberg High Yield Bond",
    "EMB": "iShares JP Morgan EM Bond", "TIPS": "iShares TIPS Bond",
    "TMF": "Direxion Daily 20+ Year Treasury Bull 3X",
    "TMV": "Direxion Daily 20+ Year Treasury Bear 3X",
    "TBF": "ProShares Short 20+ Year Treasury",
    "TBT": "ProShares UltraShort 20+ Year Treasury",
    # 원자재/금/은
    "GLD": "SPDR Gold Shares", "IAU": "iShares Gold Trust",
    "SLV": "iShares Silver Trust", "PPLT": "abrdn Platinum Shares",
    "USO": "United States Oil Fund", "UNG": "United States Natural Gas",
    "DBA": "Invesco DB Agriculture", "DBC": "Invesco DB Commodity",
    "PDBC": "Invesco Optimum Yield Diversified Commodity",
    # 레버리지/인버스
    "TQQQ": "ProShares UltraPro QQQ (3X)", "SQQQ": "ProShares UltraPro Short QQQ (-3X)",
    "UPRO": "ProShares UltraPro S&P 500 (3X)", "SPXU": "ProShares UltraPro Short S&P 500 (-3X)",
    "SOXL": "Direxion Daily Semiconductor Bull 3X", "SOXS": "Direxion Daily Semiconductor Bear 3X",
    "LABU": "Direxion Daily S&P Biotech Bull 3X", "LABD": "Direxion Daily S&P Biotech Bear 3X",
    "FAS": "Direxion Daily Financial Bull 3X", "FAZ": "Direxion Daily Financial Bear 3X",
    "UVXY": "ProShares Ultra VIX Short-Term",
    # 해외 시장
    "EEM": "iShares MSCI Emerging Markets", "EFA": "iShares MSCI EAFE",
    "FXI": "iShares China Large-Cap", "KWEB": "KraneShares CSI China Internet",
    "VWO": "Vanguard FTSE Emerging Markets",
    "INDA": "iShares MSCI India", "EWJ": "iShares MSCI Japan",
    "EWZ": "iShares MSCI Brazil", "EWY": "iShares MSCI South Korea",
    # 리츠/배당
    "VNQ": "Vanguard Real Estate", "SCHD": "Schwab US Dividend Equity",
    "JEPI": "JPMorgan Equity Premium Income",
    "DVY": "iShares Select Dividend", "HDV": "iShares Core High Dividend",
    "SPHD": "Invesco S&P 500 High Dividend Low Volatility",
}


# ── yfinance 실시간 검색 (fallback) ──────────────────────────

async def _search_yfinance(query: str) -> list[dict]:
    """yfinance Search API로 미국 종목 실시간 검색 (yf.Search 사용, 빠름)."""
    try:
        import yfinance as yf

        def _search():
            results = []
            try:
                search = yf.Search(query, max_results=8)
                for q in getattr(search, "quotes", []):
                    sym = q.get("symbol", "")
                    if not sym or "." in sym:  # 해외 거래소 (BRK.A 등) 제외
                        continue
                    name = q.get("shortname") or q.get("longname") or sym
                    results.append({
                        "symbol": sym,
                        "name": name,
                        "market": "US",
                        "market_type": "US",
                        "display": f"{name} ({sym})",
                    })
            except Exception:
                pass
            return results

        return await asyncio.to_thread(_search)
    except Exception:
        return []
