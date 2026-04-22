import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user, get_user_id
from database import get_session as get_db
from models import UserPositionState

router = APIRouter()


class PositionResponse(BaseModel):
    symbol: str
    market: str
    completed_stages: List[int]
    signal_date: Optional[str] = None


class PositionUpdate(BaseModel):
    market: str
    completed_stages: List[int]
    signal_date: Optional[str] = None


@router.get("/position/{symbol}", response_model=PositionResponse)
async def get_position(
    symbol: str,
    market: str = "KR",
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """포지션 가이드 상태 조회."""
    user_id = uuid.UUID(get_user_id(user))

    result = await db.execute(
        select(UserPositionState).where(
            UserPositionState.user_id == user_id,
            UserPositionState.symbol == symbol,
            UserPositionState.market == market,
        )
    )
    state = result.scalar_one_or_none()

    if not state:
        return PositionResponse(symbol=symbol, market=market, completed_stages=[], signal_date=None)

    return PositionResponse(
        symbol=state.symbol,
        market=state.market,
        completed_stages=state.completed_stages or [],
        signal_date=state.signal_date,
    )


@router.put("/position/{symbol}", response_model=PositionResponse)
async def update_position(
    symbol: str,
    body: PositionUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """포지션 가이드 상태 저장."""
    user_id = uuid.UUID(get_user_id(user))

    result = await db.execute(
        select(UserPositionState).where(
            UserPositionState.user_id == user_id,
            UserPositionState.symbol == symbol,
            UserPositionState.market == body.market,
        )
    )
    state = result.scalar_one_or_none()

    if state:
        state.completed_stages = body.completed_stages
        state.signal_date = body.signal_date
    else:
        state = UserPositionState(
            user_id=user_id,
            symbol=symbol,
            market=body.market,
            completed_stages=body.completed_stages,
            signal_date=body.signal_date,
        )
        db.add(state)

    await db.commit()
    await db.refresh(state)
    return PositionResponse(
        symbol=state.symbol,
        market=state.market,
        completed_stages=state.completed_stages or [],
        signal_date=state.signal_date,
    )
