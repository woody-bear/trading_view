"""yfinance 기반 US 주식 프리/애프터마켓 가격 조회.

KIS 해외주식 API가 장외 시간대에 정규장 종가만 반환하는 한계를 보완한다.
marketState ∈ {PRE, POST}일 때만 본 모듈을 사용하고, 정규장/휴장은 KIS를 유지한다.

캐시: 심볼별 in-memory dict, TTL 15초 (yfinance rate-limit 회피 + 프리마켓 갱신 주기 균형).
"""

from __future__ import annotations

import time
from typing import TypedDict

from loguru import logger


_CACHE_TTL = 5.0  # 초 (정규장 실시간감 확보)
_cache: dict[str, tuple[float, "ExtendedQuote"]] = {}  # symbol → (ts, payload)


class ExtendedQuote(TypedDict, total=False):
    price: float
    open: float
    high: float
    low: float
    volume: float
    change_pct: float
    is_pre_market: bool
    is_post_market: bool
    market_state: str  # PRE | POST | REGULAR | CLOSED | PREPRE


def _fetch(symbol: str) -> ExtendedQuote | None:
    """실제 yfinance 호출. 블로킹 — 호출자가 to_thread로 감싸야 함."""
    import yfinance as yf

    try:
        t = yf.Ticker(symbol)
        info = t.info or {}
    except Exception as e:
        logger.debug(f"yfinance extended fetch failed [{symbol}]: {e}")
        return None

    state = info.get("marketState") or ""
    prev = info.get("regularMarketPreviousClose") or info.get("previousClose")

    if state == "PRE":
        price = info.get("preMarketPrice")
        if price is None:
            return None
        change = info.get("preMarketChangePercent")
        if change is None and prev:
            change = (price - prev) / prev * 100
        return {
            "price": float(price),
            "open": float(price),
            "high": float(price),
            "low": float(price),
            "volume": float(info.get("preMarketVolume") or 0),
            "change_pct": round(float(change or 0), 2),
            "is_pre_market": True,
            "market_state": state,
        }

    if state == "POST" or state == "POSTPOST":
        price = info.get("postMarketPrice")
        if price is None:
            return None
        change = info.get("postMarketChangePercent")
        if change is None and prev:
            change = (price - prev) / prev * 100
        return {
            "price": float(price),
            "open": float(price),
            "high": float(price),
            "low": float(price),
            "volume": float(info.get("postMarketVolume") or 0),
            "change_pct": round(float(change or 0), 2),
            "is_post_market": True,
            "market_state": state,
        }

    if state == "REGULAR":
        price = info.get("regularMarketPrice")
        if price is None:
            return None
        change = info.get("regularMarketChangePercent")
        if change is None and prev:
            change = (price - prev) / prev * 100
        return {
            "price": float(price),
            "open": float(info.get("regularMarketOpen") or price),
            "high": float(info.get("regularMarketDayHigh") or price),
            "low": float(info.get("regularMarketDayLow") or price),
            "volume": float(info.get("regularMarketVolume") or 0),
            "change_pct": round(float(change or 0), 2),
            "market_state": state,
        }

    # CLOSED 등은 본 모듈 대상 아님 — 호출자가 KIS 사용
    return None


def get_us_extended_quote(symbol: str) -> ExtendedQuote | None:
    """US 종목의 프리/애프터마켓 체결가. 정규장·휴장 상태면 None 반환.

    15초 캐시. 비동기 컨텍스트에서 호출 시 `asyncio.to_thread`로 감싸야 함.
    """
    now = time.time()
    hit = _cache.get(symbol)
    if hit and (now - hit[0]) < _CACHE_TTL:
        return hit[1]

    payload = _fetch(symbol)
    _cache[symbol] = (now, payload)  # None도 캐시 — 정규장인 종목에 반복 호출 방지
    return payload
