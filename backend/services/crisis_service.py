"""Crisis event market indicator service layer."""
import asyncio
from datetime import date, datetime, timedelta
from functools import lru_cache
from typing import Optional

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import async_session
from fetchers.crisis_fetcher import (
    INDICATORS,
    compute_data_points,
    compute_stats,
    fetch_event_indicator_data,
    fetch_indicator_history_async,
)
from models import (
    CrisisEvent,
    EventIndicatorStats,
    IndicatorDataPoint,
    MarketIndicator,
)

# 커스텀 시작일 비교 메모리 캐시 (TTL 1시간)
_custom_cache: dict[str, tuple[list, datetime]] = {}
_CUSTOM_CACHE_TTL = 3600  # seconds


async def get_events(event_type: Optional[str] = None) -> list[dict]:
    """위기 이벤트 목록 반환. event_type 필터 지원."""
    async with async_session() as session:
        q = select(CrisisEvent).order_by(CrisisEvent.start_date.desc())
        if event_type:
            q = q.where(CrisisEvent.event_type == event_type)
        result = await session.execute(q)
        events = result.scalars().all()

    return [
        {
            "id": e.id,
            "name": e.name,
            "event_type": e.event_type,
            "start_date": e.start_date.isoformat(),
            "end_date": e.end_date.isoformat() if e.end_date else None,
            "is_ongoing": e.is_ongoing,
            "severity_level": e.severity_level,
            "description": e.description,
            "has_comparison": e.best_comparison_event_id is not None,
        }
        for e in events
    ]


async def get_event_indicators(
    event_id: int,
    days_before: int = 30,
    days_after: int = 180,
    indicator_ids: Optional[list[int]] = None,
) -> Optional[dict]:
    """이벤트 지표 일별 데이터 반환."""
    async with async_session() as session:
        event = await session.get(CrisisEvent, event_id)
        if not event:
            return None

        ind_q = select(MarketIndicator)
        if indicator_ids:
            ind_q = ind_q.where(MarketIndicator.id.in_(indicator_ids))
        indicators = (await session.execute(ind_q)).scalars().all()

        result_indicators = []
        for indicator in indicators:
            dp_q = (
                select(IndicatorDataPoint)
                .where(
                    IndicatorDataPoint.event_id == event_id,
                    IndicatorDataPoint.indicator_id == indicator.id,
                    IndicatorDataPoint.date >= event.start_date - timedelta(days=days_before),
                    IndicatorDataPoint.date <= event.start_date + timedelta(days=days_after),
                )
                .order_by(IndicatorDataPoint.date)
            )
            dps = (await session.execute(dp_q)).scalars().all()

            has_data = len(dps) > 0
            data_points = []
            if has_data:
                for dp in dps:
                    day_offset = (dp.date - event.start_date).days
                    data_points.append({
                        "date": dp.date.isoformat(),
                        "day_offset": day_offset,
                        "value": dp.value,
                        "change_pct": dp.change_pct_from_event_start,
                    })

            no_data_reason = None
            if not has_data:
                if indicator.earliest_date > event.start_date:
                    no_data_reason = f"{indicator.earliest_date.year}년 이전 데이터 없음"
                else:
                    no_data_reason = "데이터 없음"

            result_indicators.append({
                "id": indicator.id,
                "name": indicator.name,
                "category": indicator.category,
                "unit": indicator.unit,
                "data_points": data_points,
                "has_data": has_data,
                "no_data_reason": no_data_reason,
            })

    return {
        "event": {
            "id": event.id,
            "name": event.name,
            "start_date": event.start_date.isoformat(),
        },
        "indicators": result_indicators,
    }


async def get_event_stats(event_id: int) -> Optional[dict]:
    """이벤트-지표별 요약 통계 반환."""
    async with async_session() as session:
        event = await session.get(CrisisEvent, event_id)
        if not event:
            return None

        stats_q = (
            select(EventIndicatorStats, MarketIndicator)
            .join(MarketIndicator, EventIndicatorStats.indicator_id == MarketIndicator.id)
            .where(EventIndicatorStats.event_id == event_id)
        )
        rows = (await session.execute(stats_q)).all()

    return {
        "event_id": event_id,
        "stats": [
            {
                "indicator_id": stat.indicator_id,
                "indicator_name": ind.name,
                "max_drawdown_pct": stat.max_drawdown_pct,
                "max_gain_pct": stat.max_gain_pct,
                "days_to_bottom": stat.days_to_bottom,
                "recovery_days": stat.recovery_days,
            }
            for stat, ind in rows
        ],
    }


async def get_default_comparison() -> dict:
    """진행 중인 이벤트 + 큐레이터 매칭 과거 이벤트 반환."""
    async with async_session() as session:
        # 진행 중인 이벤트 우선
        ongoing_q = select(CrisisEvent).where(CrisisEvent.is_ongoing.is_(True)).limit(1)
        ongoing = (await session.execute(ongoing_q)).scalar_one_or_none()

        if not ongoing:
            return {"current_event": None, "comparison_event": None, "match_type": "none"}

        current = {
            "id": ongoing.id,
            "name": ongoing.name,
            "start_date": ongoing.start_date.isoformat(),
            "is_ongoing": True,
            "event_type": ongoing.event_type,
        }

        # 큐레이터 매칭
        if ongoing.best_comparison_event_id:
            past = await session.get(CrisisEvent, ongoing.best_comparison_event_id)
            if past:
                return {
                    "current_event": current,
                    "comparison_event": {
                        "id": past.id,
                        "name": past.name,
                        "start_date": past.start_date.isoformat(),
                        "end_date": past.end_date.isoformat() if past.end_date else None,
                        "event_type": past.event_type,
                    },
                    "match_type": "curated",
                }

        # 카테고리 폴백 — 같은 유형 중 가장 최근 과거 이벤트
        fallback_q = (
            select(CrisisEvent)
            .where(
                CrisisEvent.event_type == ongoing.event_type,
                CrisisEvent.is_ongoing.is_(False),
                CrisisEvent.id != ongoing.id,
            )
            .order_by(CrisisEvent.start_date.desc())
            .limit(1)
        )
        fallback = (await session.execute(fallback_q)).scalar_one_or_none()
        if fallback:
            return {
                "current_event": current,
                "comparison_event": {
                    "id": fallback.id,
                    "name": fallback.name,
                    "start_date": fallback.start_date.isoformat(),
                    "end_date": fallback.end_date.isoformat() if fallback.end_date else None,
                    "event_type": fallback.event_type,
                },
                "match_type": "category",
            }

    return {"current_event": current, "comparison_event": None, "match_type": "none"}


async def _get_custom_series(start_date: date, indicator_id: int) -> list[dict]:
    """커스텀 시작일 기준 현재까지 지표 데이터 (캐시 1시간)."""
    cache_key = f"custom_{start_date}_{indicator_id}"
    now = datetime.utcnow()

    if cache_key in _custom_cache:
        data, cached_at = _custom_cache[cache_key]
        if (now - cached_at).total_seconds() < _CUSTOM_CACHE_TTL:
            return data

    async with async_session() as session:
        indicator = await session.get(MarketIndicator, indicator_id)
    if not indicator:
        return []

    data_points, _ = await fetch_event_indicator_data(
        event_id=0,
        event_start=start_date,
        ticker=indicator.ticker,
        indicator_id=indicator_id,
        days_before=30,
        days_after=(date.today() - start_date).days + 1,
    )

    _custom_cache[cache_key] = (data_points, now)
    return data_points


