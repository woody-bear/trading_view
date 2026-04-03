from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger

from services.scanner import run_scan

scheduler = AsyncIOScheduler()

KST = ZoneInfo("Asia/Seoul")
ET = ZoneInfo("US/Eastern")


def setup_scheduler():
    """10분 간격 자동 스캔 + 정기 BUY 알림 job 등록."""
    scheduler.add_job(
        _scheduled_scan,
        trigger="interval",
        minutes=10,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=60,
        id="signal_scan",
        name="신호 스캔",
        replace_existing=True,
    )

    # 국내주식 BUY 신호 텔레그램 알림 — 평일 10:30, 15:00 KST
    scheduler.add_job(
        _scheduled_buy_alert,
        trigger="cron",
        hour=10, minute=30,
        day_of_week="mon-fri",
        timezone=KST,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
        id="buy_alert_1030",
        name="BUY 알림 10:30",
        replace_existing=True,
    )
    scheduler.add_job(
        _scheduled_buy_alert,
        trigger="cron",
        hour=15, minute=0,
        day_of_week="mon-fri",
        timezone=KST,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
        id="buy_alert_1500",
        name="BUY 알림 15:00",
        replace_existing=True,
    )

    # 국내 시장 스캔 — 평일 매시 :30 (9:30~15:30 KST) · 코스피200+코스닥150+KRX섹터 (~351종목)
    scheduler.add_job(
        _scheduled_full_market_scan_kr,
        trigger="cron",
        hour="9,10,11,12,13,14,15",
        minute=30,
        day_of_week="mon-fri",
        timezone=KST,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=600,
        id="full_market_scan_kr",
        name="국내 시장 스캔 (KR)",
        replace_existing=True,
    )

    # 미국 시장 스캔 — KST 19:50, 03:50 · S&P500+나스닥100+암호화폐 (~522종목)
    scheduler.add_job(
        _scheduled_full_market_scan_us,
        trigger="cron",
        hour=19, minute=50,
        day_of_week="mon-fri",
        timezone=KST,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=600,
        id="full_market_scan_us_evening",
        name="미국 시장 스캔 (저녁)",
        replace_existing=True,
    )
    scheduler.add_job(
        _scheduled_full_market_scan_us,
        trigger="cron",
        hour=3, minute=50,
        day_of_week="tue-sat",  # 월밤~금밤 미국장 = 화~토 새벽
        timezone=KST,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=600,
        id="full_market_scan_us_dawn",
        name="미국 시장 스캔 (새벽)",
        replace_existing=True,
    )

    # 미국 시장 BUY 신호 알림 — KST 20:00, 04:00 (스캔 완료 후)
    scheduler.add_job(
        _scheduled_buy_alert,
        trigger="cron",
        hour=20, minute=0,
        day_of_week="mon-fri",
        timezone=KST,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
        id="buy_alert_us_2000",
        name="미국 BUY 알림 20:00",
        replace_existing=True,
    )
    scheduler.add_job(
        _scheduled_buy_alert,
        trigger="cron",
        hour=4, minute=0,
        day_of_week="tue-sat",
        timezone=KST,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
        id="buy_alert_us_0400",
        name="미국 BUY 알림 04:00",
        replace_existing=True,
    )

    # 관심종목 KR SELL 체크 — 국내 장중 30분마다 (평일 09:00~15:30 KST)
    scheduler.add_job(
        _scheduled_sell_alert_kr,
        trigger="cron",
        hour="9,10,11,12,13,14,15",
        minute="0,30",
        day_of_week="mon-fri",
        timezone=KST,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=120,
        id="sell_alert_kr",
        name="KR SELL 체크 (30분마다)",
        replace_existing=True,
    )

    # 관심종목 US SELL 체크 — KST 20:00, 04:00 (미국장 전후)
    scheduler.add_job(
        _scheduled_sell_alert_us,
        trigger="cron",
        hour=20, minute=0,
        day_of_week="mon-fri",
        timezone=KST,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
        id="sell_alert_us_2000",
        name="US SELL 체크 20:00",
        replace_existing=True,
    )
    scheduler.add_job(
        _scheduled_sell_alert_us,
        trigger="cron",
        hour=4, minute=0,
        day_of_week="tue-sat",
        timezone=KST,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
        id="sell_alert_us_0400",
        name="US SELL 체크 04:00",
        replace_existing=True,
    )

    # 위기 이벤트 진행중 데이터 일별 갱신 — 새벽 2시 KST
    scheduler.add_job(
        _scheduled_crisis_refresh,
        trigger="cron",
        hour=2, minute=0,
        timezone=KST,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
        id="crisis_refresh",
        name="위기 이벤트 데이터 갱신",
        replace_existing=True,
    )

    # 위기 이벤트 전체 데이터 월별 갱신 — 매월 1일 03:00 KST
    scheduler.add_job(
        _scheduled_crisis_monthly_refresh,
        trigger="cron",
        day=1, hour=3, minute=0,
        timezone=KST,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=7200,
        id="crisis_monthly_refresh",
        name="위기 이벤트 월간 전체 갱신",
        replace_existing=True,
    )

    logger.info("스케줄러 등록 완료: 10분 스캔 + KR BUY (10:30/15:00) + US BUY (20:00/04:00) + KR SELL (30분) + US SELL (20:00/04:00) + 국내스캔(9:30~15:30) + 미국스캔(19:50/03:50) + 위기이벤트갱신(02:00) + 위기이벤트월간갱신(매월1일03:00)")


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


