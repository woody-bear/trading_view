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


def _market_today_ts(market: str) -> int | None:
    """시장 시간대 기준 '오늘 자정'의 Unix timestamp (초)."""
    from datetime import datetime, time as _time
    from utils.market_hours import _get_config
    try:
        cfg = _get_config(market)
        now = datetime.now(cfg["tz"])
        midnight = datetime.combine(now.date(), _time.min, tzinfo=cfg["tz"])
        return int(midnight.timestamp())
    except Exception:
        return None


async def _append_today_candle_if_missing(df: pd.DataFrame, symbol: str, market: str) -> pd.DataFrame:
    """df의 마지막 캔들이 오늘이 아니고 장중이면 yfinance info에서 오늘 일봉 보충.

    yfinance.history()는 종종 rate-limit/None 응답으로 불안정 → `.info`의
    regularMarketOpen/DayHigh/DayLow/Price/Volume 필드로 직접 조합 (더 안정적).
    """
    from utils.market_hours import is_market_open, _get_config
    from datetime import datetime as _dt
    if df is None or df.empty:
        return df
    if not is_market_open(market):
        return df
    try:
        cfg = _get_config(market)
        today = _dt.now(cfg["tz"]).date()
        last_idx = df.index[-1]
        last_date = last_idx.date() if hasattr(last_idx, "date") else None
        if last_date == today:
            return df  # 이미 오늘 캔들 있음

        # yfinance ticker 문자열 결정
        ticker_str = symbol
        if market in ("KR", "KOSPI"):
            ticker_str = f"{symbol}.KS"
        elif market == "KOSDAQ":
            ticker_str = f"{symbol}.KQ"

        import yfinance as yf
        info = await asyncio.to_thread(lambda: yf.Ticker(ticker_str).info or {})
        o = info.get("regularMarketOpen")
        h = info.get("regularMarketDayHigh")
        l = info.get("regularMarketDayLow")
        c = info.get("regularMarketPrice") or info.get("preMarketPrice") or info.get("postMarketPrice")
        if c is None or o is None:
            return df  # 충분한 데이터 없음

        # OHLC 누락 시 가격으로 보강
        if h is None: h = max(o or c, c)
        if l is None: l = min(o or c, c)
        v = info.get("regularMarketVolume") or 0

        # 시장 시간대의 오늘 자정을 인덱스 tz에 맞춰 변환
        try:
            idx_tz = df.index.tz if hasattr(df.index, "tz") else None
        except Exception:
            idx_tz = None
        today_midnight = _dt.combine(today, _dt.min.time(), tzinfo=cfg["tz"])
        if idx_tz is not None:
            today_midnight = today_midnight.astimezone(idx_tz)
        else:
            today_midnight = today_midnight.replace(tzinfo=None)

        new_row = pd.DataFrame(
            {"open": [float(o)], "high": [float(h)], "low": [float(l)],
             "close": [float(c)], "volume": [float(v)]},
            index=[pd.Timestamp(today_midnight)],
        )
        df = pd.concat([df, new_row])
        logger.debug(f"오늘 캔들 보충 [{market}/{symbol}]: {today} O={o} H={h} L={l} C={c}")
    except Exception as e:
        logger.debug(f"오늘 캔들 보충 실패 [{market}/{symbol}]: {e}")
    return df


@router.get("/chart/quick")
async def quick_chart(symbol: str, market: str, timeframe: str = "1d", limit: int = 200):
    """차트 데이터 — SQLite 캐시 우선, yfinance fallback."""
    from services.chart_cache import get_chart_data, resolve_name
    from utils.market_hours import is_market_open

    empty = {"candles": [], "indicators": {}, "squeeze_dots": [], "markers": [], "current": None,
             "symbol": symbol, "display_name": symbol, "timeframe": timeframe, "market_open": False}

    try:
        df = await get_chart_data(symbol, market, timeframe, limit)
    except Exception as e:
        logger.error(f"차트 데이터 조회 실패 [{market}/{symbol}]: {e}")
        return empty

    if df is None or df.empty:
        return empty

    # 장중인데 오늘 캔들 빠져있으면 yfinance에서 보충 (개장 직후 공백 방어)
    if timeframe == "1d":
        df = await _append_today_candle_if_missing(df, symbol, market)

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
        "market_open": is_market_open(market),
        # 시장 시간대 기준 오늘 00:00 UTC timestamp — 프론트의 todayTs 정렬용
        "today_ts": _market_today_ts(market),
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
    # 하단 EMA 보조 차트용 (5/60/120)
    add(e.get("ema_5"), "ema_5"); add(e.get("ema_60"), "ema_60"); add(e.get("ema_120"), "ema_120")
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


