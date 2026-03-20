import asyncio
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone

import pandas as pd
from loguru import logger

MIN_CANDLES = 200
MAX_DATA_AGE_HOURS = 1
MAX_RETRIES = 3
BACKOFF_BASE = 2


class BaseFetcher(ABC):
    @abstractmethod
    async def _fetch(self, symbol: str, timeframe: str, limit: int) -> pd.DataFrame | None:
        """실제 데이터 수집 (서브클래스 구현)."""
        ...

    # timeframe별 yfinance interval 매핑
    TF_MAP = {"1w": "1wk", "1M": "1mo"}

    async def fetch_ohlcv(self, symbol: str, timeframe: str = "1h", limit: int = 300) -> pd.DataFrame | None:
        """재시도 로직 포함 데이터 수집."""
        yf_tf = self.TF_MAP.get(timeframe, timeframe)
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                df = await self._fetch(symbol, yf_tf, limit)
                return self.validate(df, symbol, timeframe)
            except Exception as e:
                wait = BACKOFF_BASE ** attempt
                logger.warning(f"{symbol}: 수집 실패 ({attempt}/{MAX_RETRIES}): {e} — {wait}초 후 재시도")
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(wait)
        logger.error(f"{symbol}: {MAX_RETRIES}회 재시도 모두 실패")
        return None

    def validate(self, df: pd.DataFrame | None, symbol: str, timeframe: str = "1d") -> pd.DataFrame | None:
        if df is None or df.empty:
            logger.warning(f"{symbol}: 데이터 없음")
            return None
        # 주봉/월봉은 캔들 수가 적으므로 최소 기준 낮춤
        min_candles = 50 if timeframe in ("1w", "1wk", "1M", "1mo") else MIN_CANDLES
        if len(df) < min_candles:
            logger.warning(f"{symbol}: 캔들 부족 {len(df)}/{min_candles}")
            return None

        last_ts = df.index[-1]
        if hasattr(last_ts, "tzinfo") and last_ts.tzinfo is not None:
            now = datetime.now(timezone.utc)
        else:
            now = datetime.utcnow()
        if (now - last_ts) > timedelta(hours=MAX_DATA_AGE_HOURS):
            logger.warning(f"{symbol}: 데이터 오래됨 ({last_ts})")

        # 비정상 캔들 제거 (O/H/L이 0인 경우)
        df = df[(df["open"] > 0) & (df["high"] > 0) & (df["low"] > 0)]

        df = df.ffill()
        return df
