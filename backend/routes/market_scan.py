import asyncio
from datetime import datetime

from fastapi import APIRouter, Depends
from loguru import logger
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session, get_session
from models import DailyTopPick
from services.market_scanner import ScanResult, scan_market

router = APIRouter(tags=["market-scan"])

_scanning = False


@router.get("/scan/status")
async def scan_status():
    """스캔 진행 상태 조회."""
    from services.unified_scanner import get_scan_status
    return get_scan_status()


@router.post("/scan/unified")
async def unified_scan():
    """통합 스캔 — 1회 다운로드로 추천/MAX SQ/차트 BUY 동시 생성."""
    from services.unified_scanner import scan_all
    result = await scan_all()
    return result


@router.get("/scan/unified")
async def get_unified_cache():
    """통합 스캔 캐시 조회."""
    from services.unified_scanner import get_cache
    cache, scan_time = get_cache()
    if not cache:
        return {"picks": {}, "max_sq": {}, "chart_buy": {}, "scan_time": None}
    return {**cache, "scan_time": scan_time}


@router.post("/scan/market")
async def scan_all_markets(top_n: int = 3, min_squeeze: int = 1, trend_only: bool = True):
    """코스피/코스닥/미국 전체 스캔 → 스퀴즈 높은 Top N."""
    global _scanning
    if _scanning:
        return {"status": "already_scanning", "kospi": [], "kosdaq": [], "us": []}

    _scanning = True
    try:
        kospi = await scan_market("KOSPI", top_n, min_squeeze=min_squeeze, trend_only=trend_only)
        kosdaq = await scan_market("KOSDAQ", top_n, min_squeeze=min_squeeze, trend_only=trend_only)
        us = await scan_market("US", top_n, min_squeeze=min_squeeze, trend_only=trend_only)

        # min_squeeze 기본값일 때만 DB 기록
        if min_squeeze <= 1:
            await _save_daily(kospi + kosdaq + us)

        return {
            "status": "completed",
            "scanned": len(kospi) + len(kosdaq) + len(us),
            "kospi": [_to_dict(r) for r in kospi],
            "kosdaq": [_to_dict(r) for r in kosdaq],
            "us": [_to_dict(r) for r in us],
        }
    finally:
        _scanning = False


@router.get("/scan/market/latest")
async def get_latest_picks(session: AsyncSession = Depends(get_session)):
    """가장 최근 스캔 결과 조회 (DB에서)."""
    # 최신 날짜 조회
    latest = await session.scalar(
        select(DailyTopPick.scan_date).order_by(DailyTopPick.scan_date.desc()).limit(1)
    )
    if not latest:
        return {"scan_date": None, "kospi": [], "kosdaq": [], "us": []}

    result = await session.execute(
        select(DailyTopPick).where(DailyTopPick.scan_date == latest).order_by(DailyTopPick.rank)
    )
    rows = result.scalars().all()

    grouped: dict[str, list] = {"KOSPI": [], "KOSDAQ": [], "US": []}
    for r in rows:
        grouped.setdefault(r.market_type, []).append({
            "rank": r.rank, "symbol": r.symbol, "name": r.name,
            "market_type": r.market_type,
            "price": r.price, "change_pct": r.change_pct,
            "signal_state": r.signal_state, "confidence": r.confidence,
            "grade": r.grade, "rsi": r.rsi, "bb_pct_b": r.bb_pct_b,
            "squeeze_level": r.squeeze_level, "macd_hist": r.macd_hist,
            "volume_ratio": r.volume_ratio,
        })

    return {"scan_date": latest, "kospi": grouped.get("KOSPI", []),
            "kosdaq": grouped.get("KOSDAQ", []), "us": grouped.get("US", [])}


async def _save_daily(results: list[ScanResult]):
    """오늘 날짜로 DB 기록. 시장별로 rank 부여."""
    today = datetime.now().strftime("%Y-%m-%d")

    async with async_session() as session:
        await session.execute(delete(DailyTopPick).where(DailyTopPick.scan_date == today))

        # 시장별 rank
        market_rank: dict[str, int] = {}
        for r in results:
            market_rank[r.market_type] = market_rank.get(r.market_type, 0) + 1
            session.add(DailyTopPick(
                scan_date=today, market_type=r.market_type,
                rank=market_rank[r.market_type],
                symbol=r.symbol, name=r.name, price=r.price,
                change_pct=r.change_pct, signal_state="SQUEEZE",
                confidence=r.confidence, grade=f"SQ Lv{r.squeeze_level}",
                rsi=r.rsi, bb_pct_b=r.bb_pct_b, squeeze_level=r.squeeze_level,
                macd_hist=r.macd_hist, volume_ratio=r.volume_ratio,
            ))
        await session.commit()
        logger.info(f"일일 Top Pick {len(results)}건 저장 ({today})")


# ── 전체 시장 스캔 (스냅샷 기반) ──────────────────────────


@router.get("/scan/full/latest")
async def get_full_scan_latest():
    """최신 완료된 전체 스캔 스냅샷 조회 (DB에서 즉시 반환)."""
    from services.full_market_scanner import get_latest_snapshot
    result = await get_latest_snapshot()
    if not result:
        return {"status": "no_data", "picks": {}, "max_sq": {}, "chart_buy": {"items": []}}
    return result


@router.get("/scan/full/status")
async def get_full_scan_status():
    """전체 스캔 진행 상태 조회."""
    from services.full_market_scanner import get_progress, get_latest_snapshot
    progress = get_progress()
    # 마지막 완료 시간도 포함
    latest = await get_latest_snapshot()
    progress["last_completed_at"] = latest["completed_at"] if latest else None
    return progress


@router.post("/scan/full/trigger")
async def trigger_full_scan(background_tasks=None):
    """전체 시장 스캔 수동 트리거 (백그라운드 실행)."""
    from services.full_market_scanner import get_progress, run_full_scan
    if get_progress()["running"]:
        return {"status": "already_running"}

    asyncio.ensure_future(run_full_scan())
    return {"status": "started"}


@router.get("/scan/full/history")
async def get_full_scan_history(limit: int = 10):
    """전체 스캔 스냅샷 이력 조회."""
    from services.full_market_scanner import get_snapshot_history
    history = await get_snapshot_history(limit)
    return {"history": history}


def _to_dict(r: ScanResult) -> dict:
    sq_labels = {0: "NO SQ", 1: "LOW SQ", 2: "MID SQ", 3: "MAX SQ"}
    trend_labels = {"BULL": "상승추세", "BEAR": "하락추세", "NEUTRAL": "횡보"}
    return {
        "symbol": r.symbol, "name": r.name, "market_type": r.market_type,
        "price": r.price, "change_pct": r.change_pct,
        "rsi": r.rsi, "bb_pct_b": round(r.bb_pct_b * 100, 1),
        "bb_width": round(r.bb_width * 100, 2),
        "squeeze_level": r.squeeze_level,
        "squeeze_label": sq_labels.get(r.squeeze_level, ""),
        "macd_hist": r.macd_hist, "volume_ratio": r.volume_ratio,
        "confidence": r.confidence,
        "trend": r.trend,
        "trend_label": trend_labels.get(r.trend, "횡보"),
    }
