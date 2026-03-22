"""BUY 신호 알림 관련 API."""

from fastapi import APIRouter
from loguru import logger
from sqlalchemy import select

from database import async_session
from models import AlertLog

router = APIRouter(tags=["alerts"])


@router.post("/alerts/buy-signal/test")
async def test_buy_alert():
    """수동으로 BUY 신호 알림을 즉시 전송."""
    from config import get_settings
    settings = get_settings()

    if not settings.telegram_configured:
        return {"status": "error", "message": "텔레그램 설정을 먼저 완료해주세요"}

    from services.buy_signal_alert import send_scheduled_buy_alert
    result = await send_scheduled_buy_alert()
    return result


@router.get("/alerts/history")
async def get_alert_history(alert_type: str = "scheduled_buy", limit: int = 20):
    """알림 발송 이력 조회."""
    async with async_session() as session:
        query = (
            select(AlertLog)
            .where(AlertLog.alert_type == alert_type)
            .order_by(AlertLog.sent_at.desc())
            .limit(limit)
        )
        result = await session.execute(query)
        rows = result.scalars().all()

    return {
        "alerts": [
            {
                "id": r.id,
                "sent_at": r.sent_at.isoformat() if r.sent_at else None,
                "alert_type": r.alert_type,
                "success": r.success,
                "error_message": r.error_message,
                "message": r.message,
                "symbol_count": r.symbol_count,
            }
            for r in rows
        ]
    }
