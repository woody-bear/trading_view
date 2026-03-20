"""차트 캔들 캐시 — SQLite 캐시 우선, yfinance fallback."""

import asyncio
import time
from datetime import datetime, timedelta

import pandas as pd
from loguru import logger
from sqlalchemy import delete, select, func

from database import async_session
from models import ChartCache

# 종목명 메모리 캐시
_name_cache: dict[str, tuple[str, float]] = {}  # {key: (name, timestamp)}
_NAME_TTL = 3600


def _yf_ticker(symbol: str, market: str) -> str:
    """종목 심볼을 yfinance 티커로 변환."""
    if market in ("KR", "KOSPI"):
        return f"{symbol}.KS"
    elif market == "KOSDAQ":
        return f"{symbol}.KQ"
    elif market == "CRYPTO":
        return symbol.replace("/USDT", "-USD").replace("/", "-")
    return symbol


def _yf_interval(timeframe: str) -> str:
    """타임프레임을 yfinance interval로 변환."""
    return {"1w": "1wk", "1M": "1mo"}.get(timeframe, timeframe)


def _yf_period(timeframe: str) -> str:
    """타임프레임에 맞는 yfinance period."""
    if timeframe in ("15m", "30m"):
        return "60d"
    elif timeframe in ("1w", "1M"):
        return "5y"
    return "2y"