@router.get("/chart/indicators-at")
async def indicators_at(symbol: str, market: str, date: str):
    """특정 날짜의 지표값 조회 — BUY 사례 저장 시 호출."""
    from fastapi import HTTPException
    from services.chart_cache import get_chart_data

    try:
        df = await get_chart_data(symbol, market, "1d", 300)
    except Exception:
        raise HTTPException(status_code=404, detail="차트 데이터를 불러올 수 없습니다")

    if df is None or df.empty:
        raise HTTPException(status_code=404, detail="차트 데이터 없음")

    # date 행 찾기 (df.index는 UTC datetime)
    target_idx = None
    for i, idx in enumerate(df.index):
        row_date = idx.strftime("%Y-%m-%d")
        if row_date == date:
            target_idx = i
            break

    if target_idx is None:
        raise HTTPException(status_code=404, detail=f"해당 날짜 데이터를 찾을 수 없습니다: {date}")

    # 지표 계산 (전체 df 기준, target_idx 위치의 값 추출)
    def safe(series, idx):
        if series is None or idx >= len(series):
            return None
        v = series.iloc[idx]
        return None if pd.isna(v) else float(v)

    bb = calculate_bb(df) if len(df) >= 20 else {}
    rsi_s = calculate_rsi(df) if len(df) >= 14 else None
    macd = calculate_macd(df) if len(df) >= 26 else {}
    vol = calculate_volume_ratio(df)
    sq = detect_squeeze(df)
    ema = calculate_ema(df)

    e20 = safe(ema.get("ema_20"), target_idx) or 0
    e50 = safe(ema.get("ema_50"), target_idx) or 0
    e200 = safe(ema.get("ema_200"), target_idx) or 0

    sq_val = sq.iloc[target_idx] if target_idx < len(sq) else 0
    sq_level = int(sq_val) if not pd.isna(sq_val) else 0

    # 충족 조건 수 계산 (normal 기준: rsi<35, bb_pct_b<0.15, macd_hist>0, vol>=1.1)
    rsi_v = safe(rsi_s, target_idx)
    bb_pct_v = safe(bb.get("pct_b"), target_idx)
    macd_hist_v = safe(macd.get("histogram"), target_idx)
    vol_v = safe(vol, target_idx)
    conditions = sum([
        rsi_v is not None and rsi_v < 35,
        bb_pct_v is not None and bb_pct_v < 0.15,
        macd_hist_v is not None and macd_hist_v > 0,
        vol_v is not None and vol_v >= 1.1,
    ])

    close_v = float(df["close"].iloc[target_idx])

    return {
        "symbol": symbol,
        "date": date,
        "rsi": round(rsi_v, 1) if rsi_v is not None else None,
        "bb_pct_b": round(bb_pct_v, 4) if bb_pct_v is not None else None,
        "bb_width": round(safe(bb.get("width"), target_idx), 4) if safe(bb.get("width"), target_idx) is not None else None,
        "macd_hist": round(macd_hist_v, 4) if macd_hist_v is not None else None,
        "volume_ratio": round(vol_v, 2) if vol_v is not None else None,
        "ema_alignment": "BULL" if e20 > e50 > e200 else "BEAR" if e20 < e50 < e200 else "NEUTRAL",
        "squeeze_level": sq_level,
        "conditions_met": conditions,
        "close": round(close_v, 2),
    }
