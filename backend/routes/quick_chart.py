"""워치리스트에 없는 종목도 즉석 차트 데이터를 생성하는 엔드포인트."""

import asyncio
from typing import Optional

import pandas as pd
from fastapi import APIRouter
from loguru import logger

from indicators.bollinger import calculate_bb, detect_squeeze
from indicators.ema import calculate_ema
from indicators.macd import calculate_macd
from indicators.rsi import calculate_rsi
from indicators.volume import calculate_volume_ratio

router = APIRouter(tags=["quick-chart"])


def _resolve_name(symbol: str, market: str, ticker: str) -> str:
    """종목명 조회 — 한국 종목은 pykrx, 해외는 yfinance."""
    try:
        if market in ("KR", "KOSPI", "KOSDAQ"):
            from pykrx import stock
            name = stock.get_market_ticker_name(symbol)
            if name:
                return name
        else:
            import yfinance as yf
            info = yf.Ticker(ticker).info
            return info.get("shortName") or info.get("longName") or symbol
    except Exception:
        pass
    return symbol


@router.get("/chart/quick")
async def quick_chart(symbol: str, market: str, timeframe: str = "1d", limit: int = 200):
    """차트 데이터 — SQLite 캐시 우선, yfinance fallback."""
    from services.chart_cache import get_chart_data, resolve_name

    empty = {"candles": [], "indicators": {}, "squeeze_dots": [], "markers": [], "current": None,
             "symbol": symbol, "display_name": symbol, "timeframe": timeframe}

    try:
        df = await get_chart_data(symbol, market, timeframe, limit)
    except Exception as e:
        logger.error(f"차트 데이터 조회 실패 [{market}/{symbol}]: {e}")
        return empty

    if df is None or df.empty:
        return empty

    timestamps = [int(idx.timestamp()) for idx in df.index]
    candles = [{"time": ts, "open": float(r["open"]), "high": float(r["high"]),
                "low": float(r["low"]), "close": float(r["close"]), "volume": float(r["volume"])}
               for ts, (_, r) in zip(timestamps, df.iterrows())]

    indicators = _calc(df, timestamps)
    squeeze_dots = _squeeze(df, timestamps)
    markers = _sim_signals(df, timestamps)
    current = _current(df)
    display_name = await resolve_name(symbol, market)

    return {
        "symbol": symbol, "display_name": display_name, "timeframe": timeframe,
        "candles": candles, "indicators": indicators,
        "squeeze_dots": squeeze_dots, "markers": markers, "current": current,
    }


def _calc(df, timestamps):
    ind = {}

    def add(series, key):
        if series is None: return
        pts = []
        for i, ts in enumerate(timestamps):
            if i < len(series):
                v = series.iloc[i]
                if v is not None and not pd.isna(v):
                    pts.append({"time": ts, "value": float(v)})
        ind[key] = pts

    if len(df) >= 20:
        bb = calculate_bb(df)
        add(bb.get("upper"), "bb_upper"); add(bb.get("middle"), "bb_middle"); add(bb.get("lower"), "bb_lower")
    if len(df) >= 14: add(calculate_rsi(df), "rsi")
    if len(df) >= 26:
        m = calculate_macd(df)
        add(m.get("macd_line"), "macd_line"); add(m.get("signal_line"), "macd_signal"); add(m.get("histogram"), "macd_hist")
    e = calculate_ema(df)
    add(e.get("ema_20"), "ema_20"); add(e.get("ema_50"), "ema_50"); add(e.get("ema_200"), "ema_200")
    return ind


def _squeeze(df, timestamps):
    bb = calculate_bb(df) if len(df) >= 20 else {}
    sq = detect_squeeze(df)
    bb_lower = bb.get("lower")
    colors = ["#22c55e", "#eab308", "#f97316", "#ef4444"]
    dots = []
    for i, ts in enumerate(timestamps):
        if i < len(sq):
            lvl = int(sq.iloc[i]) if not pd.isna(sq.iloc[i]) else 0
            if bb_lower is not None and i < len(bb_lower) and not pd.isna(bb_lower.iloc[i]):
                val = float(bb_lower.iloc[i]) * 0.985
            else:
                val = float(df["low"].iloc[i]) * 0.985
            dots.append({"time": ts, "value": round(val, 2), "color": colors[lvl], "level": lvl})
    return dots


