from datetime import datetime, timedelta, timezone
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from fetchers import get_fetcher
from models import OHLCVCache, SignalHistory, Watchlist

router = APIRouter(tags=["charts"])


@router.get("/chart/by-symbol/{symbol}")
async def get_chart_by_symbol(
    symbol: str,
    timeframe: Optional[str] = None,
    limit: int = 300,
    session: AsyncSession = Depends(get_session),
):
    """심볼로 차트 데이터 조회."""
    lookup = symbol.replace("_", "/")
    result = await session.execute(
        select(Watchlist).where(Watchlist.symbol == lookup).limit(1)
    )
    w = result.scalar_one_or_none()
    if not w:
        raise HTTPException(404, "종목 없음")
    return await get_chart_data(w.id, timeframe, limit, session)


@router.get("/signals/{watchlist_id}/chart")
async def get_chart_data(
    watchlist_id: int,
    timeframe: Optional[str] = None,
    limit: int = 300,
    session: AsyncSession = Depends(get_session),
):
    w = await session.get(Watchlist, watchlist_id)
    if not w:
        raise HTTPException(404, "종목 없음")

    tf = timeframe or w.timeframe
    limit = min(limit, 500)

    # DB 캐시에서 조회
    result = await session.execute(
        select(OHLCVCache)
        .where(OHLCVCache.watchlist_id == watchlist_id, OHLCVCache.timeframe == tf)
        .order_by(OHLCVCache.timestamp.asc())
        .limit(limit)
    )
    rows = result.scalars().all()

    # 캐시가 없거나 3일 이상 오래된 경우 실시간 fetch
    stale = False
    if rows:
        last_ts = max(r.timestamp for r in rows)
        last_dt = datetime.fromtimestamp(last_ts, tz=timezone.utc)
        if datetime.now(timezone.utc) - last_dt > timedelta(days=3):
            stale = True
            logger.info(f"[{w.symbol}] OHLCV 캐시 오래됨 ({last_dt.date()}), 실시간 fetch")

    if not rows or stale:
        # fetcher로 실시간 데이터 가져오기
        try:
            fetcher = get_fetcher(w.market)
            fresh_df = await fetcher.fetch_ohlcv(w.symbol, tf)
            if fresh_df is not None and not fresh_df.empty:
                # 비정상 캔들 제거
                fresh_df = fresh_df[(fresh_df["open"] > 0) & (fresh_df["high"] > 0) & (fresh_df["low"] > 0)]
                candles = []
                timestamps = []
                for idx, r in fresh_df.iterrows():
                    ts = int(idx.timestamp())
                    candles.append({"time": ts, "open": float(r["open"]), "high": float(r["high"]),
                                    "low": float(r["low"]), "close": float(r["close"]), "volume": float(r["volume"])})
                    timestamps.append(ts)

                df = fresh_df[["open", "high", "low", "close", "volume"]].copy()
                indicators, squeeze_dots, current = _calc_all(df, timestamps)
                db_markers = await _get_markers(session, watchlist_id)
                sim_markers = _simulate_signals(df, timestamps, indicators, tf)
                markers = sim_markers if sim_markers else db_markers

                # 캔들 범위로 마커 필터링
                visible_candles = candles[-limit:]
                if visible_candles:
                    min_ts = visible_candles[0]["time"]
                    max_ts = visible_candles[-1]["time"]
                    markers = [m for m in markers if min_ts <= m["time"] <= max_ts]

                return {
                    "symbol": w.symbol, "display_name": w.display_name, "timeframe": tf,
                    "candles": visible_candles, "indicators": indicators,
                    "squeeze_dots": squeeze_dots, "markers": markers, "current": current,
                }
        except Exception as e:
            logger.warning(f"[{w.symbol}] 실시간 fetch 실패: {e}")

    if not rows:
        return {"symbol": w.symbol, "display_name": w.display_name, "timeframe": tf,
                "candles": [], "indicators": {}, "markers": [], "squeeze_dots": [],
                "current": None}

    candles = [{"time": r.timestamp, "open": r.open, "high": r.high,
                "low": r.low, "close": r.close, "volume": r.volume} for r in rows]

    df = pd.DataFrame(
        [{"open": r.open, "high": r.high, "low": r.low, "close": r.close, "volume": r.volume} for r in rows],
        index=pd.to_datetime([r.timestamp for r in rows], unit="s", utc=True),
    )
    timestamps = [r.timestamp for r in rows]

    indicators, squeeze_dots, current = _calc_all(df, timestamps)
    # DB 이력 마커 + 캔들별 신호 시뮬레이션 마커
    db_markers = await _get_markers(session, watchlist_id)
    sim_markers = _simulate_signals(df, timestamps, indicators, tf)
    # 시뮬레이션 마커 우선 (DB 이력은 실시간 스캔에서만 기록되므로)
    markers = sim_markers if sim_markers else db_markers

    # 캔들 범위로 마커 필터링
    if candles:
        min_ts = candles[0]["time"]
        max_ts = candles[-1]["time"]
        markers = [m for m in markers if min_ts <= m["time"] <= max_ts]

    return {
        "symbol": w.symbol,
        "display_name": w.display_name,
        "timeframe": tf,
        "candles": candles,
        "indicators": indicators,
        "squeeze_dots": squeeze_dots,
        "markers": markers,
        "current": current,
    }


