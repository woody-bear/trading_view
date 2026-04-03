"""
Crisis event seed data script.
Usage: cd backend && source .venv/bin/activate && python scripts/seed_crisis_data.py
"""
import asyncio
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from database import async_session
from models import (
    CrisisEvent,
    EventIndicatorStats,
    IndicatorDataPoint,
    MarketIndicator,
)
from fetchers.crisis_fetcher import INDICATORS, fetch_event_indicator_data
from sqlalchemy import delete, select
from loguru import logger

# 위기 이벤트 시드 데이터 (15개 + 1개 진행중)
CRISIS_EVENTS_SEED = [
    {
        "key": "oil_shock_1973",
        "name": "1973 오일쇼크 (욤키푸르 전쟁)",
        "event_type": "war",
        "start_date": date(1973, 10, 6),
        "end_date": date(1974, 3, 18),
        "is_ongoing": False,
        "severity_level": "critical",
        "description": "이스라엘-아랍 전쟁으로 OPEC 석유 금수조치 발동. S&P500 약 48% 급락, 원유가격 4배 급등. 스태그플레이션 시대 개막.",
    },
    {
        "key": "black_monday_1987",
        "name": "1987 블랙먼데이",
        "event_type": "financial_crisis",
        "start_date": date(1987, 10, 19),
        "end_date": date(1987, 12, 31),
        "is_ongoing": False,
        "severity_level": "high",
        "description": "단일 거래일 최대 낙폭(-22.6%). 프로그램 매매와 포트폴리오 보험 전략이 충격을 증폭. 수주 내 회복.",
    },
    {
        "key": "gulf_war_1990",
        "name": "걸프전 (1990)",
        "event_type": "war",
        "start_date": date(1990, 8, 2),
        "end_date": date(1991, 2, 28),
        "is_ongoing": False,
        "severity_level": "high",
        "description": "이라크의 쿠웨이트 침공. 원유가격 급등, S&P500 약 20% 하락 후 전쟁 종료 시 급반등.",
    },
    {
        "key": "asian_crisis_1997",
        "name": "1997 아시아 금융위기",
        "event_type": "financial_crisis",
        "start_date": date(1997, 7, 2),
        "end_date": date(1998, 12, 31),
        "is_ongoing": False,
        "severity_level": "critical",
        "description": "태국 바트화 폭락으로 시작된 아시아 통화위기. 한국 코스피 -60%, IMF 구제금융. 달러 강세, 신흥국 통화 폭락.",
    },
    {
        "key": "dotcom_bubble_2000",
        "name": "닷컴 버블 붕괴 (2000)",
        "event_type": "financial_crisis",
        "start_date": date(2000, 3, 10),
        "end_date": date(2002, 10, 9),
        "is_ongoing": False,
        "severity_level": "critical",
        "description": "나스닥 -78% 폭락. 인터넷 기업 과대평가 버블 붕괴. 2년 반에 걸친 하락장.",
    },
    {
        "key": "9_11_2001",
        "name": "9/11 테러 (2001)",
        "event_type": "war",
        "start_date": date(2001, 9, 11),
        "end_date": date(2001, 10, 31),
        "is_ongoing": False,
        "severity_level": "high",
        "description": "미국 본토 테러로 뉴욕증시 4일 폐장. 재개장 후 S&P500 주간 -11.6%. 항공·보험 직격, 방산·원유 상승.",
    },
    {
        "key": "financial_crisis_2008",
        "name": "2008 글로벌 금융위기",
        "event_type": "financial_crisis",
        "start_date": date(2008, 9, 15),
        "end_date": date(2009, 3, 9),
        "is_ongoing": False,
        "severity_level": "critical",
        "description": "리먼브라더스 파산. S&P500 -56%, 전 세계 금융시스템 붕괴 위기. 금 상승, 원유 급락 후 반등. 회복까지 4년.",
    },
    {
        "key": "european_debt_2011",
        "name": "유럽 재정위기 (2011)",
        "event_type": "financial_crisis",
        "start_date": date(2011, 5, 1),
        "end_date": date(2012, 7, 31),
        "is_ongoing": False,
        "severity_level": "high",
        "description": "그리스·이탈리아·스페인 국채 금리 급등. ECB 드라기 총재 '무엇이든 하겠다' 발언으로 진정.",
    },
    {
        "key": "covid_crash_2020",
        "name": "코로나19 팬데믹 폭락 (2020)",
        "event_type": "pandemic",
        "start_date": date(2020, 2, 20),
        "end_date": date(2020, 4, 7),
        "is_ongoing": False,
        "severity_level": "critical",
        "description": "코로나19 전 세계 확산. S&P500 33일 만에 -34%, 역대 최단 베어마켓. 각국 대규모 재정·통화 부양으로 V자 회복.",
    },
    {
        "key": "russia_ukraine_2022",
        "name": "러시아-우크라이나 전쟁 (2022)",
        "event_type": "war",
        "start_date": date(2022, 2, 24),
        "end_date": date(2022, 12, 31),
        "is_ongoing": False,
        "severity_level": "high",
        "description": "러시아 우크라이나 전면 침공. 원유·밀·에너지 급등. S&P500 연간 -19%, 인플레이션 가속으로 연준 급격 금리인상.",
    },
    {
        "key": "svb_crisis_2023",
        "name": "실리콘밸리은행 사태 (2023)",
        "event_type": "financial_crisis",
        "start_date": date(2023, 3, 8),
        "end_date": date(2023, 5, 31),
        "is_ongoing": False,
        "severity_level": "moderate",
        "description": "SVB·시그니처뱅크 파산. 지역은행 위기. FDIC 긴급 보증 후 진정. 금·국채 급등, 기술주 변동성 확대.",
    },
    {
        "key": "tariff_war_2025",
        "name": "미-중 관세 전쟁 (2025)",
        "event_type": "financial_crisis",
        "start_date": date(2025, 4, 2),
        "end_date": None,
        "is_ongoing": False,
        "severity_level": "high",
        "description": "트럼프 상호관세 145% 발표. S&P500 수일 내 -10% 급락, 이후 90일 유예 발표로 반등. 달러 약세, 금 사상최고가.",
    },
    {
        "key": "brexit_2016",
        "name": "브렉시트 국민투표 (2016)",
        "event_type": "financial_crisis",
        "start_date": date(2016, 6, 23),
        "end_date": date(2016, 7, 31),
        "is_ongoing": False,
        "severity_level": "moderate",
        "description": "영국 EU 탈퇴 결정. 파운드 -8%, 글로벌 증시 -5% 급락 후 2주 내 대부분 회복. 유럽 불확실성 장기화.",
    },
    {
        "key": "korea_war_1950",
        "name": "한국전쟁 (1950)",
        "event_type": "war",
        "start_date": date(1950, 6, 25),
        "end_date": date(1953, 7, 27),
        "is_ongoing": False,
        "severity_level": "critical",
        "description": "북한의 남침으로 한반도 전면전. 미국·UN 참전. S&P500 단기 급락 후 회복. 방산·원자재 수요 증가.",
    },
    {
        "key": "iran_us_2025",
        "name": "이란-미국 갈등 (2025)",
        "event_type": "war",
        "start_date": date(2025, 6, 1),
        "end_date": None,
        "is_ongoing": True,
        "severity_level": "high",
        "description": "미국과 이란 간 군사적 긴장 고조. 호르무즈 해협 위협, 원유 공급 불안. 현재 진행 중.",
        "best_comparison_key": "oil_shock_1973",
    },
]

