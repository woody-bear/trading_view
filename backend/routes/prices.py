"""실시간 가격 조회 API — 배치 + SSE 스트림."""

import asyncio
import json
import time as _time

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel

router = APIRouter(tags=["prices"])

# 심볼별 (market:symbol → (timestamp, closes)) 메모리 캐시
_sparkline_cache: dict[str, tuple[float, list[float]]] = {}
_SPARKLINE_TTL = 900.0  # 15분


class BatchPriceRequest(BaseModel):
    symbols: list[dict]  # [{"symbol": "005930", "market": "KR"}, ...]


class SparklineRequest(BaseModel):
    symbols: list[dict]  # [{"symbol": "005930", "market": "KR"}, ...]


def _yf_batch_closes(yf_tickers: list[str], sym_map: dict[str, str]) -> dict[str, list[float]]:
    """yfinance 배치 다운로드 → {original_symbol: [종가×최대5개]}."""
    import pandas as pd
    import yfinance as yf

    result: dict[str, list[float]] = {}
    try:
        data = yf.download(yf_tickers, period="25d", interval="1d", progress=False, auto_adjust=True)
        if data is None or data.empty:
            return result

        if isinstance(data.columns, pd.MultiIndex):
            close = data["Close"]
        else:
            close = data.get("Close")
        if close is None:
            return result

        if isinstance(close, pd.Series):
            ticker = yf_tickers[0]
            closes = [round(float(v), 6) for v in close.dropna().tail(10)]
            if closes and ticker in sym_map:
                result[sym_map[ticker]] = closes
        else:
            for ticker in yf_tickers:
                if ticker not in close.columns:
                    continue
                closes = [round(float(v), 6) for v in close[ticker].dropna().tail(10)]
                if closes and ticker in sym_map:
                    result[sym_map[ticker]] = closes
    except Exception as e:
        logger.warning(f"sparkline yfinance 배치 실패: {e}")
    return result


def _pykrx_closes(symbol: str) -> list[float]:
    """pykrx KR 종목 최근 10영업일 종가 반환."""
    try:
        from datetime import datetime, timedelta
        from pykrx import stock
        end = datetime.now().strftime("%Y%m%d")
        start = (datetime.now() - timedelta(days=21)).strftime("%Y%m%d")
        df = stock.get_market_ohlcv(start, end, symbol)
        if df is None or df.empty:
            return []
        return [float(c) for c in df["종가"].tail(10).tolist()]
    except Exception as e:
        logger.warning(f"sparkline pykrx 실패 {symbol}: {e}")
        return []


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


@router.post("/prices/sparkline")
async def batch_sparklines(body: SparklineRequest):
    """최근 5영업일 종가 배열 일괄 반환. 15분 캐시."""
    now = _time.time()
    result: dict[str, list[float]] = {}
    pending_kr: list[str] = []
    pending_us: list[str] = []
    pending_crypto: list[str] = []

    for item in body.symbols:
        sym = item.get("symbol", "")
        market = item.get("market", "KR")
        if not sym:
            continue
        key = f"{market}:{sym}"
        cached = _sparkline_cache.get(key)
        if cached and now - cached[0] < _SPARKLINE_TTL:
            result[sym] = cached[1]
        elif market in ("KR", "KOSPI", "KOSDAQ"):
            pending_kr.append(sym)
        elif market == "CRYPTO":
            pending_crypto.append(sym)
        else:
            pending_us.append(sym)

    # US 배치 (yfinance)
    if pending_us:
        sym_map = {s: s for s in pending_us}
        fetched = await asyncio.to_thread(_yf_batch_closes, pending_us, sym_map)
        for sym, closes in fetched.items():
            _sparkline_cache[f"US:{sym}"] = (now, closes)
            result[sym] = closes

    # CRYPTO 배치 (BTC/USDT → BTC-USDT)
    if pending_crypto:
        yf_tickers = [s.replace("/", "-") for s in pending_crypto]
        sym_map = {yf: orig for yf, orig in zip(yf_tickers, pending_crypto)}
        fetched = await asyncio.to_thread(_yf_batch_closes, yf_tickers, sym_map)
        for sym, closes in fetched.items():
            _sparkline_cache[f"CRYPTO:{sym}"] = (now, closes)
            result[sym] = closes

    # KR 배치 (yfinance .KS suffix, pykrx fallback)
    if pending_kr:
        yf_tickers = [f"{s}.KS" for s in pending_kr]
        sym_map = {f"{s}.KS": s for s in pending_kr}
        fetched = await asyncio.to_thread(_yf_batch_closes, yf_tickers, sym_map)
        for sym, closes in fetched.items():
            _sparkline_cache[f"KR:{sym}"] = (now, closes)
            result[sym] = closes

        # pykrx fallback (yfinance에서 누락된 KR 종목)
        missing = [s for s in pending_kr if s not in result]
        if missing:
            tasks = [asyncio.to_thread(_pykrx_closes, s) for s in missing]
            pykrx_results = await asyncio.gather(*tasks, return_exceptions=True)
            for sym, closes in zip(missing, pykrx_results):
                if isinstance(closes, list) and closes:
                    _sparkline_cache[f"KR:{sym}"] = (now, closes)
                    result[sym] = closes

    return {"sparklines": result}


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
        no_data_streak = 0
        NO_DATA_LIMIT = 10  # 연속 N회 데이터 없으면 장 종료로 판단

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
                    no_data_streak = 0
                    yield f"data: {json.dumps(data)}\n\n"
                elif data is None:
                    no_data_streak += 1
                    if no_data_streak >= NO_DATA_LIMIT:
                        yield f"data: {json.dumps({'error': 'market_closed'})}\n\n"
                        break
            except Exception as e:
                logger.debug(f"SSE 가격 조회 실패 [{market}/{symbol}]: {e}")
                no_data_streak += 1
                if no_data_streak >= NO_DATA_LIMIT:
                    yield f"data: {json.dumps({'error': 'market_closed'})}\n\n"
                    break
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
