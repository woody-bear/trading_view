from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_session
from models import SystemLog, UserAlertConfig, Watchlist
from scheduler import get_active_markets

router = APIRouter(tags=["system"])


@router.get("/system/health")
async def health(session: AsyncSession = Depends(get_session)):
    settings = get_settings()
    active_count = await session.scalar(select(func.count()).select_from(Watchlist).where(Watchlist.is_active.is_(True)))
    error_count = await session.scalar(
        select(func.count()).select_from(SystemLog).where(SystemLog.level == "ERROR")
    )
    telegram_count = await session.scalar(
        select(func.count()).select_from(UserAlertConfig).where(
            UserAlertConfig.is_active.is_(True),
            UserAlertConfig.telegram_bot_token.isnot(None),
            UserAlertConfig.telegram_chat_id.isnot(None),
        )
    )
    markets = get_active_markets()
    return {
        "status": "healthy",
        "active_symbols": active_count or 0,
        "active_markets": markets,
        "errors_total": error_count or 0,
        "telegram_configured": (telegram_count or 0) > 0,
    }


@router.get("/system/logs")
async def get_logs(
    level: str | None = None,
    page: int = 1,
    per_page: int = 50,
    session: AsyncSession = Depends(get_session),
):
    query = select(SystemLog).order_by(SystemLog.created_at.desc())
    if level:
        query = query.where(SystemLog.level == level)
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await session.execute(query)
    logs = result.scalars().all()
    return {
        "items": [{"id": l.id, "level": l.level, "source": l.source, "message": l.message,
                    "details": l.details, "created_at": l.created_at.isoformat()} for l in logs],
        "page": page, "per_page": per_page,
    }
