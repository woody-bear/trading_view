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


@router.get("/stocks/{symbol}/detail")
async def stock_detail(symbol: str, market: str = "KR"):
    """종목 투자지표 + 기업정보 + 위험상태 + 가격제한 통합 조회."""
    from config import get_settings
    from services.kis_client import get_kis_service

    settings = get_settings()
    if not settings.kis_configured:
        return {"status": "unavailable", "reason": "kis_not_configured"}

    if market == "CRYPTO":
        return {"status": "unavailable", "reason": "not_supported"}

    kis = get_kis_service()
    if not kis:
        return {"status": "unavailable", "reason": "kis_init_failed"}

    data = await asyncio.to_thread(kis.get_stock_detail, symbol)
    if not data:
        return {"status": "unavailable", "reason": "api_error"}

    return data


@router.get("/stocks/{symbol}/orderbook")
async def stock_orderbook(symbol: str, market: str = "KR"):
    """매도/매수 호가 조회."""
    from config import get_settings
    from services.kis_client import get_kis_service

    settings = get_settings()
    if not settings.kis_configured:
        return {"status": "unavailable", "reason": "kis_not_configured"}

    if market in ("CRYPTO", "US"):
        return {"status": "unavailable", "reason": "not_supported"}

    kis = get_kis_service()
    if not kis:
        return {"status": "unavailable", "reason": "kis_init_failed"}

    data = await asyncio.to_thread(kis.get_orderbook, symbol)
    if not data:
        return {"status": "unavailable", "reason": "api_error"}

    return data


@router.get("/prices/stream/{symbol}")
async def price_stream(symbol: str, market: str = "KR", request: Request = None):
    """SSE 스트림 — 1초 간격으로 한투 API 현재가 전송 (가격 변동 시에만)."""
    from config import get_settings
    from services.kis_client import get_kis_service

    async def event_generator():
        settings = get_settings()
        kis = get_kis_service() if settings.kis_configured else None

        # US는 KIS 없어도 yfinance로 동작 가능. KR은 KIS 필수.
        if market != "US" and not kis:
            reason = "KIS not configured" if not settings.kis_configured else "KIS init failed"
            yield f"data: {json.dumps({'error': reason})}\n\n"
            return

        # 폴링 주기: yfinance는 15초 캐시라 더 자주 쏴도 의미 없고, 보수적으로 2초
        interval = 2.0 if market == "US" else 1.0

        last_price = None
        last_yf_attempt = 0.0
        while True:
            if request and await request.is_disconnected():
                break
            try:
                data = None
                # US: 프리/애프터마켓이면 yfinance 우선. 정규장/휴장이면 None 반환 → KIS 폴백.
                if market == "US":
                    from services.yfinance_extended import get_us_extended_quote
                    import time as _t
                    # 연속 실패·None 응답 시 매번 yfinance 때리지 않도록 최소 3초 간격 강제
                    if _t.time() - last_yf_attempt >= 3.0:
                        data = await asyncio.to_thread(get_us_extended_quote, symbol)
                        last_yf_attempt = _t.time()

                # yfinance None(정규장/휴장·에러) + KIS 있으면 KIS
                if data is None and kis is not None:
                    data = await asyncio.to_thread(kis.get_quote, symbol)

                if data and data.get("price") != last_price:
                    last_price = data["price"]
                    yield f"data: {json.dumps(data)}\n\n"
            except Exception as e:
                logger.debug(f"SSE 가격 조회 실패 [{market}/{symbol}]: {e}")
            await asyncio.sleep(interval)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
