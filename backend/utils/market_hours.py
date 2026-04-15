"""시장별 장 시작·마감 시간 및 영업일/시장상태 판단 유틸리티."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

# 시장별 시간대 및 장 개장/마감 시간
_MARKET_CONFIG = {
    "KR":     {"tz": ZoneInfo("Asia/Seoul"),       "open": time(9, 0),  "close": time(15, 30)},
    "KOSPI":  {"tz": ZoneInfo("Asia/Seoul"),       "open": time(9, 0),  "close": time(15, 30)},
    "KOSDAQ": {"tz": ZoneInfo("Asia/Seoul"),       "open": time(9, 0),  "close": time(15, 30)},
    "US":     {"tz": ZoneInfo("America/New_York"), "open": time(9, 30), "close": time(16, 0)},
    "CRYPTO": {"tz": ZoneInfo("UTC"),              "open": time(0, 0),  "close": time(0, 0)},
}

# 상태 → (라벨, 색상) 매핑
_STATUS_META = {
    "holiday":    ("휴장",       "red"),
    "pre_open":   ("개장전",     "gray"),
    "open":       ("장중",       "green"),
    "closed":     ("장종료",     "blue"),
    "crypto_24h": ("24h 거래중", "purple"),
}


def _get_config(market: str) -> dict:
    return _MARKET_CONFIG.get(market, _MARKET_CONFIG["US"])


def _is_holiday(market: str, d: date) -> bool:
    """공휴일 여부. KR은 KIS 캐시, US는 holidays 라이브러리."""
    # 주말은 공통
    if d.weekday() >= 5:
        return True
    try:
        if market in ("KR", "KOSPI", "KOSDAQ"):
            from services.holiday_cache import is_kr_holiday
            result = is_kr_holiday(d)
            if result is not None:
                return result
            # KIS 캐시 없음 → 주말 체크만 (이미 위에서 False)
            return False
        if market == "US":
            from services.holiday_cache import is_us_holiday
            return is_us_holiday(d)
    except Exception:
        return False
    return False


def get_market_status(market: str) -> dict:
    """현재 시장 상태 4분류 + 라벨/색상 반환.

    Returns:
      {"status": str, "label": str, "color": str, "tz_now": ISO8601}
    """
    cfg = _get_config(market)
    now = datetime.now(cfg["tz"])
    tz_now = now.isoformat()

    if market == "CRYPTO":
        label, color = _STATUS_META["crypto_24h"]
        return {"status": "crypto_24h", "label": label, "color": color, "tz_now": tz_now}

    # 휴장 (주말 + 공휴일)
    if _is_holiday(market, now.date()):
        label, color = _STATUS_META["holiday"]
        return {"status": "holiday", "label": label, "color": color, "tz_now": tz_now}

    t = now.time()
    if t < cfg["open"]:
        status = "pre_open"
    elif t < cfg["close"]:
        status = "open"
    else:
        status = "closed"
    label, color = _STATUS_META[status]
    return {"status": status, "label": label, "color": color, "tz_now": tz_now}


def is_market_open(market: str) -> bool:
    """현재 시각에 해당 시장이 장중인지 판단 (하한/공휴일 반영)."""
    return get_market_status(market)["status"] in ("open", "crypto_24h")


def get_last_complete_date(market: str) -> date:
    """가장 최근 완성된 일봉의 날짜. 장중이면 전 영업일, 장 마감 후면 당일."""
    cfg = _get_config(market)
    now = datetime.now(cfg["tz"])
    today = now.date()

    if market == "CRYPTO":
        utc_now = datetime.now(ZoneInfo("UTC"))
        return utc_now.date() - timedelta(days=1)

    close_time = cfg["close"]

    if now.time() >= close_time and now.weekday() < 5:
        return today
    else:
        return _prev_business_day(today, market)


def is_candle_complete(candle_date: date, market: str) -> bool:
    """특정 날짜의 캔들이 완성되었는지 (장 마감이 지났는지)."""
    last_complete = get_last_complete_date(market)
    return candle_date <= last_complete


def _prev_business_day(d: date, market: str) -> date:
    """주말을 건너뛴 전 영업일. 공휴일은 미처리 (간단 구현)."""
    prev = d - timedelta(days=1)
    while prev.weekday() >= 5:
        prev -= timedelta(days=1)
    return prev
