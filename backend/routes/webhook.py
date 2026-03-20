from fastapi import APIRouter, Header, HTTPException, Request
from loguru import logger

from config import get_settings
from models import SystemLog
from database import async_session

router = APIRouter(tags=["webhook"])


@router.post("/webhook/tradingview")
async def receive_tradingview_webhook(
    request: Request,
    x_tv_webhook_secret: str = Header(None, alias="X-TV-Webhook-Secret"),
):
    settings = get_settings()

    # 시크릿 검증
    if settings.TV_WEBHOOK_SECRET and x_tv_webhook_secret != settings.TV_WEBHOOK_SECRET:
        logger.warning(f"웹훅 시크릿 불일치: {request.client.host}")
        async with async_session() as session:
            session.add(SystemLog(level="WARN", source="webhook", message=f"시크릿 불일치: {request.client.host}"))
            await session.commit()
        raise HTTPException(401, "유효하지 않은 웹훅 시크릿")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(422, "JSON 파싱 실패")

    logger.info(f"TradingView 웹훅 수신: {body}")

    # 수신 로그
    async with async_session() as session:
        session.add(SystemLog(level="INFO", source="webhook", message=f"TV 웹훅 수신: {body.get('symbol', 'unknown')}"))
        await session.commit()

    return {"status": "processed", "received": body}
