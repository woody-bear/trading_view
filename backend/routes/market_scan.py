import asyncio

from fastapi import APIRouter

router = APIRouter(tags=["market-scan"])


@router.get("/scan/status")
async def scan_status():
    """스캔 진행 상태 조회."""
    from services.unified_scanner import get_scan_status
    return get_scan_status()


@router.post("/scan/unified")
async def unified_scan():
    """통합 스캔 트리거 — 백그라운드 실행 후 즉시 반환."""
    from services.unified_scanner import get_scan_status, scan_all
    status = get_scan_status()
    if status.get("scanning"):
        return {"status": "already_running", "scanning": True}
    asyncio.ensure_future(scan_all())
    return {"status": "started", "scanning": True}


@router.get("/scan/unified")
async def get_unified_cache():
    """통합 스캔 캐시 조회."""
    from services.unified_scanner import get_cache
    cache, scan_time = get_cache()
    if not cache:
        return {"picks": {}, "max_sq": {}, "chart_buy": {}, "scan_time": None}
    return {**cache, "scan_time": scan_time}


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


@router.get("/scan/full/snapshot/{snapshot_id}/buy-items")
async def get_snapshot_buy_items(snapshot_id: int):
    """특정 스캔 스냅샷의 차트 BUY 신호 종목 목록."""
    from services.full_market_scanner import get_snapshot_buy_items
    items = await get_snapshot_buy_items(snapshot_id)
    return {"snapshot_id": snapshot_id, "items": items, "count": len(items)}


@router.get("/scan/symbols")
async def get_scan_symbols():
    """전체 스캔 대상 종목 목록 + 카테고리별 집계 반환."""
    from services.stock_master import get_all_symbols
    return await get_all_symbols()