def _calc_all(df: pd.DataFrame, timestamps: list[int]) -> tuple[dict, list, dict]:
    from indicators.bollinger import calculate_bb, detect_squeeze
    from indicators.ema import calculate_ema
    from indicators.macd import calculate_macd
    from indicators.rsi import calculate_rsi
    from indicators.volume import calculate_volume_ratio

    indicators: dict = {}

    def to_points(series, key):
        if series is None:
            return
        pts = []
        for i, ts in enumerate(timestamps):
            if i < len(series):
                v = series.iloc[i]
                if v is not None and not pd.isna(v):
                    pts.append({"time": ts, "value": float(v)})
        indicators[key] = pts

    # BB
    bb_data = None
    if len(df) >= 20:
        bb_data = calculate_bb(df)
        to_points(bb_data.get("upper"), "bb_upper")
        to_points(bb_data.get("middle"), "bb_middle")
        to_points(bb_data.get("lower"), "bb_lower")
        to_points(bb_data.get("pct_b"), "bb_pct_b")
        to_points(bb_data.get("width"), "bb_width")

    # RSI
    rsi_series = None
    if len(df) >= 14:
        rsi_series = calculate_rsi(df)
        to_points(rsi_series, "rsi")

    # MACD
    macd_data = None
    if len(df) >= 26:
        macd_data = calculate_macd(df)
        to_points(macd_data.get("macd_line"), "macd_line")
        to_points(macd_data.get("signal_line"), "macd_signal")
        to_points(macd_data.get("histogram"), "macd_hist")

    # EMA
    ema_data = calculate_ema(df)
    to_points(ema_data.get("ema_20"), "ema_20")
    to_points(ema_data.get("ema_50"), "ema_50")
    to_points(ema_data.get("ema_200"), "ema_200")

    # Volume
    vol_ratio = calculate_volume_ratio(df)
    to_points(vol_ratio, "volume_ratio")

    # Squeeze dots — BB 하단 아래에 실제 가격 좌표로 배치
    squeeze_dots = []
    squeeze_series = detect_squeeze(df)
    sq_colors = ["#22c55e", "#eab308", "#f97316", "#ef4444"]
    bb_lower_series = bb_data.get("lower") if bb_data else None
    for i, ts in enumerate(timestamps):
        if i < len(squeeze_series):
            lvl = int(squeeze_series.iloc[i]) if not pd.isna(squeeze_series.iloc[i]) else 0
            # BB 하단의 약간 아래에 배치 (가격 범위의 1.5% 아래)
            if bb_lower_series is not None and i < len(bb_lower_series) and not pd.isna(bb_lower_series.iloc[i]):
                low_val = float(bb_lower_series.iloc[i])
                offset = low_val * 0.015
                dot_price = low_val - offset
            else:
                dot_price = float(df["low"].iloc[i]) * 0.985
            squeeze_dots.append({"time": ts, "value": round(dot_price, 2), "color": sq_colors[lvl], "level": lvl})

    # Current 패널 값 (마지막 캔들 기준)
    current = {}
    if len(df) >= 20 and bb_data and bb_data.get("pct_b") is not None:
        last_pctb = bb_data["pct_b"].iloc[-1]
        current["pct_b"] = round(float(last_pctb) * 100, 1) if not pd.isna(last_pctb) else None
    if len(df) >= 20 and bb_data and bb_data.get("width") is not None:
        last_bbw = bb_data["width"].iloc[-1]
        current["bandwidth"] = round(float(last_bbw) * 100, 2) if not pd.isna(last_bbw) else None
    if rsi_series is not None and len(rsi_series) > 0:
        last_rsi = rsi_series.iloc[-1]
        current["rsi"] = round(float(last_rsi), 1) if not pd.isna(last_rsi) else None
    if len(squeeze_series) > 0:
        sq_lvl = int(squeeze_series.iloc[-1]) if not pd.isna(squeeze_series.iloc[-1]) else 0
        sq_labels = ["NO SQ", "LOW SQ", "MID SQ", "MAX SQ"]
        current["squeeze"] = sq_labels[sq_lvl]
        current["squeeze_level"] = sq_lvl
    # Trend
    if ema_data.get("ema_20") is not None and ema_data.get("ema_50") is not None:
        e20 = ema_data["ema_20"].iloc[-1] if not pd.isna(ema_data["ema_20"].iloc[-1]) else 0
        e50 = ema_data["ema_50"].iloc[-1] if not pd.isna(ema_data["ema_50"].iloc[-1]) else 0
        current["trend"] = "BULL" if e20 > e50 else "BEAR"

    return indicators, squeeze_dots, current


