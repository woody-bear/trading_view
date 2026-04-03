"""Crisis event market indicator history API routes."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from services.crisis_service import (
    compare_events,
    get_default_comparison,
    get_event_indicators,
    get_event_stats,
    get_events,
)

router = APIRouter(prefix="/crisis", tags=["crisis"])


@router.get("/events")
async def list_events(type: Optional[str] = Query(None, alias="type")):
    """위기 이벤트 목록. type 필터: war|pandemic|financial_crisis|natural_disaster"""
    events = await get_events(event_type=type)
    return {"events": events, "total": len(events)}


@router.get("/default-comparison")
async def default_comparison():
    """진입 시 자동 표시용 — 진행중 이벤트 vs 큐레이터 선정 과거 이벤트."""
    return await get_default_comparison()


@router.get("/events/{event_id}/indicators")
async def event_indicators(
    event_id: int,
    days_before: int = Query(30, ge=0, le=180),
    days_after: int = Query(180, ge=0, le=180),
    indicator_ids: Optional[str] = Query(None, description="콤마 구분 indicator ID"),
):
    """이벤트별 지표 일별 데이터. 차트 렌더링용."""
    ids = None
    if indicator_ids:
        try:
            ids = [int(x.strip()) for x in indicator_ids.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="indicator_ids 형식 오류 (예: 1,3,6)")

    result = await get_event_indicators(event_id, days_before, days_after, ids)
    if result is None:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")
    return result


@router.get("/events/{event_id}/stats")
async def event_stats(event_id: int):
    """이벤트-지표별 요약 통계 (MDD, 최대상승, 회복일)."""
    result = await get_event_stats(event_id)
    if result is None:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")
    return result


@router.get("/compare")
async def compare(
    event_ids: str = Query(..., description="콤마 구분 이벤트 ID (최대 3개, 'custom' 포함 가능)"),
    indicator_id: int = Query(...),
    days: int = Query(90, ge=7, le=180),
    custom_start_date: Optional[str] = Query(None, description="ISO 날짜 (커스텀 기준선)"),
):
    """복수 이벤트 비교 차트 데이터."""
    # event_ids 파싱
    raw_ids = [x.strip() for x in event_ids.split(",")]
    if len(raw_ids) > 3:
        raise HTTPException(status_code=400, detail="최대 3개 이벤트까지 선택 가능합니다")

    parsed_ids: list = []
    for raw in raw_ids:
        if raw == "custom":
            parsed_ids.append("custom")
        else:
            try:
                parsed_ids.append(int(raw))
            except ValueError:
                raise HTTPException(status_code=400, detail=f"event_id 형식 오류: {raw}")

    # 커스텀 날짜 파싱
    custom_date = None
    if custom_start_date:
        try:
            custom_date = date.fromisoformat(custom_start_date)
            if custom_date > date.today():
                raise HTTPException(status_code=400, detail="커스텀 시작일은 오늘 이전이어야 합니다")
        except ValueError:
            raise HTTPException(status_code=400, detail="custom_start_date 형식 오류 (예: 2025-06-01)")

    result = await compare_events(parsed_ids, indicator_id, days, custom_date)
    if result is None:
        raise HTTPException(status_code=400, detail="최대 3개 이벤트까지 선택 가능합니다")
    return result
