"""한국투자증권 Open API 클라이언트 — 인증 + REST 현재가 조회."""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING

from loguru import logger

from config import get_settings

if TYPE_CHECKING:
    from pykis import PyKis

_lock = threading.Lock()
_instance: KISService | None = None


class KISService:
    """한투 API 싱글턴 서비스."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.kis_configured:
            raise RuntimeError("KIS API 키가 설정되지 않았습니다")

        from pykis import KisAuth, PyKis

        account_no = settings.KIS_ACCOUNT_NO or "00000000-01"
        # 계좌번호 형식 검증: 8자리숫자-2자리숫자
        if not account_no[0].isdigit():
            account_no = "00000000-01"  # placeholder → 더미 계좌 (현재가 조회만 가능)
            logger.warning("계좌번호 미설정 — 더미 계좌로 초기화 (현재가 조회만 가능)")

        hts_id = account_no.replace("-", "")[:8]

        auth = KisAuth(
            id=hts_id,
            account=account_no,
            appkey=settings.KIS_APP_KEY,
            secretkey=settings.KIS_APP_SECRET,
            virtual=settings.KIS_PAPER_TRADING,
        )

        # virtual=True면 두 번째 인자(virtual_auth), False면 첫 번째(auth)
        if settings.KIS_PAPER_TRADING:
            self.kis: PyKis = PyKis(None, auth, keep_token=True)
        else:
            self.kis = PyKis(auth, keep_token=True)

        logger.info(
            f"한투 API 초기화 완료 (모의투자: {settings.KIS_PAPER_TRADING})"
        )

    def get_quote(self, symbol: str) -> dict | None:
        """REST API로 국내 주식 현재가 조회."""
        try:
            stock = self.kis.stock(symbol)
            quote = stock.quote()
            prev = quote.prev_price or quote.price
            change_pct = ((quote.price - prev) / prev * 100) if prev else 0
            return {
                "price": float(quote.price),
                "open": float(quote.open or quote.price),
                "high": float(quote.high or quote.price),
                "low": float(quote.low or quote.price),
                "volume": float(quote.volume or 0),
                "change_pct": round(float(change_pct), 2),
            }
        except Exception as e:
            logger.debug(f"한투 REST 현재가 조회 실패 [{symbol}]: {e}")
            return None


def get_kis_service() -> KISService | None:
    """KIS 서비스 싱글턴 반환. 미설정 시 None."""
    global _instance
    if _instance is not None:
        return _instance
    settings = get_settings()
    if not settings.kis_configured:
        return None
    with _lock:
        if _instance is None:
            try:
                _instance = KISService()
            except Exception as e:
                logger.error(f"한투 API 초기화 실패: {e}")
                return None
    return _instance


def reset_kis_service() -> None:
    """설정 변경 시 인스턴스 재생성용."""
    global _instance
    _instance = None