def _simulate_signals(df: pd.DataFrame, timestamps: list[int], indicators: dict, timeframe: str = "1d") -> list:
    """UBB Pro Pine Script v6 기준 BUY/SELL 시뮬레이션.

    TradingView Pine Script와 동일한 로직:
    - BB 하단 터치/돌파 + RSI 필터 + 모멘텀 상승 → BUY
    - BB 상단 터치/돌파 + RSI 필터 + 모멘텀 하락 → SELL
    - 스퀴즈 해제 + 모멘텀 방향 → SQZ BUY/SELL
    - 쿨다운: 일봉 5봉, 주봉 5봉 (=5주)
    """
    from indicators.bollinger import calculate_bb, detect_squeeze
    from indicators.macd import calculate_macd
    from indicators.rsi import calculate_rsi

    if len(df) < 35:
        return []

    rsi = calculate_rsi(df)
    bb = calculate_bb(df)
    macd = calculate_macd(df)
    squeeze = detect_squeeze(df)

    bb_lower = bb.get("lower")
    bb_upper = bb.get("upper")
    hist = macd.get("histogram")

    if bb_lower is None or bb_upper is None or hist is None:
        return []

    # MACD 모멘텀 (EMA12 - EMA26) — Pine Script 기준
    ema12 = df["close"].ewm(span=12, adjust=False).mean()
    ema26 = df["close"].ewm(span=26, adjust=False).mean()
    mom = ema12 - ema26

    markers = []
    last_signal_bar = -999
    last_signal_type = ""
    COOLDOWN = 5

    for i in range(1, len(df)):
        ts = timestamps[i] if i < len(timestamps) else 0

        close_now = float(df["close"].iloc[i])
        close_prev = float(df["close"].iloc[i - 1])
        low_now = float(df["low"].iloc[i])
        high_now = float(df["high"].iloc[i])

        bbl = float(bb_lower.iloc[i]) if not pd.isna(bb_lower.iloc[i]) else close_now
        bbl_prev = float(bb_lower.iloc[i - 1]) if not pd.isna(bb_lower.iloc[i - 1]) else close_prev
        bbu = float(bb_upper.iloc[i]) if not pd.isna(bb_upper.iloc[i]) else close_now
        bbu_prev = float(bb_upper.iloc[i - 1]) if not pd.isna(bb_upper.iloc[i - 1]) else close_prev

        r = float(rsi.iloc[i]) if not pd.isna(rsi.iloc[i]) else 50
        m = float(mom.iloc[i]) if not pd.isna(mom.iloc[i]) else 0
        m_prev = float(mom.iloc[i - 1]) if not pd.isna(mom.iloc[i - 1]) else 0

        mom_bull = m > 0
        mom_bear = m <= 0
        mom_rising = m > m_prev
        mom_falling = m < m_prev

        # RSI 필터 — Pine Script 원본 기준
        rsi_buy_filter = r < 40
        rsi_sell_filter = r > 60

        # BB 터치/복귀 조건 — Pine Script crossunder/crossover 정확히 구현
        # crossunder(close, lowerBB) = close가 위→아래로 관통
        bb_cross_under = close_now < bbl and close_prev >= bbl_prev
        bb_buy_touch = low_now <= bbl or bb_cross_under
        # close가 아래→위로 복귀
        bb_buy_reverse = close_now > bbl and close_prev <= bbl_prev

        # crossover(close, upperBB) = close가 아래→위로 관통
        bb_cross_over = close_now > bbu and close_prev <= bbu_prev
        bb_sell_touch = high_now >= bbu or bb_cross_over
        # close가 위→아래로 복귀
        bb_sell_reverse = close_now < bbu and close_prev >= bbu_prev

        # 신호 판정 — Pine Script 원본과 동일
        buy_signal = (bb_buy_touch and rsi_buy_filter and mom_rising) or \
                     (bb_buy_reverse and rsi_buy_filter)
        sell_signal = (bb_sell_touch and rsi_sell_filter and mom_falling) or \
                      (bb_sell_reverse and rsi_sell_filter)

        # 스퀴즈 해제 신호
        sqz_now = int(squeeze.iloc[i]) if not pd.isna(squeeze.iloc[i]) else 0
        sqz_prev = int(squeeze.iloc[i - 1]) if not pd.isna(squeeze.iloc[i - 1]) else 0
        sqz_fired = sqz_now == 0 and sqz_prev > 0

        sqz_buy = sqz_fired and mom_bull and mom_rising
        sqz_sell = sqz_fired and mom_bear and mom_falling

        # 공통 쿨다운 + 같은 방향 중복 방지
        bar = i
        in_cooldown = (bar - last_signal_bar) <= COOLDOWN

        if not in_cooldown and (buy_signal or sqz_buy) and last_signal_type != "BUY":
            last_signal_bar = bar
            last_signal_type = "BUY"
            text = "SQZ BUY" if sqz_buy else "BUY"
            markers.append({
                "time": ts, "position": "belowBar", "color": "#22c55e",
                "shape": "arrowUp", "text": text,
            })

        elif not in_cooldown and (sell_signal or sqz_sell) and last_signal_type != "SELL":
            last_signal_bar = bar
            last_signal_type = "SELL"
            text = "SQZ SELL" if sqz_sell else "SELL"
            markers.append({
                "time": ts, "position": "aboveBar", "color": "#ef4444",
                "shape": "arrowDown", "text": text,
            })

    return markers


async def _get_markers(session: AsyncSession, watchlist_id: int) -> list:
    result = await session.execute(
        select(SignalHistory)
        .where(SignalHistory.watchlist_id == watchlist_id, SignalHistory.signal_state.in_(["BUY", "SELL"]))
        .order_by(SignalHistory.detected_at.asc())
    )
    markers = []
    for h in result.scalars().all():
        ts = int(h.detected_at.timestamp()) if h.detected_at else 0
        markers.append({
            "time": ts,
            "position": "belowBar" if h.signal_state == "BUY" else "aboveBar",
            "color": "#22c55e" if h.signal_state == "BUY" else "#ef4444",
            "shape": "arrowUp" if h.signal_state == "BUY" else "arrowDown",
            "text": f"{h.signal_state} {h.confidence:.0f}" if h.confidence else h.signal_state,
        })
    return markers
