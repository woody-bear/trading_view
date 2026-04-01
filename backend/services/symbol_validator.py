import asyncio
import re

import yfinance as yf
from loguru import logger


async def validate_symbol(market: str, symbol: str) -> dict | None:
    """종목 유효성 검증 + display_name 반환. 실패 시 None."""
    validators = {"KR": _validate_kr, "US": _validate_us, "CRYPTO": _validate_crypto}
    fn = validators.get(market)
    if fn is None:
        return None
    return await fn(symbol)


async def _validate_kr(symbol: str) -> dict | None:
    if not re.match(r"^\d{6}$", symbol):
        return None
    # pykrx로 한글 이름 먼저 시도
    kr_name = await asyncio.to_thread(_pykrx_name, symbol)
    if kr_name:
        return {"display_name": kr_name}
    return await asyncio.to_thread(_yf_info, f"{symbol}.KS")


async def _validate_us(symbol: str) -> dict | None:
    if not re.match(r"^[A-Z]{1,5}$", symbol):
        return None
    result = await asyncio.to_thread(_yf_info, symbol)
    # yfinance 조회 실패해도 심볼 형식이 올바르면 허용 (이름은 나중에 채워짐)
    return result or {"display_name": symbol}


async def _validate_crypto(symbol: str) -> dict | None:
    if "/" not in symbol:
        return None
    try:
        import ccxt
        exchange = ccxt.binance()
        markets = await asyncio.to_thread(exchange.load_markets)
        if symbol in markets:
            base = symbol.split("/")[0]
            return {"display_name": base}
    except Exception as e:
        logger.warning(f"CRYPTO 검증 실패: {e}")
    return None


def _pykrx_name(symbol: str) -> str | None:
    try:
        from pykrx import stock
        name = stock.get_market_ticker_name(symbol)
        return name if name else None
    except Exception:
        return None


def _yf_info(ticker: str) -> dict | None:
    try:
        t = yf.Ticker(ticker)
        info = t.info
        name = info.get("shortName") or info.get("longName")
        if name:
            return {"display_name": name}
    except Exception as e:
        logger.warning(f"yfinance 검증 실패 {ticker}: {e}")
    return None