async def compare_events(
    event_ids: list[int | str],
    indicator_id: int,
    days: int = 90,
    custom_start_date: Optional[date] = None,
) -> Optional[dict]:
    """복수 이벤트 비교 차트 데이터 반환 (Day 0 기준 상대 변화율)."""
    if len(event_ids) > 3:
        return None  # 최대 3개 제한 (라우터에서 400 반환)

    # 색상 팔레트 (이벤트별 구분색)
    colors = ["#EF4444", "#60A5FA", "#34D399", "#FBBF24", "#A78BFA"]

    async with async_session() as session:
        indicator = await session.get(MarketIndicator, indicator_id)
        if not indicator:
            return None

        series_list = []
        color_idx = 0

        for event_id in event_ids:
            if event_id == "custom" and custom_start_date:
                data_points = await _get_custom_series(custom_start_date, indicator_id)
                series_list.append({
                    "event_id": "custom",
                    "event_name": f"현재 ({custom_start_date.strftime('%Y-%m-%d')}~)",
                    "color": colors[color_idx % len(colors)],
                    "is_ongoing": True,
                    "data_points": [
                        {
                            "day_offset": dp["day_offset"],
                            "change_pct": dp["change_pct_from_event_start"],
                        }
                        for dp in data_points
                        if abs(dp["day_offset"]) <= days
                    ],
                })
                color_idx += 1
                continue

            if not isinstance(event_id, int):
                continue

            event = await session.get(CrisisEvent, event_id)
            if not event:
                continue

            dp_q = (
                select(IndicatorDataPoint)
                .where(
                    IndicatorDataPoint.event_id == event_id,
                    IndicatorDataPoint.indicator_id == indicator_id,
                    IndicatorDataPoint.date >= event.start_date - timedelta(days=30),
                    IndicatorDataPoint.date <= event.start_date + timedelta(days=days),
                )
                .order_by(IndicatorDataPoint.date)
            )
            dps = (await session.execute(dp_q)).scalars().all()

            series_list.append({
                "event_id": event_id,
                "event_name": event.name,
                "color": colors[color_idx % len(colors)],
                "is_ongoing": event.is_ongoing,
                "data_points": [
                    {
                        "day_offset": (dp.date - event.start_date).days,
                        "change_pct": dp.change_pct_from_event_start,
                    }
                    for dp in dps
                ],
            })
            color_idx += 1

    return {
        "indicator": {
            "id": indicator.id,
            "name": indicator.name,
            "unit": indicator.unit,
        },
        "series": series_list,
    }


async def refresh_all_events():
    """APScheduler 월별 갱신: 전체 이벤트 지표 데이터 전체 재적재 + 통계 재계산.

    - 과거 이벤트: ±180일 전체 윈도우를 yfinance에서 다시 받아 UPSERT
    - 진행중 이벤트: 시작일~오늘까지 전체 재적재
    매월 1일 03:00 KST 실행.
    """
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert

    async with async_session() as session:
        events = (await session.execute(select(CrisisEvent))).scalars().all()
        indicators = (await session.execute(select(MarketIndicator))).scalars().all()
        today = date.today()

    total_upserted = 0
    for event in events:
        days_after = (today - event.start_date).days if event.is_ongoing else 180
        for indicator in indicators:
            if indicator.earliest_date > event.start_date + timedelta(days=30):
                # 지표 데이터가 이벤트 발생 이전에 존재하지 않음 → 스킵
                continue
            try:
                data_points, stats = await fetch_event_indicator_data(
                    event_id=event.id,
                    event_start=event.start_date,
                    ticker=indicator.ticker,
                    indicator_id=indicator.id,
                    days_before=30,
                    days_after=days_after,
                )
            except Exception as e:
                logger.warning(f"월간갱신 fetch 실패 [{event.name} / {indicator.name}]: {e}")
                continue

            if not data_points:
                continue

            async with async_session() as session:
                # 기존 데이터 전체 삭제 후 재삽입 (UPSERT)
                from sqlalchemy import delete as sa_delete
                await session.execute(
                    sa_delete(IndicatorDataPoint).where(
                        IndicatorDataPoint.event_id == event.id,
                        IndicatorDataPoint.indicator_id == indicator.id,
                    )
                )
                for dp in data_points:
                    session.add(IndicatorDataPoint(
                        event_id=event.id,
                        indicator_id=indicator.id,
                        date=dp["date"],
                        value=dp["value"],
                        change_pct_from_event_start=dp["change_pct_from_event_start"],
                    ))

                # stats 갱신
                stat_q = await session.execute(
                    select(EventIndicatorStats).where(
                        EventIndicatorStats.event_id == event.id,
                        EventIndicatorStats.indicator_id == indicator.id,
                    )
                )
                existing_stat = stat_q.scalar_one_or_none()
                if existing_stat:
                    existing_stat.max_drawdown_pct = stats["max_drawdown_pct"]
                    existing_stat.max_gain_pct = stats["max_gain_pct"]
                    existing_stat.days_to_bottom = stats["days_to_bottom"]
                    existing_stat.recovery_days = stats["recovery_days"]
                    existing_stat.updated_at = datetime.utcnow()
                else:
                    session.add(EventIndicatorStats(
                        event_id=event.id,
                        indicator_id=indicator.id,
                        max_drawdown_pct=stats["max_drawdown_pct"],
                        max_gain_pct=stats["max_gain_pct"],
                        days_to_bottom=stats["days_to_bottom"],
                        recovery_days=stats["recovery_days"],
                    ))

                await session.commit()
                total_upserted += len(data_points)

        logger.info(f"월간갱신: {event.name} 완료")

    logger.info(f"crisis_service: 전체 이벤트 월간 갱신 완료 — 총 {total_upserted}개 데이터포인트")


