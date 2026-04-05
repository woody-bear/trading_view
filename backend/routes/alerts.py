"""BUY 신호 알림 관련 API."""

from fastapi import APIRouter, Depends
from loguru import logger
from sqlalchemy import select

from auth import get_current_user
from database import async_session
from models import AlertLog, UserAlertConfig

router = APIRouter(tags=["alerts"])


async def _has_active_telegram_config() -> bool:
    """DB에 활성 텔레그램 설정이 1개 이상 있는지 확인."""
    async with async_session() as session:
        result = await session.execute(
            select(UserAlertConfig).where(
                UserAlertConfig.is_active.is_(True),
                UserAlertConfig.telegram_bot_token.isnot(None),
                UserAlertConfig.telegram_chat_id.isnot(None),
            ).limit(1)
        )
        return result.scalar_one_or_none() is not None


@router.post("/alerts/buy-signal/test")
async def test_buy_alert(_=Depends(get_current_user)):
    """수동으로 BUY 신호 알림을 즉시 전송."""
    if not await _has_active_telegram_config():
        return {"status": "error", "message": "텔레그램 설정을 먼저 완료해주세요 (설정 페이지)"}

    from services.buy_signal_alert import send_scheduled_buy_alert
    result = await send_scheduled_buy_alert()
    return result


@router.post("/alerts/sell-signal/test")
async def test_sell_alert(_=Depends(get_current_user)):
    """수동으로 SELL 신호 체크 알림을 즉시 전송."""
    if not await _has_active_telegram_config():
        return {"status": "error", "message": "텔레그램 설정을 먼저 완료해주세요 (설정 페이지)"}

    from services.sell_signal_alert import send_scheduled_sell_alert
    result = await send_scheduled_sell_alert()
    return result


@router.get("/alerts/history")
async def get_alert_history(alert_type: str = "scheduled_buy", limit: int = 20, _=Depends(get_current_user)):
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
