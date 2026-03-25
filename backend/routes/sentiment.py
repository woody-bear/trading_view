"""시장 방향성 API."""

from fastapi import APIRouter
from loguru import logger

router = APIRouter(tags=["sentiment"])


@router.get("/sentiment/overview")
async def sentiment_overview():
    """시장 방향성 종합 — 공포/탐욕 지수 + 주요 지표."""
    try:
        from services.sentiment_analyzer import get_sentiment_overview
        return await get_sentiment_overview()
    except Exception as e:
        logger.error(f"시장 방향성 조회 실패: {e}")
        return {
            "fear_greed": 50,
            "fear_greed_label": "Neutral",
            "sentiment_summary": "데이터 조회 실패",
            "vix": {"name": "VIX", "value": 0, "change": 0, "change_pct": 0, "direction": "flat"},
            "kospi": {"name": "코스피", "value": 0, "change": 0, "change_pct": 0, "direction": "flat"},
            "sp500": {"name": "S&P 500", "value": 0, "change": 0, "change_pct": 0, "direction": "flat"},
            "nasdaq": {"name": "나스닥", "value": 0, "change": 0, "change_pct": 0, "direction": "flat"},
            "usdkrw": {"name": "USD/KRW", "value": 0, "change": 0, "change_pct": 0, "direction": "flat"},
            "error": str(e),
        }


@router.get("/sentiment/history")
async def sentiment_history():
    """공포/탐욕 지수 30일 추이."""
    try:
        from services.sentiment_analyzer import get_fear_greed_history
        return await get_fear_greed_history(30)
    except Exception as e:
        logger.error(f"공포지수 추이 조회 실패: {e}")
        return {"dates": [], "values": [], "error": str(e)}
