"""한국투자증권 실시간 WebSocket 매니저 — 체결가 수신 + 메모리 캐시."""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from loguru import logger

from config import get_settings

MAX_SUBSCRIPTIONS = 40  # 계정당 41개 중 1개 여유

# 메모리 캐시: {symbol: {price, open, high, low, volume, change_pct, updated_at}}
_price_cache: dict[str, dict[str, Any]] = {}
_subscriptions: dict[str, Any] = {}  # {symbol: ticket}
_connected = False
_kis_service = None


def is_connected() -> bool:
    return _connected


def get_cached_price(symbol: str) -> dict | None:
    """캐시된 실시간 가격 반환."""
    data = _price_cache.get(symbol)
    if not data:
        return None
    # 5분 이상 오래된 캐시는 무시
    age = (datetime.now() - data.get("updated_at", datetime.min)).total_seconds()
    if age > 300:
        return None
    return data


def _on_price(sender: Any, e: Any) -> None:
    """실시간 체결가 콜백 → 메모리 캐시 업데이트."""
    try:
        resp = e.response
        symbol = resp.symbol
        prev = _price_cache.get(symbol, {}).get("open") or resp.price
        change_pct = ((resp.price - prev) / prev * 100) if prev else 0

        _price_cache[symbol] = {
            "price": float(resp.price),
            "open": _price_cache.get(symbol, {}).get("open") or float(resp.price),
            "high": max(
                float(resp.price),
                _price_cache.get(symbol, {}).get("high", 0),
            ),
            "low": min(
                float(resp.price),
                _price_cache.get(symbol, {}).get("low", float("inf")),
            ),
            "volume": float(resp.volume) if hasattr(resp, "volume") else 0,
            "change_pct": round(float(change_pct), 2),
            "updated_at": datetime.now(),
        }
    except Exception as exc:
        logger.debug(f"실시간 가격 콜백 에러: {exc}")


async def subscribe(symbol: str) -> bool:
    """종목 WebSocket 구독 추가."""
    global _kis_service
    if symbol in _subscriptions:
        return True
    if len(_subscriptions) >= MAX_SUBSCRIPTIONS:
        logger.warning(f"WebSocket 구독 한도 초과 ({MAX_SUBSCRIPTIONS}개)")
        return False
    if not _kis_service:
        return False
    try:
        stock = _kis_service.kis.stock(symbol)
        ticket = stock.on("price", _on_price)
        _subscriptions[symbol] = ticket
        logger.info(f"실시간 구독 추가: {symbol} ({len(_subscriptions)}/{MAX_SUBSCRIPTIONS})")
        return True
    except Exception as e:
        logger.error(f"실시간 구독 실패 [{symbol}]: {e}")
        return False


async def unsubscribe(symbol: str) -> None:
    """종목 구독 해제."""
    ticket = _subscriptions.pop(symbol, None)
    if ticket:
        try:
            ticket.unsubscribe()
            logger.info(f"실시간 구독 해제: {symbol}")
        except Exception as e:
            logger.debug(f"구독 해제 에러 [{symbol}]: {e}")
    _price_cache.pop(symbol, None)


async def connect(symbols: list[str] | None = None) -> None:
    """WebSocket 연결 + 종목 구독 시작. 장 종료 시 연결하지 않음."""
    global _connected, _kis_service
    settings = get_settings()
    if not settings.kis_configured:
        logger.info("한투 API 미설정 — WebSocket 건너뜀")
        return

    # 장 종료 시간에는 WebSocket 연결하지 않음 (불필요한 재연결 방지)
    from scheduler import is_market_open
    if not is_market_open("KR"):
        logger.info("한국 장 종료 — WebSocket 연결 건너뜀 (REST fallback)")
        _connected = False
        return

    from services.kis_client import get_kis_service

    _kis_service = get_kis_service()
    if not _kis_service:
        return

    _connected = True
    logger.info("한투 실시간 WebSocket 준비 완료")

    if symbols:
        for sym in symbols[:MAX_SUBSCRIPTIONS]:
            await subscribe(sym)


async def disconnect() -> None:
    """WebSocket 연결 종료 + 전체 구독 해제."""
    global _connected
    symbols = list(_subscriptions.keys())
    for sym in symbols:
        await unsubscribe(sym)
    _connected = False
    _price_cache.clear()
    logger.info("한투 실시간 WebSocket 종료")


def get_subscription_info() -> dict:
    """현재 구독 상태 정보."""
    return {
        "connected": _connected,
        "subscribed": len(_subscriptions),
        "max": MAX_SUBSCRIPTIONS,
        "symbols": list(_subscriptions.keys()),
    }
