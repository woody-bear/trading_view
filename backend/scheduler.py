from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger

from services.scanner import run_scan

scheduler = AsyncIOScheduler()

KST = ZoneInfo("Asia/Seoul")
ET = ZoneInfo("US/Eastern")


def setup_scheduler():
    """10분 간격 자동 스캔 job 등록."""
    scheduler.add_job(
        _scheduled_scan,
        trigger="interval",
        minutes=10,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=60,
        id="signal_scan",
        name="신호 스캔",
    )
    logger.info("스케줄러 등록 완료: 10분 간격 자동 스캔")


async def _scheduled_scan():
    """스케줄러가 호출하는 스캔 함수."""
    active = get_active_markets()
    logger.info(f"자동 스캔 시작 — 활성 시장: {active}")
    result = await run_scan()
    logger.info(f"자동 스캔 완료: {result}")

    # 차트 BUY 신호 스캔 (주봉 기준)
    try:
        from services.chart_scanner import scan_latest_buy
        await scan_latest_buy("1d")
    except Exception as e:
        logger.warning(f"차트 BUY 스캔 실패: {e}")


def is_market_open(market: str) -> bool:
    """시장 개장 여부 판별."""
    now_kst = datetime.now(KST)
    weekday = now_kst.weekday()  # 0=월 ~ 6=일

    if market == "CRYPTO":
        return True

    if market == "KR":
        if weekday >= 5:  # 토/일
            return False
        hour, minute = now_kst.hour, now_kst.minute
        # 09:00 ~ 15:30
        if hour < 9 or (hour == 15 and minute > 30) or hour > 15:
            return False
        return True

    if market == "US":
        now_et = datetime.now(ET)
        weekday_et = now_et.weekday()
        if weekday_et >= 5:
            return False
        hour, minute = now_et.hour, now_et.minute
        # 09:30 ~ 16:00 ET
        if hour < 9 or (hour == 9 and minute < 30) or hour >= 16:
            return False
        return True

    return False


def get_active_markets() -> list[str]:
    """현재 개장 중인 시장 목록."""
    return [m for m in ("KR", "US", "CRYPTO") if is_market_open(m)]
