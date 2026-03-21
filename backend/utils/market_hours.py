"""시장별 장 마감 시간 및 영업일 판단 유틸리티."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

# 시장별 시간대 및 장 마감 시간
_MARKET_CONFIG = {
    "KR": {"tz": ZoneInfo("Asia/Seoul"), "close": time(15, 30)},
    "KOSPI": {"tz": ZoneInfo("Asia/Seoul"), "close": time(15, 30)},
    "KOSDAQ": {"tz": ZoneInfo("Asia/Seoul"), "close": time(15, 30)},
    "US": {"tz": ZoneInfo("America/New_York"), "close": time(16, 0)},
    "CRYPTO": {"tz": ZoneInfo("UTC"), "close": time(0, 0)},
}


def _get_config(market: str) -> dict:
    return _MARKET_CONFIG.get(market, _MARKET_CONFIG["US"])


def is_market_open(market: str) -> bool:
    """현재 시각에 해당 시장이 장중(또는 장 마감 전)인지 판단."""
    cfg = _get_config(market)
    now = datetime.now(cfg["tz"])

    if market == "CRYPTO":
        return True  # 24시간 거래, 항상 "장중"으로 간주하여 당일 캔들 미완성 처리

    # 주말 체크
    if now.weekday() >= 5:
        return False

    close_time = cfg["close"]
    return now.time() < close_time


def get_last_complete_date(market: str) -> date:
    """가장 최근 완성된 일봉의 날짜. 장중이면 전 영업일, 장 마감 후면 당일."""
    cfg = _get_config(market)
    now = datetime.now(cfg["tz"])
    today = now.date()

    if market == "CRYPTO":
        # 암호화폐: UTC 00:00 기준, 현재 UTC 날짜의 전일이 마지막 완성 캔들
        utc_now = datetime.now(ZoneInfo("UTC"))
        return utc_now.date() - timedelta(days=1)

    close_time = cfg["close"]

    if now.time() >= close_time and now.weekday() < 5:
        # 장 마감 후 → 당일 캔들 완성
        return today
    else:
        # 장중 또는 장 시작 전 → 전 영업일
        return _prev_business_day(today, market)


def is_candle_complete(candle_date: date, market: str) -> bool:
    """특정 날짜의 캔들이 완성되었는지 (장 마감이 지났는지)."""
    last_complete = get_last_complete_date(market)
    return candle_date <= last_complete


def _prev_business_day(d: date, market: str) -> date:
    """주말을 건너뛴 전 영업일. 공휴일은 미처리 (간단 구현)."""
    prev = d - timedelta(days=1)
    while prev.weekday() >= 5:  # 토(5), 일(6)
        prev -= timedelta(days=1)
    return prev
