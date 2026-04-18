"""시가총액 배치 업데이트 — 일 1회 KR/US 전 종목 market_cap 갱신.

ALL_KR_SYMBOLS / ALL_US_TICKERS 범위 한정(약 1,188 종목)으로 yfinance 조회.
KR: 6자리 + .KS/.KQ 접미사. US: 티커 그대로.
BuyList 분포 바 대상 = 스캔 대상 종목이므로 큐레이션 리스트만 조회하면 충분.
"""

import asyncio
from datetime import datetime

from loguru import logger
from sqlalchemy import select, update

from database import async_session
from models import StockMaster


def _yf_market_cap(ticker: str):
    """yfinance 단일 티커 시총 조회 — fast_info 우선, info fallback."""
    import yfinance as yf
    try:
        t = yf.Ticker(ticker)
        cap = None
        try:
            cap = t.fast_info.get("market_cap") if hasattr(t, "fast_info") else None
        except Exception:
            cap = None
        if not cap:
            try:
                cap = t.info.get("marketCap")
            except Exception:
                cap = None
        return int(cap) if cap and cap > 0 else None
    except Exception:
        return None


def _fetch_kr_market_caps(symbols: list[str]) -> dict[str, int]:
    """KR 6자리 심볼 → yfinance `.KS`/`.KQ` 접미사로 시총 조회."""
    result: dict[str, int] = {}
    total = len(symbols)
    for i, sym in enumerate(symbols):
        # KOSPI는 .KS, KOSDAQ은 .KQ — 실패 시 반대로 재시도
        for suffix in (".KS", ".KQ"):
            cap = _yf_market_cap(f"{sym}{suffix}")
            if cap:
                result[sym] = cap
                break
        if (i + 1) % 50 == 0:
            logger.info(f"KR 시총 진행: {i + 1}/{total} ({len(result)}개 수집)")
    logger.info(f"yfinance KR 시총 {len(result)}개 수집 (대상 {total}개)")
    return result


def _fetch_us_market_caps(symbols: list[str]) -> dict[str, int]:
    """yfinance로 US 티커별 시총 조회 → {symbol: market_cap} (USD 단위)."""
    result: dict[str, int] = {}
    total = len(symbols)
    for i, sym in enumerate(symbols):
        cap = _yf_market_cap(sym)
        if cap:
            result[sym] = cap
        if (i + 1) % 50 == 0:
            logger.info(f"US 시총 진행: {i + 1}/{total} ({len(result)}개 수집)")
    logger.info(f"yfinance US 시총 {len(result)}개 수집 (대상 {total}개)")
    return result


async def refresh_market_caps() -> dict:
    """스캔 대상 종목 market_cap 갱신 (KR + US)."""
    logger.info("시가총액 배치 갱신 시작...")

    from services.scan_symbols_list import ALL_KR_SYMBOLS, ALL_US_TICKERS

    async with async_session() as session:
        kr_rows = (await session.execute(
            select(StockMaster.symbol).where(
                StockMaster.market == "KR",
                StockMaster.symbol.in_(ALL_KR_SYMBOLS),
            )
        )).scalars().all()
        us_rows = (await session.execute(
            select(StockMaster.symbol).where(
                StockMaster.market == "US",
                StockMaster.symbol.in_(ALL_US_TICKERS),
            )
        )).scalars().all()

    # KR: yfinance .KS/.KQ
    kr_caps = await asyncio.to_thread(_fetch_kr_market_caps, list(kr_rows))

    # KR 완료 후 즉시 커밋 (부분 조회 가능하도록)
    now = datetime.utcnow()
    async with async_session() as session:
        for sym, cap in kr_caps.items():
            await session.execute(
                update(StockMaster)
                .where(StockMaster.symbol == sym, StockMaster.market == "KR")
                .values(market_cap=cap, updated_at=now)
            )
        await session.commit()
        logger.info(f"KR 시총 DB 커밋 완료: {len(kr_caps)}개")

    # 분포 캐시 무효화 (신선한 데이터 반영)
    try:
        from services.market_cap_distribution import _cache
        _cache["ts"] = 0.0
    except Exception:
        pass

    # US
    us_caps = await asyncio.to_thread(_fetch_us_market_caps, list(us_rows))

    async with async_session() as session:
        for sym, cap in us_caps.items():
            await session.execute(
                update(StockMaster)
                .where(StockMaster.symbol == sym, StockMaster.market == "US")
                .values(market_cap=cap, updated_at=now)
            )
        await session.commit()
        logger.info(f"US 시총 DB 커밋 완료: {len(us_caps)}개")

    try:
        from services.market_cap_distribution import _cache
        _cache["ts"] = 0.0
    except Exception:
        pass

    logger.info(
        f"시가총액 배치 갱신 완료: KR {len(kr_caps)}/{len(kr_rows)}, "
        f"US {len(us_caps)}/{len(us_rows)}"
    )
    return {
        "status": "ok",
        "kr_updated": len(kr_caps),
        "kr_total": len(kr_rows),
        "us_updated": len(us_caps),
        "us_total": len(us_rows),
    }
