"""추세선 채널 계산 서비스 (033-chart-trendlines).

기존 trend_analysis.py와 완전 독립 — 상호 import 없음.
on-demand 계산 + 60s in-memory 캐시.
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from loguru import logger

# ── Constants ──────────────────────────────────────────────────────────────

PEAK_WINDOW = 5
CACHE_TTL = 60.0
MIN_CANDLES = 22  # 최소 1개월 거래일

PERIOD_CANDLES: dict[str, int] = {
    "1m": 22,
    "3m": 66,
    "6m": 130,
    "12m": 260,
}

COLOR_DOWN = "#ef4444"
COLOR_UP = "#22c55e"

_cache: dict[tuple[str, str], tuple[float, dict]] = {}


# ── Swing Point Detection ───────────────────────────────────────────────────

def _find_swing_highs(arr: np.ndarray, window: int = PEAK_WINDOW) -> np.ndarray:
    """롤링 윈도우 기반 고점 인덱스 반환."""
    peaks: list[int] = []
    n = len(arr)
    for i in range(window, n - window):
        if arr[i] == max(arr[i - window: i + window + 1]):
            peaks.append(i)
    return np.array(peaks, dtype=int) if peaks else np.array([], dtype=int)


def _find_swing_lows(arr: np.ndarray, window: int = PEAK_WINDOW) -> np.ndarray:
    """롤링 윈도우 기반 저점 인덱스 반환."""
    troughs: list[int] = []
    n = len(arr)
    for i in range(window, n - window):
        if arr[i] == min(arr[i - window: i + window + 1]):
            troughs.append(i)
    return np.array(troughs, dtype=int) if troughs else np.array([], dtype=int)


# ── Channel Builder ─────────────────────────────────────────────────────────

def _ts_to_days(ts: float) -> float:
    """Unix timestamp → 일 단위 (polyfit 수치 안정성용)."""
    return ts / 86400.0


def _line_at(slope: float, intercept: float, ts: float) -> float:
    """slope(price/day) * t_days + intercept."""
    return slope * _ts_to_days(ts) + intercept


@dataclass
class ChannelLine:
    start_time: int
    start_price: float
    end_time: int
    end_price: float
    slope: float      # price per day
    intercept: float


@dataclass
class TrendChannel:
    kind: str  # 'downtrend' | 'uptrend'
    main: ChannelLine
    parallel: ChannelLine
    valid: bool


def _build_channel(
    timestamps: np.ndarray,
    pivot_indices: np.ndarray,
    pivot_prices: np.ndarray,
    offset_prices: np.ndarray,
    offset_ts: np.ndarray,
    today_ts: int,
    kind: str,
) -> TrendChannel | None:
    """2개의 스윙 포인트로 main line 구성, 구간 극값으로 parallel 계산."""
    if len(pivot_indices) < 2:
        return None

    i1, i2 = int(pivot_indices[-2]), int(pivot_indices[-1])
    t1, t2 = float(timestamps[i1]), float(timestamps[i2])
    p1, p2 = float(pivot_prices[-2]), float(pivot_prices[-1])

    t1_d, t2_d = _ts_to_days(t1), _ts_to_days(t2)
    if abs(t2_d - t1_d) < 1e-9:
        return None

    slope, intercept = np.polyfit([t1_d, t2_d], [p1, p2], 1)
    slope = float(slope)
    intercept = float(intercept)

    main_line = ChannelLine(
        start_time=int(t1),
        start_price=round(_line_at(slope, intercept, t1), 2),
        end_time=today_ts,
        end_price=round(_line_at(slope, intercept, today_ts), 2),
        slope=slope,
        intercept=intercept,
    )

    # 평행선 오프셋 계산
    if len(offset_prices) == 0:
        par_intercept = intercept
    else:
        if kind == "downtrend":
            ext_idx = int(np.argmin(offset_prices))
        else:
            ext_idx = int(np.argmax(offset_prices))
        ext_ts = float(offset_ts[ext_idx])
        ext_price = float(offset_prices[ext_idx])
        main_at_ext = _line_at(slope, intercept, ext_ts)
        vertical_offset = ext_price - main_at_ext
        par_intercept = intercept + vertical_offset

    parallel_line = ChannelLine(
        start_time=int(t1),
        start_price=round(_line_at(slope, par_intercept, t1), 2),
        end_time=today_ts,
        end_price=round(_line_at(slope, par_intercept, today_ts), 2),
        slope=slope,
        intercept=par_intercept,
    )

    return TrendChannel(kind=kind, main=main_line, parallel=parallel_line, valid=True)


def _today_ts() -> int:
    return int(datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).timestamp())


def _build_downtrend_channel(df: pd.DataFrame) -> TrendChannel | None:
    """하락채널: 최근 2 고점 + 두 고점 사이 최저 저점으로 평행선.
    저점(swing low)이 3개 미만이면 추세 신뢰도 부족으로 미표시."""
    timestamps = np.array([int(idx.timestamp()) for idx in df.index])
    highs = df["high"].values.astype(float)
    lows = df["low"].values.astype(float)
    n = len(df)

    idx_arr = np.arange(n)
    swing_idx = _find_swing_highs(highs)
    if len(swing_idx) < 2:
        return None

    # 저점 3개 이상 확인 — 신뢰도 조건
    if len(_find_swing_lows(lows)) < 3:
        return None

    i1, i2 = int(swing_idx[-2]), int(swing_idx[-1])
    mask = (idx_arr >= i1) & (idx_arr <= i2)

    return _build_channel(
        timestamps=timestamps,
        pivot_indices=swing_idx,
        pivot_prices=highs[swing_idx],
        offset_prices=lows[mask],
        offset_ts=timestamps[mask],
        today_ts=_today_ts(),
        kind="downtrend",
    )


def _build_uptrend_channel(df: pd.DataFrame) -> TrendChannel | None:
    """상승채널: 최근 2 저점 + 두 저점 사이 최고 고점으로 평행선."""
    timestamps = np.array([int(idx.timestamp()) for idx in df.index])
    highs = df["high"].values.astype(float)
    lows = df["low"].values.astype(float)
    n = len(df)

    idx_arr = np.arange(n)
    swing_idx = _find_swing_lows(lows)
    if len(swing_idx) < 2:
        return None

    i1, i2 = int(swing_idx[-2]), int(swing_idx[-1])
    mask = (idx_arr >= i1) & (idx_arr <= i2)

    return _build_channel(
        timestamps=timestamps,
        pivot_indices=swing_idx,
        pivot_prices=lows[swing_idx],
        offset_prices=highs[mask],
        offset_ts=timestamps[mask],
        today_ts=_today_ts(),
        kind="uptrend",
    )


# ── Phase Detection ─────────────────────────────────────────────────────────

@dataclass
class PhaseStep:
    stage: int
    label: str
    completed: bool = False
    completed_time: int | None = None
    completed_price: float | None = None
    volume_ratio: float | None = None


STAGE_LABELS = {
    1: "하락추세선 돌파",
    2: "평행추세선 지지",
    3: "평행추세선 돌파",
    4: "상승추세선 지지",
    5: "상승추세선 돌파",
}


def _volume_ratio_at(df: pd.DataFrame, idx: int) -> float | None:
    """직전 5 거래일 비영 거래량 평균 대비 배율."""
    if idx < 1:
        return None
    start = max(0, idx - 5)
    prior_vols = df["volume"].values[start:idx]
    nonzero = prior_vols[prior_vols > 0]
    if len(nonzero) == 0:
        return None
    signal_vol = float(df["volume"].values[idx])
    if signal_vol == 0:
        return None
    return round(signal_vol / float(nonzero.mean()), 1)


def _detect_phase(
    df: pd.DataFrame,
    down_ch: TrendChannel | None,
    up_ch: TrendChannel | None,
) -> tuple[int, list[PhaseStep], list[int]]:
    """5단계 추세 전환 판정. (current_stage, steps, inflection_times) 반환."""
    timestamps = np.array([int(idx.timestamp()) for idx in df.index])
    closes = df["close"].values.astype(float)
    opens = df["open"].values.astype(float)
    lows = df["low"].values.astype(float)

    steps = [PhaseStep(stage=s, label=STAGE_LABELS[s]) for s in range(1, 6)]
    inflection_times: list[int] = []
    current_stage = 0
    stage_start = 0

    if down_ch is None:
        return 0, steps, inflection_times

    for i in range(len(df)):
        ts = float(timestamps[i])
        close = closes[i]
        open_ = opens[i]
        low = lows[i]

        if current_stage == 0:
            # Stage 1: 하락추세선(main) 종가 상향 돌파
            val = _line_at(down_ch.main.slope, down_ch.main.intercept, ts)
            if close > val:
                steps[0].completed = True
                steps[0].completed_time = int(ts)
                steps[0].completed_price = round(float(close), 2)
                steps[0].volume_ratio = _volume_ratio_at(df, i)
                inflection_times.append(int(ts))
                current_stage = 1
                stage_start = i + 1

        elif current_stage == 1 and i >= stage_start:
            # Stage 2: 하락채널 평행선 ±2% 이내 + 양봉 반등
            val = _line_at(down_ch.parallel.slope, down_ch.parallel.intercept, ts)
            if val > 0 and abs(low - val) / val <= 0.02 and close > open_:
                steps[1].completed = True
                steps[1].completed_time = int(ts)
                steps[1].completed_price = round(float(close), 2)
                steps[1].volume_ratio = _volume_ratio_at(df, i)
                inflection_times.append(int(ts))
                current_stage = 2
                stage_start = i + 1

        elif current_stage == 2 and i >= stage_start:
            # Stage 3: 하락채널 평행선 종가 상향 돌파
            val = _line_at(down_ch.parallel.slope, down_ch.parallel.intercept, ts)
            if close > val:
                steps[2].completed = True
                steps[2].completed_time = int(ts)
                steps[2].completed_price = round(float(close), 2)
                steps[2].volume_ratio = _volume_ratio_at(df, i)
                inflection_times.append(int(ts))
                current_stage = 3
                stage_start = i + 1

        elif current_stage == 3 and i >= stage_start and up_ch is not None:
            # Stage 4: 상승채널 main ±2% 이내 + 양봉 반등
            val = _line_at(up_ch.main.slope, up_ch.main.intercept, ts)
            if val > 0 and abs(low - val) / val <= 0.02 and close > open_:
                steps[3].completed = True
                steps[3].completed_time = int(ts)
                steps[3].completed_price = round(float(close), 2)
                steps[3].volume_ratio = _volume_ratio_at(df, i)
                inflection_times.append(int(ts))
                current_stage = 4
                stage_start = i + 1

        elif current_stage == 4 and i >= stage_start and up_ch is not None:
            # Stage 5: 상승채널 parallel 종가 상향 돌파 (매수급소 완성)
            val = _line_at(up_ch.parallel.slope, up_ch.parallel.intercept, ts)
            if close > val:
                steps[4].completed = True
                steps[4].completed_time = int(ts)
                steps[4].completed_price = round(float(close), 2)
                steps[4].volume_ratio = _volume_ratio_at(df, i)
                inflection_times.append(int(ts))
                current_stage = 5
                break

    return current_stage, steps, inflection_times


# ── Period Result Builder ───────────────────────────────────────────────────

def _build_lines_list(
    down_ch: TrendChannel | None,
    up_ch: TrendChannel | None,
) -> list[dict]:
    lines: list[dict] = []
    if down_ch and down_ch.valid:
        lines.append({
            "kind": "downtrend_main",
            "start": {"time": down_ch.main.start_time, "price": down_ch.main.start_price},
            "end": {"time": down_ch.main.end_time, "price": down_ch.main.end_price},
            "style": {"color": COLOR_DOWN, "dashed": False},
        })
        lines.append({
            "kind": "downtrend_parallel",
            "start": {"time": down_ch.parallel.start_time, "price": down_ch.parallel.start_price},
            "end": {"time": down_ch.parallel.end_time, "price": down_ch.parallel.end_price},
            "style": {"color": COLOR_DOWN, "dashed": True},
        })
    if up_ch and up_ch.valid:
        lines.append({
            "kind": "uptrend_main",
            "start": {"time": up_ch.main.start_time, "price": up_ch.main.start_price},
            "end": {"time": up_ch.main.end_time, "price": up_ch.main.end_price},
            "style": {"color": COLOR_UP, "dashed": False},
        })
        lines.append({
            "kind": "uptrend_parallel",
            "start": {"time": up_ch.parallel.start_time, "price": up_ch.parallel.start_price},
            "end": {"time": up_ch.parallel.end_time, "price": up_ch.parallel.end_price},
            "style": {"color": COLOR_UP, "dashed": True},
        })
    return lines


def _current_line_prices(
    down_ch: TrendChannel | None,
    up_ch: TrendChannel | None,
    today: int,
) -> dict:
    def safe(line: ChannelLine | None) -> float | None:
        if line is None:
            return None
        return round(_line_at(line.slope, line.intercept, today), 2)

    return {
        "downtrend_main":     safe(down_ch.main if down_ch else None),
        "downtrend_parallel": safe(down_ch.parallel if down_ch else None),
        "uptrend_main":       safe(up_ch.main if up_ch else None),
        "uptrend_parallel":   safe(up_ch.parallel if up_ch else None),
    }


def _compute_period(df: pd.DataFrame) -> dict:
    """단일 기간 df → PeriodResult dict."""
    n = len(df)
    today = _today_ts()

    if n < MIN_CANDLES:
        return {
            "candle_count": n,
            "lines": [],
            "current_line_prices": {
                "downtrend_main": None, "downtrend_parallel": None,
                "uptrend_main": None, "uptrend_parallel": None,
            },
            "phase": {
                "current_stage": 0,
                "steps": [],
                "inflection_times": [],
                "insufficient": True,
                "message": f"분석 불가 — 데이터 부족 (최소 {MIN_CANDLES} 거래일 필요)",
            },
        }

    down_ch = _build_downtrend_channel(df)
    up_ch = _build_uptrend_channel(df)

    current_stage, steps, inflection_times = _detect_phase(df, down_ch, up_ch)
    lines = _build_lines_list(down_ch, up_ch)

    steps_list = [
        {
            "stage": s.stage,
            "label": s.label,
            "completed": s.completed,
            "completed_time": s.completed_time,
            "completed_price": s.completed_price,
            "volume_ratio": s.volume_ratio,
        }
        for s in steps
    ]

    return {
        "candle_count": n,
        "lines": lines,
        "current_line_prices": _current_line_prices(down_ch, up_ch, today),
        "phase": {
            "current_stage": current_stage,
            "steps": steps_list,
            "inflection_times": inflection_times,
            "insufficient": len(lines) == 0,
            "message": None,
        },
    }


def _empty_period(msg: str = "분석 불가 — 서비스 오류") -> dict:
    return {
        "candle_count": 0,
        "lines": [],
        "current_line_prices": {
            "downtrend_main": None, "downtrend_parallel": None,
            "uptrend_main": None, "uptrend_parallel": None,
        },
        "phase": {
            "current_stage": 0,
            "steps": [],
            "inflection_times": [],
            "insufficient": True,
            "message": msg,
        },
    }


# ── Main Entry Point ────────────────────────────────────────────────────────

def analyze_all_periods(symbol: str, market: str) -> dict:
    """4기간(1m/3m/6m/12m) 추세선 채널 일괄 계산. 블로킹 — to_thread로 감싸서 호출."""
    now = time.time()
    cache_key = (symbol, market)
    hit = _cache.get(cache_key)
    if hit and (now - hit[0]) < CACHE_TTL:
        return hit[1]

    from services.chart_cache import get_chart_data  # noqa: PLC0415

    try:
        df = asyncio.run(get_chart_data(symbol, market, "1d", 260))
    except RuntimeError:
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(1) as pool:
            df = pool.submit(
                lambda: asyncio.run(get_chart_data(symbol, market, "1d", 260))
            ).result()
    except Exception as e:
        logger.debug(f"trendline_channels chart_data 실패 [{market}/{symbol}]: {e}")
        df = None

    if df is None or len(df) == 0:
        result = _make_empty_result(symbol, market)
        _cache[cache_key] = (now, result)
        return result

    periods: dict[str, dict] = {}
    for period_key, n_candles in PERIOD_CANDLES.items():
        period_df = df.tail(n_candles)
        try:
            periods[period_key] = _compute_period(period_df)
        except Exception as e:
            logger.debug(
                f"trendline_channels period={period_key} 실패 [{market}/{symbol}]: {e}"
            )
            periods[period_key] = _empty_period()

    result = {
        "symbol": symbol,
        "market": market,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "periods": periods,
    }
    _cache[cache_key] = (now, result)
    return result


def _make_empty_result(symbol: str, market: str) -> dict:
    return {
        "symbol": symbol,
        "market": market,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "periods": {k: _empty_period("분석 불가 — 데이터 없음") for k in PERIOD_CANDLES},
    }
