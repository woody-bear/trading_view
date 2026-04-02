import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_optional_user, get_user_id
from database import get_session
from models import CurrentSignal, StockMaster, Watchlist
from services.scanner import run_scan

router = APIRouter(tags=["signals"])


@router.get("/signals")
async def get_signals(
    market: Optional[str] = None,
    signal_state: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    user: Optional[dict] = Depends(get_optional_user),
):
    if not user:
        return {"signals": []}

    user_id = uuid.UUID(get_user_id(user))
    query = (
        select(CurrentSignal, Watchlist)
        .join(Watchlist, CurrentSignal.watchlist_id == Watchlist.id)
        .where(Watchlist.is_active.is_(True), Watchlist.user_id == user_id)
    )
    if market:
        query = query.where(Watchlist.market == market)
    if signal_state:
        query = query.where(CurrentSignal.signal_state == signal_state)

    result = await session.execute(query)
    rows = result.all()

    # Batch-fetch market_type from stock_master
    symbols = [w.symbol for _, w in rows]
    mt_result = await session.execute(
        select(StockMaster.symbol, StockMaster.market_type).where(StockMaster.symbol.in_(symbols))
    )
    market_type_map = {r.symbol: r.market_type for r in mt_result}

    signals = []
    for cs, w in rows:
        signals.append({
            "watchlist_id": w.id,
            "symbol": w.symbol,
            "display_name": w.display_name,
            "market": w.market,
            "market_type": market_type_map.get(w.symbol) or w.market,
            "signal_state": cs.signal_state,
            "confidence": cs.confidence,
            "signal_grade": _grade(cs.confidence),
            "price": cs.price,
            "change_pct": cs.change_pct,
            "rsi": cs.rsi,
            "bb_pct_b": cs.bb_pct_b,
            "bb_width": cs.bb_width,
            "squeeze_level": cs.squeeze_level,
            "macd_hist": cs.macd_hist,
            "volume_ratio": cs.volume_ratio,
            "ema_20": cs.ema_20,
            "ema_50": cs.ema_50,
            "ema_200": cs.ema_200,
            "updated_at": cs.updated_at.isoformat() if cs.updated_at else None,
        })

    return {"signals": signals}


@router.get("/signals/latest-buy")
async def get_latest_buy():
    """차트 마지막 신호가 BUY/SQZ BUY인 종목 목록."""
    from services.chart_scanner import get_cache, scan_latest_buy

    results, scan_time = get_cache()
    if not results and not scan_time:
        results = await scan_latest_buy()
        _, scan_time = get_cache()

    return {"items": results, "scan_time": scan_time, "count": len(results)}


@router.post("/signals/latest-buy/refresh")
async def refresh_latest_buy():
    """수동 재스캔 트리거."""
    from services.chart_scanner import scan_latest_buy

    results = await scan_latest_buy()
    return {"items": results, "count": len(results), "status": "refreshed"}


@router.get("/signals/{watchlist_id}")
async def get_signal_detail(watchlist_id: int, session: AsyncSession = Depends(get_session)):
    cs = await session.get(CurrentSignal, watchlist_id)
    if not cs:
        raise HTTPException(status_code=404, detail="종목 없음")

    w = await session.get(Watchlist, watchlist_id)
    return {
        "watchlist_id": w.id,
        "symbol": w.symbol,
        "display_name": w.display_name,
        "market": w.market,
        "signal_state": cs.signal_state,
        "confidence": cs.confidence,
        "signal_grade": _grade(cs.confidence),
        "price": cs.price,
        "change_pct": cs.change_pct,
        "rsi": cs.rsi,
        "bb_pct_b": cs.bb_pct_b,
        "bb_width": cs.bb_width,
        "squeeze_level": cs.squeeze_level,
        "macd_hist": cs.macd_hist,
        "volume_ratio": cs.volume_ratio,
        "ema_20": cs.ema_20,
        "ema_50": cs.ema_50,
        "ema_200": cs.ema_200,
        "updated_at": cs.updated_at.isoformat() if cs.updated_at else None,
    }


@router.get("/signals/by-symbol/{symbol}")
async def get_signal_by_symbol(symbol: str, session: AsyncSession = Depends(get_session)):
    """심볼로 종목 조회 (예: AAPL, 004170, BTC_USDT)."""
    # URL에서 _를 /로 변환 (크립토: BTC_USDT → BTC/USDT)
    lookup = symbol.replace("_", "/")
    result = await session.execute(
        select(CurrentSignal, Watchlist)
        .join(Watchlist, CurrentSignal.watchlist_id == Watchlist.id)
        .where(Watchlist.symbol == lookup)
        .limit(1)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="종목 없음")

    cs, w = row
    return {
        "watchlist_id": w.id,
        "symbol": w.symbol,
        "display_name": w.display_name,
        "market": w.market,
        "signal_state": cs.signal_state,
        "confidence": cs.confidence,
        "signal_grade": _grade(cs.confidence),
        "price": cs.price,
        "change_pct": cs.change_pct,
        "rsi": cs.rsi,
        "bb_pct_b": cs.bb_pct_b,
        "bb_width": cs.bb_width,
        "squeeze_level": cs.squeeze_level,
        "macd_hist": cs.macd_hist,
        "volume_ratio": cs.volume_ratio,
        "ema_20": cs.ema_20,
        "ema_50": cs.ema_50,
        "ema_200": cs.ema_200,
        "updated_at": cs.updated_at.isoformat() if cs.updated_at else None,
    }


@router.post("/scan/trigger")
async def trigger_scan(watchlist_ids: list[int] | None = None):
    result = await run_scan(watchlist_ids)
    if result["status"] == "skipped":
        raise HTTPException(status_code=409, detail="스캔이 이미 진행 중입니다")
    return {"status": "scan_started", **result}


def _grade(confidence: float | None) -> str:
    if confidence is None:
        return ""
    if confidence >= 90:
        return "STRONG"
    if confidence >= 70:
        return "NORMAL"
    if confidence >= 60:
        return "WEAK"
    return ""
