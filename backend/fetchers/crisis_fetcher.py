"""Crisis event market data fetcher using yfinance (period='max')."""
import asyncio
from datetime import date, datetime, timedelta
from typing import Optional

import pandas as pd
import yfinance as yf
from loguru import logger

# 8개 표준 지표 티커
INDICATORS = [
    {"name": "S&P500", "ticker": "^GSPC", "category": "equity", "unit": "index", "earliest_date": "1950-01-03"},
    {"name": "코스피", "ticker": "^KS11", "category": "equity", "unit": "index", "earliest_date": "1996-12-11"},
    {"name": "나스닥", "ticker": "^IXIC", "category": "equity", "unit": "index", "earliest_date": "1971-02-05"},
    {"name": "금(현물)", "ticker": "GC=F", "category": "commodity", "unit": "USD/oz", "earliest_date": "2000-08-30"},
    {"name": "WTI 원유", "ticker": "CL=F", "category": "commodity", "unit": "USD/bbl", "earliest_date": "2000-08-23"},
    {"name": "달러인덱스(DXY)", "ticker": "DX-Y.NYB", "category": "fx", "unit": "index", "earliest_date": "1971-01-04"},
    {"name": "미국채10년금리", "ticker": "^TNX", "category": "bond", "unit": "%", "earliest_date": "1962-01-02"},
    {"name": "원/달러 환율", "ticker": "KRW=X", "category": "fx", "unit": "USD/KRW", "earliest_date": "2003-12-01"},
]


def fetch_indicator_history(ticker: str, start: date, end: date) -> Optional[pd.Series]:
    """yfinance에서 일별 종가 데이터 조회. 존재하지 않으면 None 반환."""
    try:
        start_str = start.strftime("%Y-%m-%d")
        end_str = (end + timedelta(days=1)).strftime("%Y-%m-%d")  # end date exclusive
        df = yf.download(ticker, start=start_str, end=end_str, interval="1d", progress=False, auto_adjust=True)
        if df is None or df.empty:
            return None
        close = df["Close"]
        if hasattr(close, "iloc") and hasattr(close.columns if hasattr(close, 'columns') else None, '__len__'):
            # Multi-level columns — flatten
            close = close.iloc[:, 0] if close.ndim > 1 else close
        close = close.squeeze()
        # Forward-fill weekends/holidays
        full_idx = pd.date_range(start=start_str, end=end.strftime("%Y-%m-%d"), freq="D")
        close = close.reindex(full_idx).ffill()
        return close
    except Exception as e:
        logger.warning(f"crisis_fetcher: {ticker} 조회 실패 ({start}~{end}): {e}")
        return None


async def fetch_indicator_history_async(ticker: str, start: date, end: date) -> Optional[pd.Series]:
    """비동기 래퍼."""
    return await asyncio.to_thread(fetch_indicator_history, ticker, start, end)


def compute_data_points(
    series: pd.Series,
    event_start: date,
    days_before: int,
    days_after: int,
) -> list[dict]:
    """일별 데이터 포인트 목록 계산 (change_pct_from_event_start 포함)."""
    event_start_ts = pd.Timestamp(event_start)
    base_value = series.get(event_start_ts)

    # 이벤트 시작일 전후로 base_value 탐색 (휴장일 대비)
    if base_value is None or pd.isna(base_value):
        for offset in range(1, 8):
            for delta in [offset, -offset]:
                candidate = event_start_ts + pd.Timedelta(days=delta)
                val = series.get(candidate)
                if val is not None and not pd.isna(val):
                    base_value = val
                    break
            if base_value is not None and not pd.isna(base_value):
                break

    data_points = []
    window_start = event_start - timedelta(days=days_before)
    window_end = event_start + timedelta(days=days_after)

    for ts, value in series.items():
        if pd.isna(value):
            continue
        d = ts.date() if hasattr(ts, 'date') else ts
        if d < window_start or d > window_end:
            continue
        day_offset = (d - event_start).days
        change_pct = None
        if base_value is not None and not pd.isna(base_value) and base_value != 0:
            change_pct = round((value - base_value) / base_value * 100, 4)
        data_points.append({
            "date": d,
            "day_offset": day_offset,
            "value": round(float(value), 6),
            "change_pct_from_event_start": change_pct,
        })

    return sorted(data_points, key=lambda x: x["date"])


def compute_stats(data_points: list[dict]) -> dict:
    """이벤트 기간 중 MDD, 최대상승, 회복일 계산."""
    if not data_points:
        return {"max_drawdown_pct": None, "max_gain_pct": None, "days_to_bottom": None, "recovery_days": None}

    changes = [dp["change_pct_from_event_start"] for dp in data_points if dp["change_pct_from_event_start"] is not None]
    if not changes:
        return {"max_drawdown_pct": None, "max_gain_pct": None, "days_to_bottom": None, "recovery_days": None}

    max_drawdown = min(changes)
    max_gain = max(changes)

    # 최저점 도달 일수
    min_idx = changes.index(max_drawdown)
    days_to_bottom = data_points[min_idx]["day_offset"] if min_idx < len(data_points) else None

    # 회복일: 최저점 이후 change_pct >= 0인 첫 번째 날
    recovery_days = None
    if days_to_bottom is not None and max_drawdown < 0:
        for dp in data_points[min_idx:]:
            if dp["change_pct_from_event_start"] is not None and dp["change_pct_from_event_start"] >= 0:
                recovery_days = dp["day_offset"] - days_to_bottom
                break

    return {
        "max_drawdown_pct": round(max_drawdown, 2),
        "max_gain_pct": round(max_gain, 2),
        "days_to_bottom": days_to_bottom,
        "recovery_days": recovery_days,
    }


async def fetch_event_indicator_data(
    event_id: int,
    event_start: date,
    ticker: str,
    indicator_id: int,
    days_before: int = 30,
    days_after: int = 180,
) -> tuple[list[dict], dict]:
    """하나의 이벤트-지표 조합 데이터 조회 및 통계 계산."""
    fetch_start = event_start - timedelta(days=days_before + 10)  # 약간의 여유
    fetch_end = min(date.today(), event_start + timedelta(days=days_after))

    series = await fetch_indicator_history_async(ticker, fetch_start, fetch_end)
    if series is None or series.empty:
        return [], {"max_drawdown_pct": None, "max_gain_pct": None, "days_to_bottom": None, "recovery_days": None}

    data_points = compute_data_points(series, event_start, days_before, days_after)
    stats = compute_stats([dp for dp in data_points if dp["day_offset"] >= 0])
    return data_points, stats