DAYS_BEFORE = 30
DAYS_AFTER = 180


async def seed_market_indicators(session) -> dict[str, int]:
    """market_indicator 테이블 시드. 반환: ticker → id 매핑."""
    existing = (await session.execute(select(MarketIndicator))).scalars().all()
    existing_tickers = {ind.ticker for ind in existing}

    ticker_to_id = {ind.ticker: ind.id for ind in existing}

    for ind_data in INDICATORS:
        if ind_data["ticker"] not in existing_tickers:
            indicator = MarketIndicator(
                name=ind_data["name"],
                category=ind_data["category"],
                ticker=ind_data["ticker"],
                unit=ind_data["unit"],
                earliest_date=date.fromisoformat(ind_data["earliest_date"]),
            )
            session.add(indicator)
            await session.flush()
            ticker_to_id[ind_data["ticker"]] = indicator.id
            logger.info(f"  MarketIndicator 추가: {ind_data['name']} ({ind_data['ticker']})")

    return ticker_to_id


async def seed_events(session) -> dict[str, int]:
    """crisis_event 테이블 시드 (best_comparison_event_id 제외). 반환: key → id 매핑."""
    existing = (await session.execute(select(CrisisEvent))).scalars().all()
    existing_names = {e.name for e in existing}
    key_to_id = {e.name: e.id for e in existing}

    # key 매핑을 위해 name → key 역매핑
    name_to_key = {ev["name"]: ev["key"] for ev in CRISIS_EVENTS_SEED}
    for e in existing:
        k = name_to_key.get(e.name)
        if k:
            key_to_id[k] = e.id

    for ev in CRISIS_EVENTS_SEED:
        if ev["name"] not in existing_names:
            event = CrisisEvent(
                name=ev["name"],
                event_type=ev["event_type"],
                start_date=ev["start_date"],
                end_date=ev.get("end_date"),
                is_ongoing=ev.get("is_ongoing", False),
                description=ev["description"],
                severity_level=ev["severity_level"],
                created_at=datetime.utcnow(),
            )
            session.add(event)
            await session.flush()
            key_to_id[ev["key"]] = event.id
            logger.info(f"  CrisisEvent 추가: {ev['name']}")

    return key_to_id


