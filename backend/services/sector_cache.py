"""종목 업종(sector) 캐시 — yfinance 기반, 메모리 24h TTL."""

import asyncio
import time

from loguru import logger

_cache: dict[str, tuple[str, float]] = {}  # symbol → (sector_kr, timestamp)
_TTL = 86400  # 24h

_SECTOR_KR: dict[str, str] = {
    "Technology": "IT/기술",
    "Communication Services": "커뮤니케이션",
    "Consumer Cyclical": "소비재(경기)",
    "Consumer Defensive": "소비재(필수)",
    "Healthcare": "헬스케어",
    "Financial Services": "금융",
    "Industrials": "산업재",
    "Basic Materials": "소재",
    "Energy": "에너지",
    "Real Estate": "부동산",
    "Utilities": "유틸리티",
}


def _to_yf_ticker(symbol: str, market_type: str) -> str:
    if market_type == "KOSPI":
        return f"{symbol}.KS"
    if market_type == "KOSDAQ":
        return f"{symbol}.KQ"
    return symbol


def _fetch_one_sync(yf_ticker: str, is_etf: bool) -> str:
    if is_etf:
        return "ETF"
    try:
        import yfinance as yf
        info = yf.Ticker(yf_ticker).info
        sector = info.get("sector", "")
        return _SECTOR_KR.get(sector, sector) or "기타"
    except Exception:
        return "기타"


async def get_sectors(items: list[dict]) -> dict[str, str]:
    """symbol → sector 한국어 반환. 캐시 미스 시 병렬 fetch."""
    now = time.time()
    result: dict[str, str] = {}
    missing: list[dict] = []

    for item in items:
        sym = item["symbol"]
        market = item.get("market", "")
        if market == "CRYPTO":
            result[sym] = "암호화폐"
            continue
        cached = _cache.get(sym)
        if cached and now - cached[1] < _TTL:
            result[sym] = cached[0]
        else:
            missing.append(item)

    if missing:
        tasks = []
        for item in missing:
            yf_ticker = _to_yf_ticker(item["symbol"], item.get("market_type", item.get("market", "")))
            is_etf = item.get("is_etf", False)
            tasks.append(asyncio.to_thread(_fetch_one_sync, yf_ticker, is_etf))

        fetched = await asyncio.gather(*tasks, return_exceptions=True)
        for item, sector in zip(missing, fetched):
            if isinstance(sector, Exception):
                sector = "기타"
            _cache[item["symbol"]] = (str(sector), now)
            result[item["symbol"]] = str(sector)
        logger.info(f"업종 캐시 갱신: {len(missing)}개 fetch 완료")

    return result


def invalidate(symbol: str) -> None:
    _cache.pop(symbol, None)
