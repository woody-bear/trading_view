import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user, get_optional_user, get_user_id
from database import get_session
from models import Watchlist
from services.symbol_validator import validate_symbol

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


class WatchlistCreate(BaseModel):
    market: str
    symbol: str
    timeframe: str = "1h"
    data_source: str = "auto"


class WatchlistUpdate(BaseModel):
    timeframe: Optional[str] = None
    is_active: Optional[bool] = None
    data_source: Optional[str] = None


@router.get("")
async def list_watchlist(
    market: Optional[str] = None,
    is_active: Optional[bool] = None,
    session: AsyncSession = Depends(get_session),
    user: Optional[dict] = Depends(get_optional_user),
):
    if not user:
        return {"items": [], "total": 0}

    user_id = uuid.UUID(get_user_id(user))
    query = select(Watchlist).where(Watchlist.user_id == user_id)
    if market:
        query = query.where(Watchlist.market == market)
    if is_active is not None:
        query = query.where(Watchlist.is_active.is_(is_active))

    result = await session.execute(query)
    items = result.scalars().all()
    return {
        "items": [_to_dict(i) for i in items],
        "total": len(items),
    }


@router.post("", status_code=201)
async def create_watchlist(
    body: WatchlistCreate,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    if body.market not in ("KR", "US", "CRYPTO"):
        raise HTTPException(400, "market은 KR, US, CRYPTO 중 하나여야 합니다")
    if body.timeframe not in ("15m", "30m", "1h", "4h", "1d", "1w"):
        raise HTTPException(400, "지원하지 않는 타임프레임입니다")

    user_id = uuid.UUID(get_user_id(user))

    # 중복 체크 (사용자별)
    existing = await session.execute(
        select(Watchlist).where(
            Watchlist.user_id == user_id,
            Watchlist.market == body.market,
            Watchlist.symbol == body.symbol,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"이미 등록된 종목입니다: {body.market}/{body.symbol}")

    # 유효성 검증
    info = await validate_symbol(body.market, body.symbol)
    if info is None:
        raise HTTPException(400, f"종목 '{body.symbol}'을(를) 찾을 수 없습니다")

    item = Watchlist(
        user_id=user_id,
        market=body.market,
        symbol=body.symbol,
        display_name=info.get("display_name"),
        timeframe=body.timeframe,
        data_source=body.data_source,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)

    # 추가 직후 첫 스캔 실행 (current_signal 생성)
    try:
        from services.scanner import run_scan
        await run_scan([item.id])
    except Exception:
        pass  # 실패해도 종목 추가는 성공

    return _to_dict(item)


@router.patch("/{item_id}")
async def update_watchlist(
    item_id: int,
    body: WatchlistUpdate,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(get_user_id(user))
    item = await session.get(Watchlist, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(404, "종목 없음")

    if body.timeframe is not None:
        item.timeframe = body.timeframe
    if body.is_active is not None:
        item.is_active = body.is_active
    if body.data_source is not None:
        item.data_source = body.data_source

    await session.commit()
    await session.refresh(item)
    return _to_dict(item)


@router.delete("/{item_id}", status_code=204)
async def delete_watchlist(
    item_id: int,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(get_user_id(user))
    item = await session.get(Watchlist, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(404, "종목 없음")
    await session.delete(item)
    await session.commit()


def _to_dict(w: Watchlist) -> dict:
    return {
        "id": w.id,
        "market": w.market,
        "symbol": w.symbol,
        "display_name": w.display_name,
        "timeframe": w.timeframe,
        "data_source": w.data_source,
        "is_active": w.is_active,
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }
