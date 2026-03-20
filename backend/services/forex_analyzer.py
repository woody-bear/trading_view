"""달러리치 스타일 환율 분석 — DXY vs USDKRW 선형 회귀 기반 적정환율."""

import asyncio
from dataclasses import dataclass

import numpy as np
import pandas as pd
import yfinance as yf
from loguru import logger

PERIODS = {
    "1M": 22,   # 약 1개월 영업일
    "3M": 66,
    "6M": 132,
    "1Y": 252,
}


@dataclass
class GaugeData:
    """게이지 바 1개 데이터."""
    label: str
    current: float
    lower: float
    center: float
    upper: float
    gap_lower_pct: float   # 현재 vs 하한 괴리율
    gap_center_pct: float  # 현재 vs 적정 괴리율
    gap_upper_pct: float   # 현재 vs 상한 괴리율
    is_buy: bool           # 매수 적합 여부


@dataclass
class ForexAnalysis:
    period: str
    dxy: float
    usdkrw: float
    fair_value: float
    dollar_gap_52w: float
    gauge_krw: GaugeData
    gauge_dxy: GaugeData
    gauge_gap: GaugeData
    gauge_fair: GaugeData
    verdict: str        # BUY / WAIT / SELL
    verdict_score: int  # 0~4 (매수적합 게이지 수)
    next_buy_price: float  # 다음날 매수 적정가


async def analyze(period: str = "3M") -> ForexAnalysis:
    """기간별 환율 분석."""
    days = PERIODS.get(period, 66)

    # 순차 실행 — 항상 2년치 데이터 가져옴 (52주 범위 확보)
    dxy_df = await asyncio.to_thread(_fetch, "DX=F", 504)
    krw_df = await asyncio.to_thread(_fetch, "USDKRW=X", 504)

    if dxy_df is None or krw_df is None or dxy_df.empty or krw_df.empty:
        raise ValueError("데이터 수집 실패")

    # 공통 날짜로 정렬
    merged = pd.merge(
        dxy_df[["close"]].rename(columns={"close": "dxy"}),
        krw_df[["close"]].rename(columns={"close": "krw"}),
        left_index=True, right_index=True, how="inner",
    ).dropna()

    if len(merged) < days:
        days = len(merged)

    recent = merged.tail(days)
    full_52w = merged.tail(252)

    current_dxy = float(merged["dxy"].iloc[-1])
    current_krw = float(merged["krw"].iloc[-1])

    # 52주 범위
    krw_52w_high = float(full_52w["krw"].max())
    krw_52w_low = float(full_52w["krw"].min())
    dxy_52w_high = float(full_52w["dxy"].max())
    dxy_52w_low = float(full_52w["dxy"].min())
    dxy_52w_mean = float(full_52w["dxy"].mean())

    # 기간별 평균/최저
    krw_period_avg = float(recent["krw"].mean())
    krw_period_low = float(recent["krw"].min())

    # === 달러 갭 비율 = 달러지수 / 원달러환율 × 100 ===
    dollar_gap_current = current_dxy / current_krw * 100

    # 기간별 평균 달러 갭 비율 (달러리치 동일: 선택 기간의 평균 갭)
    recent_gaps = recent["dxy"] / recent["krw"] * 100
    avg_gap_period = float(recent_gaps.mean())

    # === 적정 환율 = 현재 달러지수 ÷ 기간 평균 달러 갭 비율 × 100 ===
    fair_value = current_dxy / avg_gap_period * 100

    # 적정환율 밴드 (회귀 잔차 σ)
    a, b = np.polyfit(recent["dxy"].values, recent["krw"].values, 1)
    predicted = a * recent["dxy"].values + b
    residuals = recent["krw"].values - predicted
    sigma = float(np.std(residuals))

    # === 4개 게이지 (책 기준 투자 적합성) ===

    # (1) 원달러 환율: 현재 < 기간평균 → 매수 적합
    gauge_krw = _make_gauge(
        "원달러 환율", current_krw,
        lower=krw_period_low, center=krw_period_avg, upper=krw_52w_high,
        buy_if_below_center=True,
    )

    # (2) 달러 인덱스: 현재 < 52주평균 → 매수 적합
    gauge_dxy = _make_gauge(
        "달러 인덱스", current_dxy,
        lower=dxy_52w_low, center=dxy_52w_mean, upper=dxy_52w_high,
        buy_if_below_center=True,
    )

    # (3) 달러 갭 비율: 현재 < 기간평균 → 매수 적합
    gap_52w_all = full_52w["dxy"] / full_52w["krw"] * 100
    gap_52w_low = float(gap_52w_all.min())
    gap_52w_high = float(gap_52w_all.max())
    gauge_gap = GaugeData(
        label="달러 갭 비율",
        current=round(dollar_gap_current, 2),
        lower=round(gap_52w_low, 2),
        center=round(avg_gap_period, 2),
        upper=round(gap_52w_high, 2),
        gap_lower_pct=round((dollar_gap_current / gap_52w_low - 1) * 100, 2),
        gap_center_pct=round((dollar_gap_current / avg_gap_period - 1) * 100 if avg_gap_period else 0, 2),
        gap_upper_pct=round((dollar_gap_current / gap_52w_high - 1) * 100, 2),
        is_buy=bool(dollar_gap_current < avg_gap_period),
    )

    # (4) 적정 환율: 현재 < 적정환율 → 매수 적합
    gauge_fair = _make_gauge(
        "적정 환율", current_krw,
        lower=fair_value - sigma, center=fair_value, upper=fair_value + sigma,
        buy_if_below_center=True,
    )

    # 종합 판정 (책 기준: 4가지 모두 충족 시 매수 적합)
    buy_count = sum([gauge_krw.is_buy, gauge_dxy.is_buy, gauge_gap.is_buy, gauge_fair.is_buy])
    if buy_count >= 3:
        verdict = "BUY"
    elif buy_count >= 2:
        verdict = "WAIT"
    else:
        verdict = "SELL"

    # 다음날 매수 적정가: BB 하단 or 적정환율 - 0.5σ 중 높은 값
    bb_lower = _calc_bb_lower(krw_df)
    next_buy = max(fair_value - sigma * 0.5, bb_lower) if bb_lower else fair_value - sigma * 0.5

    return ForexAnalysis(
        period=period,
        dxy=round(current_dxy, 2),
        usdkrw=round(current_krw, 2),
        fair_value=round(fair_value, 2),
        dollar_gap_52w=round(avg_gap_period, 2),  # 헤더 표시용: 기간 평균 달러 갭 비율
        gauge_krw=gauge_krw,
        gauge_dxy=gauge_dxy,
        gauge_gap=gauge_gap,
        gauge_fair=gauge_fair,
        verdict=verdict,
        verdict_score=buy_count,
        next_buy_price=round(next_buy, 2),
    )


