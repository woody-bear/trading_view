"""주가 추세 분류 + 매매 후보 구간 산출 (024-trend-trading-signals).

종목 상세 차트 분석 탭에서만 on-demand 호출. 기존 스캔·BUY 신호·알림·스케줄러·
보호 규칙(rules/*.md)에 어떠한 변경·참조도 없음 (FR-013 완전 격리).

알고리즘: 최근 120봉 일봉 OHLC만 사용 → 고점·저점 피크 검출 → 선형 회귀 → 4종 분류.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from enum import Enum

import numpy as np
from loguru import logger

# ── Constants ────────────────────────────────────────────────────────────────

WINDOW_SIZE = 120
PEAK_WINDOW = 5
EPSILON = 0.05          # 기울기 임계 (% per day 기준)
NEAR_PCT = 2.0          # 현재가 ±2% 이내면 is_near
BOX_RANGE_PCT = 8.0     # 박스권 판정: 변동폭 < 8%
CACHE_TTL = 60.0
DISCLAIMER = "본 안내는 참고용이며 투자 책임은 사용자에게 있습니다."

_cache: dict[tuple[str, str], tuple[float, dict]] = {}


class TrendType(str, Enum):
    UPTREND = "uptrend"
    DOWNTREND = "downtrend"
    SIDEWAYS = "sideways"
    TRIANGLE = "triangle"
    UNKNOWN = "unknown"
    INSUFFICIENT_DATA = "insufficient_data"


# ── Peak Detection (scipy 미설치 → 롤링 윈도우 직접 구현) ──────────────────

def _find_local_peaks(arr: np.ndarray, window: int = PEAK_WINDOW) -> np.ndarray:
    """롤링 윈도우 기반 local maxima 인덱스 반환."""
    peaks = []
    n = len(arr)
    for i in range(window, n - window):
        if arr[i] == max(arr[i - window: i + window + 1]):
            peaks.append(i)
    return np.array(peaks, dtype=int) if peaks else np.array([], dtype=int)


def _find_local_troughs(arr: np.ndarray, window: int = PEAK_WINDOW) -> np.ndarray:
    """롤링 윈도우 기반 local minima 인덱스 반환."""
    troughs = []
    n = len(arr)
    for i in range(window, n - window):
        if arr[i] == min(arr[i - window: i + window + 1]):
            troughs.append(i)
    return np.array(troughs, dtype=int) if troughs else np.array([], dtype=int)


def _detect_peaks(closes: np.ndarray, highs: np.ndarray, lows: np.ndarray,
                  window: int = PEAK_WINDOW) -> tuple[np.ndarray, np.ndarray]:
    """고점(highs의 피크) · 저점(lows의 트로프) 인덱스 반환."""
    peak_idx = _find_local_peaks(highs, window)
    trough_idx = _find_local_troughs(lows, window)
    return peak_idx, trough_idx


# ── Linear Regression ────────────────────────────────────────────────────────

def _fit_line(indices: np.ndarray, values: np.ndarray) -> tuple[float, float]:
    """np.polyfit(deg=1) 래퍼. (slope, intercept) 반환. 2개 미만이면 (0, 0)."""
    if len(indices) < 2:
        return 0.0, 0.0
    slope, intercept = np.polyfit(indices.astype(float), values.astype(float), 1)
    return float(slope), float(intercept)


def _line_value_at(slope: float, intercept: float, idx: float) -> float:
    """회귀선의 특정 인덱스에서의 값."""
    return slope * idx + intercept


# ── Classification ───────────────────────────────────────────────────────────

def _classify(closes: np.ndarray, highs: np.ndarray, lows: np.ndarray) -> dict:
    """120봉 OHLC → 추세 분류 + 메타 반환."""
    n = len(closes)
    if n < WINDOW_SIZE:
        return {
            "type": TrendType.INSUFFICIENT_DATA.value,
            "confidence": None,
            "window_size": WINDOW_SIZE,
            "slope_high": None, "slope_low": None,
            "last_close": float(closes[-1]) if n > 0 else None,
        }

    # 뒤에서 WINDOW_SIZE만큼만 사용 (FR-002: 120봉)
    c = closes[-WINDOW_SIZE:]
    h = highs[-WINDOW_SIZE:]
    lo = lows[-WINDOW_SIZE:]

    peak_idx, trough_idx = _detect_peaks(c, h, lo)

    if len(peak_idx) < 2 or len(trough_idx) < 2:
        return {
            "type": TrendType.UNKNOWN.value,
            "confidence": 0.0,
            "window_size": WINDOW_SIZE,
            "slope_high": 0.0, "slope_low": 0.0,
            "last_close": float(c[-1]),
        }

    slope_high, intercept_high = _fit_line(peak_idx, h[peak_idx])
    slope_low, intercept_low = _fit_line(trough_idx, lo[trough_idx])

    last_close = float(c[-1])
    eps = max(EPSILON, 0.001)

    # 가격 대비 정규화 (% per day)
    norm_high = slope_high / last_close * 100 if last_close else 0
    norm_low = slope_low / last_close * 100 if last_close else 0

    # 분류 분기
    price_range_pct = (float(h.max()) - float(lo.min())) / last_close * 100 if last_close else 999

    if norm_high > eps and norm_low > eps:
        trend_type = TrendType.UPTREND
    elif norm_high < -eps and norm_low < -eps:
        trend_type = TrendType.DOWNTREND
    elif norm_low > eps and norm_high < -eps:
        trend_type = TrendType.TRIANGLE
    elif abs(norm_high) < eps and abs(norm_low) < eps and price_range_pct < BOX_RANGE_PCT:
        trend_type = TrendType.SIDEWAYS
    else:
        trend_type = TrendType.UNKNOWN

    confidence = min(1.0, min(abs(norm_high), abs(norm_low)) / eps) if trend_type != TrendType.UNKNOWN else 0.0

    return {
        "type": trend_type.value,
        "confidence": round(confidence, 2),
        "window_size": WINDOW_SIZE,
        "slope_high": round(norm_high, 4),
        "slope_low": round(norm_low, 4),
        "last_close": last_close,
        # 내부용 — 매매 시점 산출에 사용
        "_peak_idx": peak_idx,
        "_trough_idx": trough_idx,
        "_slope_high_raw": slope_high,
        "_intercept_high": intercept_high,
        "_slope_low_raw": slope_low,
        "_intercept_low": intercept_low,
        "_highs": h,
        "_lows": lo,
        "_n": WINDOW_SIZE,
    }


# ── Buy Signals (FR-004, PDF 매수 규칙) ──────────────────────────────────────

def _compute_buy_signals(cls: dict) -> list[dict]:
    trend = cls["type"]
    last_close = cls.get("last_close") or 0
    if trend in (TrendType.UNKNOWN.value, TrendType.INSUFFICIENT_DATA.value) or not last_close:
        return []

    n = cls.get("_n", WINDOW_SIZE)
    signals = []

    if trend == TrendType.UPTREND.value:
        support_price = _line_value_at(cls["_slope_low_raw"], cls["_intercept_low"], n - 1)
        signals.append(_signal("buy_candidate", support_price, "지지선 근처 반등 매수 (장대양봉 확인)", last_close))
        resist_price = _line_value_at(cls["_slope_high_raw"], cls["_intercept_high"], n - 1)
        signals.append(_signal("buy_candidate", resist_price, "저항선 돌파 시 추가 매수 (장대양봉 + 거래량↑ 확인)", last_close))

    elif trend == TrendType.DOWNTREND.value:
        support_price = _line_value_at(cls["_slope_low_raw"], cls["_intercept_low"], n - 1)
        if abs(cls.get("slope_low", 0)) > EPSILON * 3:
            signals.append(_signal("watch", None, "하락 추세 강함 — 추가 하락 가능성, 관망 권장", last_close))
        else:
            signals.append(_signal("buy_candidate", support_price, "지지선 근처 반등 매수 (추세 약화 + 양봉 확인)", last_close))

    elif trend == TrendType.SIDEWAYS.value:
        lows_arr = cls.get("_lows", np.array([]))
        highs_arr = cls.get("_highs", np.array([]))
        if len(lows_arr) > 0 and len(highs_arr) > 0:
            box_low = float(lows_arr.min())
            box_high = float(highs_arr.max())
            signals.append(_signal("buy_candidate", box_low, "박스 하단 지지 매수 (반등 확인)", last_close))
            signals.append(_signal("buy_candidate", box_high * 1.01, "박스 상단 돌파 시 매수 (거래량↑ 확인)", last_close))

    elif trend == TrendType.TRIANGLE.value:
        resist_price = _line_value_at(cls["_slope_high_raw"], cls["_intercept_high"], n - 1)
        signals.append(_signal("buy_candidate", resist_price * 1.01, "고점 추세선 돌파 시 매수 (최고 매수시점)", last_close))

    return signals


# ── Sell Signals (FR-005, PDF 매도 규칙) ──────────────────────────────────────

def _compute_sell_signals(cls: dict) -> list[dict]:
    trend = cls["type"]
    last_close = cls.get("last_close") or 0
    if trend in (TrendType.UNKNOWN.value, TrendType.INSUFFICIENT_DATA.value) or not last_close:
        return []

    n = cls.get("_n", WINDOW_SIZE)
    signals = []

    if trend == TrendType.UPTREND.value:
        resist_price = _line_value_at(cls["_slope_high_raw"], cls["_intercept_high"], n - 1)
        support_price = _line_value_at(cls["_slope_low_raw"], cls["_intercept_low"], n - 1)
        signals.append(_signal("sell_candidate_1", resist_price, "저항선 반락 시 1차 매도 (음봉 + 거래량↑ 확인)", last_close))
        signals.append(_signal("sell_candidate_2", support_price * 0.99, "지지선 하향 이탈 시 강한 매도 (추세 전환 경계)", last_close))

    elif trend == TrendType.DOWNTREND.value:
        resist_price = _line_value_at(cls["_slope_high_raw"], cls["_intercept_high"], n - 1)
        support_price = _line_value_at(cls["_slope_low_raw"], cls["_intercept_low"], n - 1)
        signals.append(_signal("sell_candidate_1", resist_price, "저항선 반락 시 매도 (하락 추세 지속)", last_close))
        signals.append(_signal("sell_candidate_2", support_price * 0.99, "지지선 붕괴 시 강한 매도 (추가 하락 경계)", last_close))

    elif trend == TrendType.SIDEWAYS.value:
        highs_arr = cls.get("_highs", np.array([]))
        lows_arr = cls.get("_lows", np.array([]))
        if len(highs_arr) > 0 and len(lows_arr) > 0:
            box_high = float(highs_arr.max())
            box_low = float(lows_arr.min())
            signals.append(_signal("sell_candidate_1", box_high, "박스 상단 저항 시 매도 (반락 확인)", last_close))
            signals.append(_signal("sell_candidate_2", box_low * 0.99, "박스 하단 이탈 시 강한 매도 (추세 붕괴)", last_close))

    elif trend == TrendType.TRIANGLE.value:
        support_price = _line_value_at(cls["_slope_low_raw"], cls["_intercept_low"], n - 1)
        signals.append(_signal("sell_candidate_2", support_price * 0.99, "저점 추세선 이탈 시 강한 매도 (수렴 하향 이탈)", last_close))

    return signals


def _signal(kind: str, price: float | None, condition: str, last_close: float) -> dict:
    if price is not None:
        price = round(price, 2)
        dist = round((price - last_close) / last_close * 100, 2) if last_close else 0
        is_near = abs(dist) <= NEAR_PCT
    else:
        dist = None
        is_near = False
    return {"kind": kind, "price": price, "condition": condition, "distance_pct": dist, "is_near": is_near}


# ── Trend Lines (FR-006 — 차트 오버레이용) ───────────────────────────────────

def _compute_trend_lines(cls: dict, timestamps: list[int]) -> list[dict]:
    trend = cls["type"]
    if trend in (TrendType.UNKNOWN.value, TrendType.INSUFFICIENT_DATA.value):
        return []

    n = cls.get("_n", WINDOW_SIZE)
    ts = timestamps[-n:] if len(timestamps) >= n else timestamps

    def _line(kind: str, slope_raw: float, intercept: float, color: str) -> dict:
        i_start = 0
        i_end = len(ts) - 1
        return {
            "kind": kind,
            "start": {"time": ts[i_start], "price": round(_line_value_at(slope_raw, intercept, i_start), 2)},
            "end": {"time": ts[i_end], "price": round(_line_value_at(slope_raw, intercept, i_end), 2)},
            "style": {"color": color, "dashed": True},
        }

    lines = []
    if trend == TrendType.UPTREND.value:
        lines.append(_line("support_up", cls["_slope_low_raw"], cls["_intercept_low"], "#22c55e"))
        lines.append(_line("resistance_up", cls["_slope_high_raw"], cls["_intercept_high"], "#22c55e"))
    elif trend == TrendType.DOWNTREND.value:
        lines.append(_line("support_down", cls["_slope_low_raw"], cls["_intercept_low"], "#ef4444"))
        lines.append(_line("resistance_down", cls["_slope_high_raw"], cls["_intercept_high"], "#ef4444"))
    elif trend == TrendType.SIDEWAYS.value:
        highs_arr = cls.get("_highs", np.array([]))
        lows_arr = cls.get("_lows", np.array([]))
        if len(highs_arr) > 0 and len(lows_arr) > 0 and len(ts) >= 2:
            box_high = round(float(highs_arr.max()), 2)
            box_low = round(float(lows_arr.min()), 2)
            lines.append({"kind": "box_top", "start": {"time": ts[0], "price": box_high},
                          "end": {"time": ts[-1], "price": box_high}, "style": {"color": "#3b82f6", "dashed": True}})
            lines.append({"kind": "box_bottom", "start": {"time": ts[0], "price": box_low},
                          "end": {"time": ts[-1], "price": box_low}, "style": {"color": "#3b82f6", "dashed": True}})
    elif trend == TrendType.TRIANGLE.value:
        lines.append(_line("triangle_resistance", cls["_slope_high_raw"], cls["_intercept_high"], "#eab308"))
        lines.append(_line("triangle_support", cls["_slope_low_raw"], cls["_intercept_low"], "#eab308"))

    return lines


# ── Main Entry Point ─────────────────────────────────────────────────────────

def analyze(symbol: str, market: str) -> dict:
    """추세 분류 + 매매 후보 + 오버레이 라인 전체 산출. 블로킹 — to_thread로 감싸서 호출."""
    now = time.time()
    cache_key = (symbol, market)
    hit = _cache.get(cache_key)
    if hit and (now - hit[0]) < CACHE_TTL:
        return hit[1]

    from services.chart_cache import get_chart_data

    try:
        df = asyncio.run(get_chart_data(symbol, market, "1d", 200))
    except RuntimeError:
        # 이미 이벤트 루프가 돌고 있으면 새 스레드에서 실행
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(1) as pool:
            df = pool.submit(lambda: asyncio.run(get_chart_data(symbol, market, "1d", 200))).result()
    except Exception as e:
        logger.debug(f"trend_analysis chart_data 실패 [{market}/{symbol}]: {e}")
        df = None

    if df is None or len(df) == 0:
        result = _empty_response(symbol, market, TrendType.INSUFFICIENT_DATA)
        _cache[cache_key] = (now, result)
        return result

    closes = df["close"].values.astype(float)
    highs = df["high"].values.astype(float)
    lows = df["low"].values.astype(float)
    timestamps = [int(idx.timestamp()) for idx in df.index]

    cls = _classify(closes, highs, lows)
    buy_signals = _compute_buy_signals(cls)
    sell_signals = _compute_sell_signals(cls)
    lines = _compute_trend_lines(cls, timestamps)

    evaluated_at = datetime.now(timezone.utc).isoformat()

    # 내부 필드 제거
    classification = {k: v for k, v in cls.items() if not k.startswith("_")}
    classification["evaluated_at"] = evaluated_at

    result = {
        "symbol": symbol,
        "market": market,
        "classification": classification,
        "lines": lines,
        "buy_signals": buy_signals,
        "sell_signals": sell_signals,
        "disclaimer": DISCLAIMER,
        "current_price": cls.get("last_close"),
        "evaluated_at": evaluated_at,
    }
    _cache[cache_key] = (now, result)
    return result


def _empty_response(symbol: str, market: str, trend_type: TrendType) -> dict:
    evaluated_at = datetime.now(timezone.utc).isoformat()
    return {
        "symbol": symbol,
        "market": market,
        "classification": {
            "type": trend_type.value,
            "confidence": None, "window_size": WINDOW_SIZE,
            "slope_high": None, "slope_low": None, "last_close": None,
            "evaluated_at": evaluated_at,
        },
        "lines": [], "buy_signals": [], "sell_signals": [],
        "disclaimer": DISCLAIMER, "current_price": None, "evaluated_at": evaluated_at,
    }
