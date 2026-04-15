"""시장 상태(개장전/장중/장종료/휴장) 엔드포인트."""

from fastapi import APIRouter, Query

from utils.market_hours import get_market_status

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/status")
async def market_status(market: str = Query(..., description="KR | US | CRYPTO")):
    """시장 상태 4분류 반환 (백엔드 타임존 기준)."""
    return get_market_status(market)