async def get_chart_data() -> dict:
    """환율 + DXY 차트 데이터."""
    dxy_df = await asyncio.to_thread(_fetch, "DX=F", 504)
    krw_df = await asyncio.to_thread(_fetch, "USDKRW=X", 504)

    if dxy_df is None or krw_df is None:
        return {"dxy": [], "krw": [], "fair_bands": {}}

    dxy_pts = [{"time": int(idx.timestamp()), "value": float(r["close"])}
               for idx, r in dxy_df.iterrows() if not pd.isna(r["close"])]
    krw_pts = [{"time": int(idx.timestamp()), "value": float(r["close"])}
               for idx, r in krw_df.iterrows() if not pd.isna(r["close"])]

    # 적정환율 밴드 (3M 기준 롤링)
    merged = pd.merge(
        dxy_df[["close"]].rename(columns={"close": "dxy"}),
        krw_df[["close"]].rename(columns={"close": "krw"}),
        left_index=True, right_index=True, how="inner",
    ).dropna()

    fair_line = []
    upper_line = []
    lower_line = []
    for i in range(66, len(merged)):
        window = merged.iloc[i - 66:i]
        a, b = np.polyfit(window["dxy"].values, window["krw"].values, 1)
        dxy_val = merged["dxy"].iloc[i]
        fair = a * dxy_val + b
        resid = window["krw"].values - (a * window["dxy"].values + b)
        sig = float(np.std(resid))
        ts = int(merged.index[i].timestamp())
        fair_line.append({"time": ts, "value": round(float(fair), 2)})
        upper_line.append({"time": ts, "value": round(float(fair + sig), 2)})
        lower_line.append({"time": ts, "value": round(float(fair - sig), 2)})

    return {
        "dxy": dxy_pts,
        "krw": krw_pts,
        "fair_line": fair_line,
        "upper_line": upper_line,
        "lower_line": lower_line,
    }


def _fetch(ticker: str, days: int) -> pd.DataFrame | None:
    try:
        # period를 연 단위로 변환 (일 단위는 yfinance에서 불안정)
        if days <= 30:
            period = "1mo"
        elif days <= 90:
            period = "3mo"
        elif days <= 180:
            period = "6mo"
        elif days <= 365:
            period = "1y"
        else:
            period = "2y"

        data = yf.download(ticker, period=period, interval="1d", progress=False, auto_adjust=True)
        if data is None or data.empty:
            return None

        # MultiIndex 처리 — 단일 티커도 (Price, Ticker) 형태
        if isinstance(data.columns, pd.MultiIndex):
            try:
                data = data.xs(ticker, level="Ticker", axis=1)
            except (KeyError, TypeError):
                data.columns = data.columns.get_level_values(0)

        df = data[["Close"]].copy()
        df.columns = ["close"]
        return df.dropna()
    except Exception as e:
        logger.error(f"환율 데이터 수집 실패 ({ticker}): {e}")
        return None


def _make_gauge(label, current, lower, center, upper, buy_if_below_center=True) -> GaugeData:
    gap_l = round((current / lower - 1) * 100, 2) if lower else 0
    gap_c = round((current / center - 1) * 100, 2) if center else 0
    gap_u = round((current / upper - 1) * 100, 2) if upper else 0
    is_buy = bool(current < center) if buy_if_below_center else bool(current > center)
    return GaugeData(
        label=label, current=round(current, 2),
        lower=round(lower, 2), center=round(center, 2), upper=round(upper, 2),
        gap_lower_pct=gap_l, gap_center_pct=gap_c, gap_upper_pct=gap_u,
        is_buy=is_buy,
    )


async def _calc_weighted_fair(merged: pd.DataFrame, current_dxy: float) -> float:
    """가중 적정환율 — 단기 가중치 높게."""
    weights = {"1M": 0.4, "3M": 0.3, "6M": 0.2, "1Y": 0.1}
    total = 0.0
    for period, w in weights.items():
        days = PERIODS[period]
        if len(merged) < days:
            days = len(merged)
        window = merged.tail(days)
        a, b = np.polyfit(window["dxy"].values, window["krw"].values, 1)
        total += w * (a * current_dxy + b)
    return total


def _calc_bb_lower(krw_df: pd.DataFrame, length: int = 20) -> float | None:
    if krw_df is None or len(krw_df) < length:
        return None
    ma = krw_df["close"].rolling(length).mean()
    std = krw_df["close"].rolling(length).std()
    bb_lower = ma - 2 * std
    val = bb_lower.iloc[-1]
    return float(val) if not pd.isna(val) else None
