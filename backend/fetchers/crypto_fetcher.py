import asyncio

import pandas as pd
from loguru import logger

from fetchers.base import BaseFetcher


class CryptoFetcher(BaseFetcher):
    async def _fetch(self, symbol: str, timeframe: str = "1h", limit: int = 300) -> pd.DataFrame | None:
        df = await asyncio.to_thread(self._download_ccxt, symbol, timeframe, limit)
        if df is None:
            logger.info(f"CRYPTO/{symbol}: ccxt 실패 → yfinance fallback")
            df = await asyncio.to_thread(self._download_yf, symbol, timeframe)
        return df

    def _download_ccxt(self, symbol: str, timeframe: str, limit: int) -> pd.DataFrame | None:
        import ccxt
        # ccxt는 '1w'를 사용, yfinance는 '1wk' — 역변환
        ccxt_tf = timeframe.replace("1wk", "1w").replace("1mo", "1M")
        exchange = ccxt.binance({"enableRateLimit": True})
        ohlcv = exchange.fetch_ohlcv(symbol, ccxt_tf, limit=limit)
        if not ohlcv:
            return None
        df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
        df.set_index("timestamp", inplace=True)
        return df

    def _download_yf(self, symbol: str, timeframe: str) -> pd.DataFrame | None:
        try:
            import yfinance as yf
            ticker = symbol.replace("/", "-")  # BTC/USDT → BTC-USDT
            data = yf.download(ticker, period="730d", interval=timeframe, progress=False, auto_adjust=True)
            if data is None or data.empty:
                return None
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            df = data[["Open", "High", "Low", "Close", "Volume"]].copy()
            df.columns = ["open", "high", "low", "close", "volume"]
            return df
        except Exception as e:
            logger.warning(f"yfinance crypto fallback 실패: {e}")
            return None
