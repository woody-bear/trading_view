"""실시간 가격 조회 API — 배치 + SSE 스트림."""

import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel

router = APIRouter(tags=["prices"])


class BatchPriceRequest(BaseModel):
    symbols: list[dict]  # [{"symbol": "005930", "market": "KR"}, ...]


@router.post("/prices/batch")
async def batch_prices(body: BatchPriceRequest):
    """한투 API로 여러 종목의 현재가를 일괄 조회."""
    from config import get_settings
    from services.kis_client import get_kis_service

    settings = get_settings()
    results: dict[str, dict] = {}

    if not settings.kis_configured:
        return {"prices": results}

    kis = get_kis_service()
    if not kis:
        return {"prices": results}

    for item in body.symbols:
        symbol = item["symbol"]
        market = item.get("market", "KR")
        try:
            data = await asyncio.to_thread(kis.get_quote, symbol)
            if data:
                results[symbol] = data
        except Exception as e:
            logger.debug(f"배치 가격 조회 실패 [{market}/{symbol}]: {e}")

    return {"prices": results}


@router.get("/prices/stream/{symbol}")
async def price_stream(symbol: str, market: str = "KR", request: Request = None):
    """SSE 스트림 — 1초 간격으로 한투 API 현재가 전송 (가격 변동 시에만)."""
    from config import get_settings
    from services.kis_client import get_kis_service

    async def event_generator():
        settings = get_settings()
        if not settings.kis_configured:
            yield f"data: {json.dumps({'error': 'KIS not configured'})}\n\n"
            return

        kis = get_kis_service()
        if not kis:
            yield f"data: {json.dumps({'error': 'KIS init failed'})}\n\n"
            return

        last_price = None
        while True:
            if request and await request.is_disconnected():
                break
            try:
                data = await asyncio.to_thread(kis.get_quote, symbol)
                if data and data.get("price") != last_price:
                    last_price = data["price"]
                    yield f"data: {json.dumps(data)}\n\n"
            except Exception as e:
                logger.debug(f"SSE 가격 조회 실패 [{market}/{symbol}]: {e}")
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