async def _scheduled_buy_alert():
    """스케줄러가 호출하는 BUY 신호 텔레그램 알림."""
    from services.buy_signal_alert import send_scheduled_buy_alert
    logger.info("정기 BUY 신호 알림 시작")
    result = await send_scheduled_buy_alert()
    logger.info(f"정기 BUY 신호 알림 완료: {result}")


async def _scheduled_sell_alert_kr():
    """KR 관심종목 SELL 체크 — 장중 30분마다."""
    from services.sell_signal_alert import send_scheduled_sell_alert
    logger.info("KR 관심종목 SELL 체크 시작")
    result = await send_scheduled_sell_alert(market="KR")
    logger.info(f"KR SELL 체크 완료: {result}")


async def _scheduled_sell_alert_us():
    """US 관심종목 SELL 체크 — KST 20:00/04:00."""
    from services.sell_signal_alert import send_scheduled_sell_alert
    logger.info("US 관심종목 SELL 체크 시작")
    result = await send_scheduled_sell_alert(market="US")
    logger.info(f"US SELL 체크 완료: {result}")


async def _scheduled_full_market_scan_kr():
    """국내 시장 스캔 — 코스피200 + 코스닥150 + KRX섹터 (~351종목)."""
    from services.full_market_scanner import run_full_scan
    logger.info("국내 시장 스캔 시작 (KR)")
    result = await run_full_scan(markets=["KR"])
    logger.info(f"국내 시장 스캔 완료: {result.get('status')} — {result.get('scanned', 0)}개 분석")


async def _scheduled_full_market_scan_us():
    """미국+암호화폐 스캔 — S&P500 + 나스닥100 + 암호화폐 (~522종목)."""
    from services.full_market_scanner import run_full_scan
    logger.info("미국 시장 스캔 시작 (US+CRYPTO)")
    result = await run_full_scan(markets=["US", "CRYPTO"])
    logger.info(f"미국 시장 스캔 완료: {result.get('status')} — {result.get('scanned', 0)}개 분석")


async def _scheduled_crisis_refresh():
    """진행 중인 위기 이벤트 지표 데이터 일별 갱신."""
    from services.crisis_service import refresh_ongoing_events
    logger.info("위기 이벤트 데이터 갱신 시작")
    await refresh_ongoing_events()
    logger.info("위기 이벤트 데이터 갱신 완료")


async def _scheduled_crisis_monthly_refresh():
    """전체 위기 이벤트 지표 데이터 월별 전체 갱신 (매월 1일 03:00 KST)."""
    from services.crisis_service import refresh_all_events
    logger.info("위기 이벤트 월간 전체 갱신 시작")
    await refresh_all_events()
    logger.info("위기 이벤트 월간 전체 갱신 완료")


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
