import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_optional_user, get_user_id
from database import get_session
from models import CurrentSignal, ScanSnapshotItem, SignalHistory, StockMaster, Watchlist
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

    # Primary: ScanSnapshotItem (chart-scan algorithm, matches chart markers)
    lsd_result = await session.execute(
        select(ScanSnapshotItem.symbol, func.max(ScanSnapshotItem.last_signal_date).label("lsd"))
        .where(ScanSnapshotItem.symbol.in_(symbols))
        .group_by(ScanSnapshotItem.symbol)
    )
    last_signal_date_map = {r.symbol: r.lsd for r in lsd_result}

    # Fallback: SignalHistory BUY state transition (prev_state != BUY) for symbols not in scan
    missing = [s for s in symbols if not last_signal_date_map.get(s)]
    watchlist_ids = [w.id for _, w in rows if w.symbol in missing]
    id_to_symbol = {w.id: w.symbol for _, w in rows if w.symbol in missing}
    if watchlist_ids:
        hist_result = await session.execute(
            select(SignalHistory.watchlist_id, func.max(SignalHistory.detected_at).label("lat"))
            .where(
                SignalHistory.watchlist_id.in_(watchlist_ids),
                SignalHistory.signal_state == "BUY",
                SignalHistory.prev_state != "BUY",
            )
            .group_by(SignalHistory.watchlist_id)
        )
        for r in hist_result:
            if r.lat:
                last_signal_date_map[id_to_symbol[r.watchlist_id]] = r.lat.strftime("%Y-%m-%d")

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
            "last_signal_date": last_signal_date_map.get(w.symbol),
        })

    return {"signals": signals}


@router.get("/signals/latest-buy")
async def get_latest_buy():
    """최신 스냅샷에서 chart_buy 종목 반환 (KR 5 + US 5)."""
    from services.full_market_scanner import get_latest_snapshot

    snapshot = await get_latest_snapshot()
    if not snapshot:
        return {"items": [], "scan_time": None, "count": 0}
    items = snapshot.get("chart_buy", {}).get("items", [])
    scan_time = snapshot.get("completed_at")
    return {"items": items, "scan_time": scan_time, "count": len(items)}


@router.post("/signals/latest-buy/refresh")
async def refresh_latest_buy():
    """스냅샷 재조회 — 실시간 스캔 없이 최신 스냅샷 반환."""
    from services.full_market_scanner import get_latest_snapshot

    snapshot = await get_latest_snapshot()
    if not snapshot:
        return {"items": [], "count": 0, "status": "no_snapshot"}
    items = snapshot.get("chart_buy", {}).get("items", [])
    return {"items": items, "count": len(items), "status": "ok"}


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
