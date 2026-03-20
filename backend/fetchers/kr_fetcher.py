import asyncio
from datetime import datetime

import pandas as pd
import yfinance as yf
from loguru import logger

from fetchers.base import BaseFetcher


class KRFetcher(BaseFetcher):
    async def _fetch(self, symbol: str, timeframe: str = "1h", limit: int = 300) -> pd.DataFrame | None:
        ticker = f"{symbol}.KS"
        df = await asyncio.to_thread(self._download, ticker, timeframe, limit)
        if df is None:
            logger.info(f"KR/{symbol}: yfinance 실패 → pykrx fallback 시도")
            df = await asyncio.to_thread(self._download_pykrx, symbol, timeframe)
            return df

        # 일봉인 경우 pykrx로 당일 최신가 보정 (yfinance 15~20분 지연 보완)
        if timeframe == "1d":
            df = await asyncio.to_thread(self._patch_today_price, df, symbol)

        return df

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

    def _patch_today_price(self, df: pd.DataFrame, symbol: str) -> pd.DataFrame:
        """pykrx로 당일 실시간 OHLCV를 가져와 마지막 캔들을 보정."""
        try:
            from pykrx import stock

            today = datetime.now().strftime("%Y%m%d")
            today_data = stock.get_market_ohlcv(today, today, symbol)
            if today_data is None or today_data.empty:
                return df

            row = today_data.iloc[-1]
            last_idx = df.index[-1]

            df.loc[last_idx, "open"] = float(row["시가"])
            df.loc[last_idx, "high"] = float(row["고가"])
            df.loc[last_idx, "low"] = float(row["저가"])
            df.loc[last_idx, "close"] = float(row["종가"])
            df.loc[last_idx, "volume"] = float(row["거래량"])

            logger.debug(f"KR/{symbol}: pykrx 실시간 보정 → {row['종가']:,.0f}원")
        except Exception as e:
            logger.warning(f"KR/{symbol}: pykrx 실시간 보정 실패: {e}")
        return df

    def _download_pykrx(self, symbol: str, timeframe: str) -> pd.DataFrame | None:
        try:
            from pykrx import stock
            from datetime import timedelta
            end = datetime.now().strftime("%Y%m%d")
            start = (datetime.now() - timedelta(days=730)).strftime("%Y%m%d")
            data = stock.get_market_ohlcv(start, end, symbol)
            if data is None or data.empty:
                return None
            df = data.rename(columns={"시가": "open", "고가": "high", "저가": "low", "종가": "close", "거래량": "volume"})
            return df[["open", "high", "low", "close", "volume"]]
        except Exception as e:
            logger.warning(f"pykrx fallback 실패: {e}")
            return None
