"""차트 캔들 캐시 — parquet 파일 캐시 우선, yfinance fallback."""

import asyncio
import time
from datetime import timedelta
from pathlib import Path

import pandas as pd
from loguru import logger

from utils.market_hours import get_last_complete_date, is_candle_complete

# 캐시 디렉토리
_CACHE_DIR = Path(__file__).parent.parent / "data" / "charts"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# 종목명 메모리 캐시
_name_cache: dict[str, tuple[str, float]] = {}  # {key: (name, timestamp)}
_NAME_TTL = 3600

# 최소 유효 캔들 수
_MIN_CANDLES = 50

# 가격 검증 허용 배율 (현재가 대비 캐시 마지막 가격)
_PRICE_TOLERANCE = 5.0


def _yf_ticker(symbol: str, market: str) -> str:
    """종목 심볼을 yfinance 티커로 변환."""
    if market == "KOSDAQ":
        return f"{symbol}.KQ"
    elif market in ("KR", "KOSPI"):
        # KR로 들어온 경우 코스닥 여부 확인
        if market == "KR" and symbol.isdigit():
            try:
                import sqlite3
                import os
                db_path = os.path.join(os.path.dirname(__file__), "..", "data", "ubb_pro.db")
                conn = sqlite3.connect(db_path)
                row = conn.execute(
                    "SELECT market_type FROM stock_master WHERE symbol = ? LIMIT 1", (symbol,)
                ).fetchone()
                conn.close()
                if row and row[0] == "KOSDAQ":
                    return f"{symbol}.KQ"
            except Exception:
                pass
        return f"{symbol}.KS"
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


def _cache_path(symbol: str, market: str, timeframe: str) -> Path:
    """캐시 파일 경로. 심볼의 /를 _로 치환."""
    safe_symbol = symbol.replace("/", "_")
    return _CACHE_DIR / f"{market}_{safe_symbol}_{timeframe}.parquet"


def _strip_incomplete_candle(df: pd.DataFrame, market: str, timeframe: str = "1d") -> pd.DataFrame:
    """장중인 경우 당일 미완성 캔들을 제거하여 반환."""
    if df is None or df.empty or timeframe not in ("1d", "1wk", "1mo", "1w", "1M"):
        return df
    last_date = df.index[-1].date() if hasattr(df.index[-1], "date") else df.index[-1]
    if not is_candle_complete(last_date, market):
        logger.debug(f"미완성 캔들 제거: {market} {last_date}")
        return df.iloc[:-1]
    return df


def _get_known_price(symbol: str, market: str) -> float | None:
    """current_signal 또는 watchlist에서 알려진 현재가 조회 (동기, 검증용)."""
    try:
        import sqlite3
        db_path = Path(__file__).parent.parent / "data" / "ubb_pro.db"
        if not db_path.exists():
            return None
        conn = sqlite3.connect(str(db_path))
        cur = conn.cursor()
        row = cur.execute(
            "SELECT cs.price FROM current_signal cs "
            "JOIN watchlist w ON cs.watchlist_id = w.id "
            "WHERE w.symbol = ? AND w.market IN (?, 'KR', 'KOSPI', 'KOSDAQ', 'US', 'CRYPTO') "
            "AND cs.price > 0 LIMIT 1",
            (symbol, market)
        ).fetchone()
        conn.close()
        return row[0] if row else None
    except Exception:
        return None


def _validate_cache_price(df: pd.DataFrame, symbol: str, market: str) -> bool:
    """캐시 마지막 가격이 알려진 현재가와 크게 다르지 않은지 검증.

    현재가를 모르면 검증을 건너뛰고 True 반환.
    10배 이상 차이나면 오염된 캐시로 판단하여 False.
    """
    known_price = _get_known_price(symbol, market)
    if known_price is None or known_price <= 0:
        return True  # 비교 대상 없으면 통과

    cache_last_price = float(df["close"].iloc[-1])
    if cache_last_price <= 0:
        return False

    ratio = max(known_price, cache_last_price) / min(known_price, cache_last_price)
    if ratio > _PRICE_TOLERANCE:
        logger.warning(
            f"캐시 가격 불일치: {market}/{symbol} "
            f"cache={cache_last_price:.0f} vs known={known_price:.0f} (ratio={ratio:.1f}x) — 캐시 폐기"
        )
        return False
    return True


