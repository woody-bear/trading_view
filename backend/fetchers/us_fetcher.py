import asyncio

import pandas as pd
import yfinance as yf
from loguru import logger

from fetchers.base import BaseFetcher


class USFetcher(BaseFetcher):
    async def _fetch(self, symbol: str, timeframe: str = "1h", limit: int = 300) -> pd.DataFrame | None:
        return await asyncio.to_thread(self._download, symbol, timeframe, limit)

    def _download(self, ticker: str, timeframe: str, limit: int) -> pd.DataFrame | None:
        period = "730d" if timeframe in ("1h", "4h") else ("60d" if timeframe in ("15m", "30m") else ("5y" if timeframe in ("1wk", "1mo") else "2y"))
        data = yf.download(ticker, period=period, interval=timeframe, progress=False, auto_adjust=True)
        if data is None or data.empty:
            return None
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        df = data[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.columns = ["open", "high", "low", "close", "volume"]
        return df
