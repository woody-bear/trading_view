"""실시간 가격 피드 — 활성 워치리스트 종목의 현재가를 주기적으로 fetch하여 WebSocket 브로드캐스트."""

import asyncio
from datetime import datetime

from loguru import logger
from sqlalchemy import select

from database import async_session
from models import CurrentSignal, Watchlist
from scheduler import is_market_open

_running = False
_task: asyncio.Task | None = None

# 가격 갱신 주기 (초)
FEED_INTERVAL = 5


async def _fetch_kr_price(symbol: str) -> dict | None:
    """한국 주식 실시간 시세 조회 — 한투 WebSocket > 한투 REST > pykrx fallback."""
    # 1순위: 한투 WebSocket 캐시 (실시간, 초 단위)
    from services import kis_websocket

    cached = kis_websocket.get_cached_price(symbol)
    if cached:
        return cached

    # 2순위: 한투 REST API
    from config import get_settings

    settings = get_settings()
    if settings.kis_configured:
        from services.kis_client import get_kis_service

        kis = get_kis_service()
        if kis:
            data = await asyncio.to_thread(kis.get_quote, symbol)
            if data:
                return data

    # 3순위: pykrx (수 분 지연, 무료 fallback)
    return await _fetch_kr_price_pykrx(symbol)


async def _fetch_kr_price_pykrx(symbol: str) -> dict | None:
    """pykrx로 한국 주식 시세 조회 (fallback)."""
    try:
        from pykrx import stock
        today = datetime.now().strftime("%Y%m%d")
        data = await asyncio.to_thread(stock.get_market_ohlcv, today, today, symbol)
        if data is None or data.empty:
            return None
        row = data.iloc[-1]
        return {
            "price": float(row["종가"]),
            "open": float(row["시가"]),
            "high": float(row["고가"]),
            "low": float(row["저가"]),
            "volume": float(row["거래량"]),
            "change_pct": float(row["등락률"]),
        }
    except Exception as e:
        logger.debug(f"KR/{symbol} pykrx 가격 실패: {e}")
        return None


async def _fetch_us_price(symbol: str) -> dict | None:
    """미국 주식 현재가 조회 — 한투 REST > yfinance fallback."""
    # 1순위: 한투 REST API
    from config import get_settings

    settings = get_settings()
    if settings.kis_configured:
        from services.kis_client import get_kis_service

        kis = get_kis_service()
        if kis:
            data = await asyncio.to_thread(kis.get_quote, symbol)
            if data:
                return data

    # 2순위: yfinance (fallback)
    return await _fetch_us_price_yfinance(symbol)


async def _fetch_us_price_yfinance(symbol: str) -> dict | None:
    """yfinance fast_info로 미국 주식 현재가 조회 (fallback)."""
    try:
        import yfinance as yf
        def _get():
            t = yf.Ticker(symbol)
            info = t.fast_info
            price = info.get("lastPrice") or info.get("last_price")
            prev = info.get("previousClose") or info.get("previous_close") or price
            open_ = info.get("open") or prev
            high = info.get("dayHigh") or info.get("day_high") or price
            low = info.get("dayLow") or info.get("day_low") or price
            if price is None:
                return None
            change = ((price - open_) / open_ * 100) if open_ and open_ != 0 else 0
            return {"price": float(price), "open": float(open_), "high": float(high),
                    "low": float(low), "volume": 0, "change_pct": round(change, 2)}
        return await asyncio.to_thread(_get)
    except Exception as e:
        logger.debug(f"US/{symbol} yfinance 가격 실패: {e}")
        return None


async def _fetch_crypto_price(symbol: str) -> dict | None:
    """ccxt로 암호화폐 실시간 시세 조회."""
    try:
        import ccxt
        def _get():
            exchange = ccxt.binance({"enableRateLimit": True})
            ticker = exchange.fetch_ticker(symbol)
            if not ticker:
                return None
            price = ticker.get("last") or ticker.get("close")
            open_ = ticker.get("open") or price
            change = ((price - open_) / open_ * 100) if open_ and open_ != 0 else 0
            return {"price": float(price), "open": float(open_),
                    "high": float(ticker.get("high") or price),
                    "low": float(ticker.get("low") or price),
                    "volume": float(ticker.get("baseVolume") or 0),
                    "change_pct": round(change, 2)}
        return await asyncio.to_thread(_get)
    except Exception as e:
        logger.debug(f"CRYPTO/{symbol} 실시간 가격 실패: {e}")
        return None


async def _feed_loop():
    """메인 피드 루프 — 활성 종목 가격을 주기적으로 fetch하여 broadcast."""
    from routes.websocket import manager

    global _running
    _running = True
    logger.info(f"실시간 가격 피드 시작 (주기: {FEED_INTERVAL}초)")

    while _running:
        try:
            # 활성 워치리스트 조회
            async with async_session() as session:
                result = await session.execute(
                    select(Watchlist).where(Watchlist.is_active.is_(True))
                )
                items = result.scalars().all()

            if not items:
                await asyncio.sleep(FEED_INTERVAL)
                continue

            updates = []
            for item in items:
                # 시장 개장 여부 확인
                if not is_market_open(item.market):
                    continue

                # 시장별 가격 fetch
                data = None
                if item.market == "KR":
                    data = await _fetch_kr_price(item.symbol)
                elif item.market == "US":
                    data = await _fetch_us_price(item.symbol)
                elif item.market == "CRYPTO":
                    data = await _fetch_crypto_price(item.symbol)

                if data and data["price"]:
                    updates.append({
                        "watchlist_id": item.id,
                        "symbol": item.symbol,
                        "market": item.market,
                        "price": data["price"],
                        "open": data["open"],
                        "high": data["high"],
                        "low": data["low"],
                        "volume": data["volume"],
                        "change_pct": data["change_pct"],
                    })

            # DB 가격 업데이트 + WebSocket 브로드캐스트
            if updates:
                async with async_session() as session:
                    for u in updates:
                        sig = await session.get(CurrentSignal, u["watchlist_id"])
                        if sig:
                            sig.price = u["price"]
                            sig.change_pct = u["change_pct"]
                    await session.commit()

                if manager.active:
                    await manager.broadcast({
                        "type": "price_update",
                        "data": updates,
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                logger.info(f"가격 피드: {len(updates)}개 종목 업데이트")

        except Exception as e:
            logger.error(f"가격 피드 에러: {e}")

        await asyncio.sleep(FEED_INTERVAL)

    logger.info("실시간 가격 피드 중지")


def start_price_feed():
    """가격 피드 백그라운드 태스크 시작."""
    global _task
    if _task is not None and not _task.done():
        return
    loop = asyncio.get_event_loop()
    _task = loop.create_task(_feed_loop())


def stop_price_feed():
    """가격 피드 중지."""
    global _running, _task
    _running = False
    if _task and not _task.done():
        _task.cancel()
