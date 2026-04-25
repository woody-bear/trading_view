"""추세선 채널 API 라우터 (033-chart-trendlines).

GET /api/trendline-channels/{symbol}?market=KR
기존 /trend-analysis 엔드포인트와 완전 독립.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter
from loguru import logger

router = APIRouter(tags=["trendline-channels"])


@router.get("/trendline-channels/{symbol}")
async def get_trendline_channels(symbol: str, market: str = "KR") -> dict:
    """4기간(1m/3m/6m/12m) 추세선 채널 반환. 오류 시 빈 periods 반환."""
    from services.trendline_channels import analyze_all_periods

    try:
        return await asyncio.to_thread(analyze_all_periods, symbol, market)
    except Exception as e:
        logger.error(f"trendline_channels API 오류 [{market}/{symbol}]: {e}")
        empty_period = {
            "candle_count": 0,
            "lines": [],
            "current_line_prices": {
                "downtrend_main": None,
                "downtrend_parallel": None,
                "uptrend_main": None,
                "uptrend_parallel": None,
            },
            "phase": {
                "current_stage": 0,
                "steps": [],
                "inflection_times": [],
                "insufficient": True,
                "message": "서비스 오류",
            },
        }
        return {
            "symbol": symbol,
            "market": market,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
            "periods": {p: empty_period for p in ["1m", "3m", "6m", "12m"]},
        }