def _download_yfinance(ticker: str, timeframe: str, period: str = None) -> pd.DataFrame | None:
    """yfinance에서 OHLCV 다운로드."""
    import yfinance as yf

    if period is None:
        period = _yf_period(timeframe)
    interval = _yf_interval(timeframe)

    try:
        data = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=True)
        if data is None or data.empty:
            return None
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        df = data[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.columns = ["open", "high", "low", "close", "volume"]
        df = df.dropna(subset=["close"])
        df = df[(df["open"] > 0) & (df["high"] > 0) & (df["low"] > 0)]
        # 이상 캔들 필터: 중간값 기준 5배 이상 벗어난 캔들 제거
        # (yfinance 공휴일 수정주가 오류 — 한국: 급락, 미국: 급등)
        if len(df) > 10:
            median_price = df["close"].median()
            df = df[(df["close"] > median_price * 0.1) & (df["close"] < median_price * 5)]
        return df
    except Exception as e:
        logger.debug(f"yfinance 다운로드 실패 [{ticker}]: {e}")
        return None


async def get_chart_data(symbol: str, market: str, timeframe: str = "1d", limit: int = 200) -> pd.DataFrame | None:
    """캐시 우선 차트 데이터 조회. 없거나 오래됐으면 yfinance 다운로드 + 캐시 저장."""

    # 1. DB 캐시 조회
    async with async_session() as session:
        result = await session.execute(
            select(ChartCache)
            .where(
                ChartCache.symbol == symbol,
                ChartCache.market == market,
                ChartCache.timeframe == timeframe,
            )
            .order_by(ChartCache.timestamp.asc())
        )
        cached = result.scalars().all()

    if cached:
        last_ts = cached[-1].timestamp
        last_dt = datetime.utcfromtimestamp(last_ts)
        now = datetime.utcnow()

        # 캐시가 최신인지 확인 (마지막 캔들이 1영업일 이내)
        is_fresh = (now - last_dt) < timedelta(hours=20)

        if is_fresh and len(cached) >= 50:
            # 캐시 사용
            df = _cache_to_df(cached)
            logger.debug(f"차트 캐시 HIT: {market}/{symbol}/{timeframe} ({len(cached)}개)")
            return df.tail(limit)

        # 캐시 오래됨 → 신규 캔들만 추가 다운로드
        ticker = _yf_ticker(symbol, market)
        # 마지막 캔들 이후부터 다운로드
        days_diff = (now - last_dt).days + 5  # 여유분
        period = f"{max(days_diff, 7)}d"
        new_df = await asyncio.to_thread(_download_yfinance, ticker, timeframe, period)

        if new_df is not None and not new_df.empty:
            # 신규 캔들 DB 저장
            await _save_to_cache(symbol, market, timeframe, new_df)
            # 전체 캐시 다시 조합
            old_df = _cache_to_df(cached)
            combined = pd.concat([old_df, new_df])
            combined = combined[~combined.index.duplicated(keep="last")]
            combined = combined.sort_index()
            logger.debug(f"차트 캐시 UPDATE: {market}/{symbol}/{timeframe} (+{len(new_df)}개)")
            return combined.tail(limit)

        # 추가 다운로드 실패 → 기존 캐시라도 반환
        return _cache_to_df(cached).tail(limit)

    # 2. 캐시 없음 → 전체 다운로드
    ticker = _yf_ticker(symbol, market)
    df = await asyncio.to_thread(_download_yfinance, ticker, timeframe)

    if df is None or df.empty:
        return None

    # DB에 저장
    await _save_to_cache(symbol, market, timeframe, df)
    logger.debug(f"차트 캐시 NEW: {market}/{symbol}/{timeframe} ({len(df)}개)")

    return df.tail(limit)


def _cache_to_df(cached: list[ChartCache]) -> pd.DataFrame:
    """DB 캐시 레코드를 pandas DataFrame으로 변환."""
    rows = []
    for c in cached:
        rows.append({
            "open": c.open, "high": c.high, "low": c.low,
            "close": c.close, "volume": c.volume,
            "timestamp": c.timestamp,
        })
    df = pd.DataFrame(rows)
    df.index = pd.to_datetime(df["timestamp"], unit="s")
    df = df.drop(columns=["timestamp"])
    return df


async def _save_to_cache(symbol: str, market: str, timeframe: str, df: pd.DataFrame) -> None:
    """DataFrame을 chart_cache 테이블에 벌크 저장. 이상치 재검증 후 저장."""
    from sqlalchemy import delete as sa_delete

    # 저장 전 이상치 재검증
    if len(df) > 10:
        median_price = df["close"].median()
        before = len(df)
        df = df[(df["close"] > median_price * 0.1) & (df["close"] < median_price * 5)]
        filtered = before - len(df)
        if filtered > 0:
            logger.warning(f"캐시 저장 전 이상 캔들 {filtered}개 제거: {market}/{symbol}")

    async with async_session() as session:
        await session.execute(
            sa_delete(ChartCache).where(
                ChartCache.symbol == symbol,
                ChartCache.market == market,
                ChartCache.timeframe == timeframe,
            )
        )
        batch = []
        for idx, row in df.iterrows():
            ts = int(idx.timestamp()) if hasattr(idx, "timestamp") else int(idx)
            batch.append(ChartCache(
                symbol=symbol, market=market, timeframe=timeframe,
                timestamp=ts, open=float(row["open"]), high=float(row["high"]),
                low=float(row["low"]), close=float(row["close"]),
                volume=float(row["volume"]),
            ))
        session.add_all(batch)
        await session.commit()


async def resolve_name(symbol: str, market: str) -> str:
    """종목명 조회 (메모리 캐시 1시간)."""
    cache_key = f"{market}:{symbol}"
    if cache_key in _name_cache:
        name, ts = _name_cache[cache_key]
        if time.time() - ts < _NAME_TTL:
            return name

    name = await asyncio.to_thread(_resolve_name_sync, symbol, market)
    _name_cache[cache_key] = (name, time.time())
    return name


def _resolve_name_sync(symbol: str, market: str) -> str:
    """종목명 동기 조회."""
    try:
        if market in ("KR", "KOSPI", "KOSDAQ"):
            from pykrx import stock
            name = stock.get_market_ticker_name(symbol)
            if name:
                return name
        elif market == "CRYPTO":
            # 암호화폐는 심볼 그대로
            return symbol.split("/")[0] if "/" in symbol else symbol
        else:
            import yfinance as yf
            ticker = _yf_ticker(symbol, market)
            info = yf.Ticker(ticker).info
            return info.get("shortName") or info.get("longName") or symbol
    except Exception:
        pass
    return symbol


async def cleanup_old_cache(max_age_days: int = 7) -> int:
    """오래된 캐시 정리 (7일 이상)."""
    cutoff = int((datetime.utcnow() - timedelta(days=max_age_days)).timestamp())
    async with async_session() as session:
        result = await session.execute(
            delete(ChartCache).where(ChartCache.timestamp < cutoff)
        )
        await session.commit()
        return result.rowcount or 0