async def refresh_ongoing_events():
    """APScheduler 일별 갱신: 진행 중 이벤트 최신 데이터 추가."""
    async with async_session() as session:
        ongoing_q = select(CrisisEvent).where(CrisisEvent.is_ongoing.is_(True))
        ongoing_events = (await session.execute(ongoing_q)).scalars().all()
        indicators = (await session.execute(select(MarketIndicator))).scalars().all()

        for event in ongoing_events:
            for indicator in indicators:
                # 가장 최근 데이터포인트 날짜 확인
                latest_q = (
                    select(IndicatorDataPoint.date)
                    .where(
                        IndicatorDataPoint.event_id == event.id,
                        IndicatorDataPoint.indicator_id == indicator.id,
                    )
                    .order_by(IndicatorDataPoint.date.desc())
                    .limit(1)
                )
                latest_date = (await session.execute(latest_q)).scalar_one_or_none()

                fetch_start = (latest_date + timedelta(days=1)) if latest_date else (date.today() - timedelta(days=7))
                fetch_end = date.today()

                if fetch_start >= fetch_end:
                    continue

                data_points, stats = await fetch_event_indicator_data(
                    event_id=event.id,
                    event_start=event.start_date,
                    ticker=indicator.ticker,
                    indicator_id=indicator.id,
                    days_before=0,
                    days_after=(fetch_end - event.start_date).days + 1,
                )

                for dp in data_points:
                    if latest_date and dp["date"] <= latest_date:
                        continue
                    session.add(IndicatorDataPoint(
                        event_id=event.id,
                        indicator_id=indicator.id,
                        date=dp["date"],
                        value=dp["value"],
                        change_pct_from_event_start=dp["change_pct_from_event_start"],
                    ))

                # stats 업데이트
                stat_result = await session.execute(
                    select(EventIndicatorStats).where(
                        EventIndicatorStats.event_id == event.id,
                        EventIndicatorStats.indicator_id == indicator.id,
                    )
                )
                existing_stat = stat_result.scalar_one_or_none()
                if existing_stat:
                    existing_stat.max_drawdown_pct = stats["max_drawdown_pct"]
                    existing_stat.max_gain_pct = stats["max_gain_pct"]
                    existing_stat.days_to_bottom = stats["days_to_bottom"]
                    existing_stat.recovery_days = stats["recovery_days"]
                    existing_stat.updated_at = datetime.utcnow()

        await session.commit()
        logger.info("crisis_service: 진행중 이벤트 데이터 갱신 완료")
