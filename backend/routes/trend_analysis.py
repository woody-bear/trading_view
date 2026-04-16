"""추세 분석 API — 종목 상세 차트 분석 탭 전용 (024-trend-trading-signals).

FR-013: 기존 스캔·BUY 신호·알림·스케줄러·보호 규칙과 완전 격리.
"""

import asyncio

from fastapi import APIRouter
from loguru import logger

router = APIRouter(tags=["trend-analysis"])


@router.get("/trend-analysis/{symbol}")
async def get_trend_analysis(symbol: str, market: str = "KR"):
    """종목 추세 분류 + 매매 후보 산출. on-demand 전용."""
    from services.trend_analysis import analyze

    try:
        result = await asyncio.to_thread(analyze, symbol, market)
    except Exception as e:
        logger.error(f"추세 분석 실패 [{market}/{symbol}]: {e}")
        from services.trend_analysis import _empty_response, TrendType
        result = _empty_response(symbol, market, TrendType.UNKNOWN)

    return result