def _load_parquet(symbol: str, market: str, timeframe: str) -> pd.DataFrame | None:
    """parquet 파일에서 캐시 로드. 손상/가격 불일치 시 삭제 후 None 반환."""
    path = _cache_path(symbol, market, timeframe)
    # KR로 조회 시 KOSPI/KOSDAQ 캐시도 탐색
    if not path.exists() and market == "KR":
        for alt in ("KOSPI", "KOSDAQ"):
            alt_path = _cache_path(symbol, alt, timeframe)
            if alt_path.exists():
                path = alt_path
                break
    if not path.exists():
        return None
    try:
        df = pd.read_parquet(path)
        if df.empty or len(df) < _MIN_CANDLES:
            logger.warning(f"캐시 무결성 실패 ({len(df)}행 < {_MIN_CANDLES}): {path.name} — 삭제")
            path.unlink(missing_ok=True)
            return None

        # 가격 정상 여부 검증 (모든 타임프레임)
        if not _validate_cache_price(df, symbol, market):
            path.unlink(missing_ok=True)
            return None

        return df
    except Exception as e:
        logger.warning(f"캐시 읽기 실패: {path.name} — {e}, 삭제 후 재다운로드")
        path.unlink(missing_ok=True)
        return None


def _save_parquet(symbol: str, market: str, timeframe: str, df: pd.DataFrame) -> None:
    """DataFrame을 parquet 파일로 저장. 이상치 재검증 후 저장."""
    if df is None or df.empty:
        return

    # 이상 캔들 필터
    if len(df) > 10:
        median_price = df["close"].median()
        before = len(df)
        df = df[(df["close"] > median_price * 0.1) & (df["close"] < median_price * 5)]
        filtered = before - len(df)
        if filtered > 0:
            logger.warning(f"캐시 저장 전 이상 캔들 {filtered}개 제거: {market}/{symbol}")

    # 저장 전 현재가 대비 검증
    if not _validate_cache_price(df, symbol, market):
        logger.error(f"yfinance 데이터 가격 불일치 — 저장하지 않음: {market}/{symbol}")
        return

    path = _cache_path(symbol, market, timeframe)
    df.to_parquet(path)
    logger.debug(f"캐시 저장: {path.name} ({len(df)}행)")


def _is_cache_fresh(df: pd.DataFrame, market: str, timeframe: str = "1d") -> bool:
    """캐시의 마지막 캔들이 최신인지 시장 시간 기준으로 판단."""
    last_date = df.index[-1].date() if hasattr(df.index[-1], "date") else df.index[-1]
    last_complete = get_last_complete_date(market)

    # 주봉/월봉은 캔들 간격만큼 여유를 줌
    if timeframe in ("1w", "1wk"):
        return last_date >= last_complete - timedelta(days=6)
    elif timeframe in ("1M", "1mo"):
        return last_date >= last_complete - timedelta(days=30)

    return last_date >= last_complete