async def update_best_comparisons(session, key_to_id: dict[str, int]):
    """best_comparison_event_id 업데이트."""
    for ev in CRISIS_EVENTS_SEED:
        best_key = ev.get("best_comparison_key")
        if best_key and ev["key"] in key_to_id and best_key in key_to_id:
            result = await session.execute(select(CrisisEvent).where(CrisisEvent.id == key_to_id[ev["key"]]))
            event = result.scalar_one_or_none()
            if event and event.best_comparison_event_id is None:
                event.best_comparison_event_id = key_to_id[best_key]
                logger.info(f"  best_comparison 설정: {ev['name']} → {best_key}")


async def seed_indicator_data(session, key_to_id: dict[str, int], ticker_to_id: dict[str, int]):
    """각 이벤트의 지표 데이터 적재."""
    indicators = (await session.execute(select(MarketIndicator))).scalars().all()
    events = (await session.execute(select(CrisisEvent))).scalars().all()

    name_to_key = {ev["name"]: ev["key"] for ev in CRISIS_EVENTS_SEED}

    for event in events:
        key = name_to_key.get(event.name)
        if not key:
            continue

        # 이미 데이터 있으면 스킵
        existing_count_result = await session.execute(
            select(IndicatorDataPoint).where(IndicatorDataPoint.event_id == event.id).limit(1)
        )
        if existing_count_result.scalar_one_or_none() is not None:
            logger.info(f"  스킵 (이미 데이터 있음): {event.name}")
            continue

        logger.info(f"  데이터 적재 중: {event.name} ({event.start_date})")
        for indicator in indicators:
            # 지표 시작일 이전 이벤트는 데이터 없음 처리
            indicator_earliest = indicator.earliest_date
            event_start = event.start_date
            if event_start < indicator_earliest - timedelta(days=DAYS_BEFORE + 30):
                logger.info(f"    {indicator.ticker}: 데이터 없음 (이벤트={event_start}, 지표시작={indicator_earliest})")
                continue

            data_points, stats = await fetch_event_indicator_data(
                event_id=event.id,
                event_start=event_start,
                ticker=indicator.ticker,
                indicator_id=indicator.id,
                days_before=DAYS_BEFORE,
                days_after=DAYS_AFTER,
            )

            if not data_points:
                logger.info(f"    {indicator.ticker}: 빈 데이터")
                continue

            for dp in data_points:
                session.add(IndicatorDataPoint(
                    event_id=event.id,
                    indicator_id=indicator.id,
                    date=dp["date"],
                    value=dp["value"],
                    change_pct_from_event_start=dp["change_pct_from_event_start"],
                ))

            # stats 저장
            stat_result = await session.execute(
                select(EventIndicatorStats).where(
                    EventIndicatorStats.event_id == event.id,
                    EventIndicatorStats.indicator_id == indicator.id,
                )
            )
            existing_stat = stat_result.scalar_one_or_none()
            if existing_stat is None:
                session.add(EventIndicatorStats(
                    event_id=event.id,
                    indicator_id=indicator.id,
                    max_drawdown_pct=stats["max_drawdown_pct"],
                    max_gain_pct=stats["max_gain_pct"],
                    days_to_bottom=stats["days_to_bottom"],
                    recovery_days=stats["recovery_days"],
                    updated_at=datetime.utcnow(),
                ))
            logger.info(f"    {indicator.ticker}: {len(data_points)}개 데이터포인트 저장")

        await session.commit()
        logger.info(f"  완료: {event.name}")


async def main():
    logger.info("=== Crisis Event Seed 시작 ===")
    async with async_session() as session:
        async with session.begin():
            ticker_to_id = await seed_market_indicators(session)
            key_to_id = await seed_events(session)
            await update_best_comparisons(session, key_to_id)

        await seed_indicator_data(session, key_to_id, ticker_to_id)

    logger.info("=== Crisis Event Seed 완료 ===")


if __name__ == "__main__":
    asyncio.run(main())
