"""국내/해외 휴장일 캐시.

- KR: KIS API `/chk-holiday` (TR CTCA0903R) 로 조회 → 메모리 dict
- US: `holidays` 라이브러리 (NYSE) — 라이브러리 자체가 캐시 성격이라 별도 저장 불필요
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from threading import Lock
from zoneinfo import ZoneInfo

from loguru import logger

# {date(YYYY, M, D): is_open(bool)}
_kr_cache: dict[date, bool] = {}
_kr_loaded_at: datetime | None = None
_kr_lock = Lock()

KST = ZoneInfo("Asia/Seoul")


def is_kr_holiday(d: date) -> bool | None:
    """KR 휴장 여부. 캐시에 없으면 None 반환 (호출측에서 폴백 처리)."""
    is_open = _kr_cache.get(d)
    if is_open is None:
        return None
    return not is_open


def is_us_holiday(d: date) -> bool:
    """US(NYSE) 휴장 여부."""
    try:
        import holidays  # type: ignore
        nyse = holidays.NYSE(years=d.year)
        return d in nyse
    except Exception as e:
        logger.debug(f"US 휴장일 조회 실패: {e}")
        return False


def refresh_kr_holidays() -> int:
    """KIS API로 이번 달 + 다음 달 휴장일 캐시 갱신.

    Returns: 수집된 레코드 수 (0이면 실패 or KIS 미설정)
    """
    global _kr_loaded_at
    try:
        from services.kis_client import get_kis_service
        svc = get_kis_service()
        if svc is None:
            logger.warning("KIS 미설정 — KR 휴장일 캐시 스킵 (주말만 판정)")
            return 0

        today = datetime.now(KST).date()
        bass_dt = today.strftime("%Y%m%d")
        rows = svc.get_domestic_holidays(bass_dt)
        if not rows:
            return 0

        with _kr_lock:
            # 오래된 항목(오늘 이전) 정리 후 갱신
            cutoff = today - timedelta(days=7)
            for k in list(_kr_cache.keys()):
                if k < cutoff:
                    _kr_cache.pop(k, None)

            for row in rows:
                date_str = row.get("date", "")
                if not date_str or len(date_str) != 8:
                    continue
                try:
                    d = date(int(date_str[:4]), int(date_str[4:6]), int(date_str[6:8]))
                except ValueError:
                    continue
                is_open = (row.get("opnd_yn", "N") == "Y")
                _kr_cache[d] = is_open

            _kr_loaded_at = datetime.now(KST)

        logger.info(f"KR 휴장일 캐시 갱신 완료: {len(_kr_cache)}일 보유")
        return len(rows)
    except Exception as e:
        logger.warning(f"KR 휴장일 캐시 갱신 실패: {e}")
        return 0


def get_cache_status() -> dict:
    """디버그용 캐시 상태."""
    return {
        "kr_entries": len(_kr_cache),
        "kr_loaded_at": _kr_loaded_at.isoformat() if _kr_loaded_at else None,
    }