def _download_yfinance(ticker: str, timeframe: str, period: str = None) -> pd.DataFrame | None:
    """yfinance에서 OHLCV 다운로드."""
    import yfinance as yf

    if period is None:
        period = _yf_period(timeframe)
    interval = _yf_interval(timeframe)

    try:
        data = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=False)
        if data is None or data.empty:
            return None
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        df = data[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.columns = ["open", "high", "low", "close", "volume"]
        df = df.dropna(subset=["close"])
        df = df[(df["open"] > 0) & (df["high"] > 0) & (df["low"] > 0)]
        # 이상 캔들 필터: 중간값 기준 5배 이상 벗어난 캔들 제거
        if len(df) > 10:
            median_price = df["close"].median()
            df = df[(df["close"] > median_price * 0.1) & (df["close"] < median_price * 5)]
        return df
    except Exception as e:
        logger.debug(f"yfinance 다운로드 실패 [{ticker}]: {e}")
        return None


async def get_chart_data(symbol: str, market: str, timeframe: str = "1d", limit: int = 200) -> pd.DataFrame | None:
    """캐시 우선 차트 데이터 조회. 없거나 오래됐으면 yfinance 전체 다운로드."""

    # 1. parquet 캐시 로드 (가격 검증 포함)
    df = _load_parquet(symbol, market, timeframe)

    if df is not None and _is_cache_fresh(df, market, timeframe):
        df = _strip_incomplete_candle(df, market, timeframe)
        logger.debug(f"차트 캐시 HIT: {market}/{symbol}/{timeframe} ({len(df)}행)")
        return df.tail(limit)

    # 2. 캐시 없거나 오래됨 → 전체 다운로드 (증분 없이 단순)
    ticker = _yf_ticker(symbol, market)
    new_df = await asyncio.to_thread(_download_yfinance, ticker, timeframe)

    if new_df is not None and not new_df.empty:
        new_df = _strip_incomplete_candle(new_df, market, timeframe)
        _save_parquet(symbol, market, timeframe, new_df)
        logger.debug(f"차트 캐시 {'UPDATE' if df is not None else 'NEW'}: {market}/{symbol}/{timeframe} ({len(new_df)}행)")
        return new_df.tail(limit)

    # 3. 다운로드 실패 → 기존 캐시라도 반환
    if df is not None:
        logger.debug(f"다운로드 실패, 기존 캐시 반환: {market}/{symbol}/{timeframe}")
        return _strip_incomplete_candle(df, market, timeframe).tail(limit)

    return None


async def validate_all_caches() -> dict:
    """서버 시작 시 모든 parquet 캐시의 가격 정상 여부 검증. 비정상 캐시 자동 삭제."""
    removed = 0
    checked = 0
    for path in sorted(_CACHE_DIR.glob("*.parquet")):
        try:
            parts = path.stem.split("_")
            # 파일명: {market}_{symbol}_{timeframe}.parquet
            # 심볼에 _가 있을 수 있으므로 (예: BTC_USDT) 마지막이 timeframe
            timeframe = parts[-1]
            market = parts[0]
            symbol = "_".join(parts[1:-1])

            df = pd.read_parquet(path)
            checked += 1

            # 캔들 수 검증
            if len(df) < _MIN_CANDLES:
                logger.warning(f"캐시 검증 실패 (행 부족): {path.name} → 삭제")
                path.unlink()
                removed += 1
                continue

            # 가격 검증
            if timeframe in ("1d",) and not _validate_cache_price(df, symbol, market):
                path.unlink()
                removed += 1
                continue

        except Exception as e:
            logger.warning(f"캐시 검증 오류: {path.name} — {e} → 삭제")
            path.unlink(missing_ok=True)
            removed += 1

    if removed:
        logger.info(f"캐시 검증 완료: {checked}개 검사, {removed}개 비정상 캐시 삭제")
    else:
        logger.info(f"캐시 검증 완료: {checked}개 모두 정상")

    return {"checked": checked, "removed": removed}


async def resolve_name(symbol: str, market: str) -> str:
    """종목명 조회 (메모리 캐시 1시간)."""
    cache_key = f"{market}:{symbol}"
    if cache_key in _name_cache:
        name, ts = _name_cache[cache_key]
        if time.time() - ts < _NAME_TTL:
            return name

    # 1순위: stock_master DB (즉시)
    if market in ("KR", "KOSPI", "KOSDAQ"):
        name = await _resolve_name_from_db(symbol)
        if name:
            _name_cache[cache_key] = (name, time.time())
            return name

    # 2순위: pykrx/yfinance (느림)
    name = await asyncio.to_thread(_resolve_name_sync, symbol, market)

    _name_cache[cache_key] = (name, time.time())
    return name


async def _resolve_name_from_db(symbol: str) -> str | None:
    """stock_master 테이블에서 종목명 조회."""
    try:
        from sqlalchemy import select
        from database import async_session
        from models import StockMaster

        async with async_session() as session:
            row = (await session.execute(
                select(StockMaster.name).where(StockMaster.symbol == symbol).limit(1)
            )).scalar_one_or_none()
            return row
    except Exception:
        return None


def _resolve_name_sync(symbol: str, market: str) -> str:
    """종목명 동기 조회."""
    try:
        if market in ("KR", "KOSPI", "KOSDAQ"):
            from pykrx import stock
            name = stock.get_market_ticker_name(symbol)
            if name:
                return name
        elif market == "CRYPTO":
            return symbol.split("/")[0] if "/" in symbol else symbol
        else:
            import yfinance as yf
            ticker = _yf_ticker(symbol, market)
            info = yf.Ticker(ticker).info
            return info.get("shortName") or info.get("longName") or symbol
    except Exception:
        pass
    return symbol


async def cleanup_old_cache(max_age_days: int = 30) -> int:
    """오래된 parquet 캐시 파일 정리."""
    cutoff = time.time() - (max_age_days * 86400)
    removed = 0
    for f in _CACHE_DIR.glob("*.parquet"):
        if f.stat().st_mtime < cutoff:
            f.unlink()
            removed += 1
    if removed:
        logger.info(f"오래된 캐시 {removed}개 정리 ({max_age_days}일 기준)")
    return removed