def _sim_signals(df, timestamps):
    """charts.py의 _simulate_signals와 동일한 로직."""
    from routes.charts import _simulate_signals
    return _simulate_signals(df, timestamps, {}, "1d")


def _current(df):
    if len(df) < 20: return None
    bb = calculate_bb(df)
    rsi = calculate_rsi(df)
    macd = calculate_macd(df)
    vol = calculate_volume_ratio(df)
    sq = detect_squeeze(df)
    ema = calculate_ema(df)

    price = float(df["close"].iloc[-1])
    open_price = float(df["open"].iloc[-1])
    change_pct = ((price - open_price) / open_price * 100) if open_price else 0

    def safe(series, idx=-1):
        if series is None: return None
        v = series.iloc[idx]
        return None if pd.isna(v) else float(v)

    e20 = safe(ema.get("ema_20")) or 0
    e50 = safe(ema.get("ema_50")) or 0
    e200 = safe(ema.get("ema_200")) or 0
    lvl = int(sq.iloc[-1]) if not pd.isna(sq.iloc[-1]) else 0

    return {
        "price": round(price, 2),
        "change_pct": round(change_pct, 2),
        "pct_b": round(safe(bb.get("pct_b")) * 100, 1) if safe(bb.get("pct_b")) is not None else None,
        "bandwidth": round(safe(bb.get("width")) * 100, 2) if safe(bb.get("width")) is not None else None,
        "bb_pct_b": safe(bb.get("pct_b")),
        "bb_width": safe(bb.get("width")),
        "rsi": round(safe(rsi), 1) if safe(rsi) is not None else None,
        "macd_hist": round(safe(macd.get("histogram")), 4) if safe(macd.get("histogram")) is not None else None,
        "volume_ratio": round(safe(vol), 1) if safe(vol) is not None else None,
        "squeeze": ["NO SQ", "LOW SQ", "MID SQ", "MAX SQ"][lvl],
        "squeeze_level": lvl,
        "ema_20": round(e20, 2),
        "ema_50": round(e50, 2),
        "ema_200": round(e200, 2),
        "trend": "BULL" if e20 > e50 > e200 else "BEAR" if e20 < e50 < e200 else "NEUTRAL",
        **_judge(df, bb, rsi, macd, vol, sq, ema, price, change_pct),
    }


def _judge(df, bb, rsi, macd, vol, sq, ema, price, change_pct) -> dict:
    """SignalEngine으로 BUY/SELL/NEUTRAL 판정."""
    try:
        from indicators.signal_engine import IndicatorValues, SignalEngine

        def safe(series):
            if series is None: return None
            v = series.iloc[-1]
            return None if pd.isna(v) else float(v)

        def safe_prev(series):
            if series is None or len(series) < 2: return None
            v = series.iloc[-2]
            return None if pd.isna(v) else float(v)

        iv = IndicatorValues(
            price=price,
            change_pct=change_pct,
            rsi=safe(rsi),
            bb_pct_b=safe(bb.get("pct_b")),
            bb_width=safe(bb.get("width")),
            bb_upper=safe(bb.get("upper")),
            bb_middle=safe(bb.get("middle")),
            bb_lower=safe(bb.get("lower")),
            squeeze_level=int(sq.iloc[-1]) if not pd.isna(sq.iloc[-1]) else 0,
            macd_line=safe(macd.get("macd_line")),
            macd_signal=safe(macd.get("signal_line")),
            macd_hist=safe(macd.get("histogram")),
            macd_hist_prev=safe_prev(macd.get("histogram")),
            volume_ratio=safe(vol),
            ema_20=safe(ema.get("ema_20")),
            ema_50=safe(ema.get("ema_50")),
            ema_200=safe(ema.get("ema_200")),
        )
        engine = SignalEngine()
        result = engine.judge_signal(iv, "NEUTRAL")
        return {
            "signal_state": result.state,
            "confidence": round(result.confidence, 1),
            "signal_grade": result.grade,
        }
    except Exception:
        return {"signal_state": "NEUTRAL", "confidence": 0, "signal_grade": ""}
