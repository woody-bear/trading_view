"""스캔 조건 단일 소스 모듈.

조회조건 페이지(/conditions)에 공개되는 조건 판정 로직의 단일 소스.
full_market_scanner는 이 모듈의 상수와 함수를 import하여 사용한다.

조건 값·함수 본문은 기존 full_market_scanner.py에서 그대로 이전된 것이며,
동작은 100% 보존된다(리팩토링 전후 스캔 결과 bit-identical).
"""

from datetime import datetime

import pandas as pd

# ── 조건 임계값 상수 ──────────────────────────────────────────────
RSI_BUY_THRESHOLD_PRESETS: dict[str, int] = {
    "strict": 30,
    "normal": 35,
    "sensitive": 40,
}
RSI_SELL_THRESHOLD: int = 60
COOLDOWN_BARS: int = 5
SIGNAL_LOOKBACK_DAYS: int = 20
DATA_STALENESS_DAYS: int = 7
MIN_CANDLES: int = 60


# ── EMA 기반 추세 판정 ────────────────────────────────────────────
def check_trend(df: pd.DataFrame, ema: dict) -> str:
    """EMA20/50/200 기반 추세 분류 — BULL/BEAR/NEUTRAL."""
    e20 = ema.get("ema_20")
    e50 = ema.get("ema_50")
    e200 = ema.get("ema_200")
    if e20 is None or e50 is None or e200 is None:
        return "NEUTRAL"
    if len(e20.dropna()) < 10:
        return "NEUTRAL"
    price = float(df["close"].iloc[-1])
    last_e20, last_e50, last_e200 = float(e20.iloc[-1]), float(e50.iloc[-1]), float(e200.iloc[-1])
    e20_recent = e20.dropna().tail(5)
    e20_slope = (float(e20_recent.iloc[-1]) - float(e20_recent.iloc[0])) if len(e20_recent) >= 5 else 0
    if last_e20 > last_e50 > last_e200 and price > last_e20 and e20_slope > 0:
        return "BULL"
    if last_e20 < last_e50 < last_e200 and price < last_e20:
        return "BEAR"
    return "NEUTRAL"


def is_dead_cross(ema: dict) -> bool:
    """데드크로스: EMA5 < EMA10 < EMA20 < EMA60 < EMA120 (5선 전체 역배열)."""
    keys = ["ema_5", "ema_10", "ema_20", "ema_60", "ema_120"]
    vals: list[float] = []
    for k in keys:
        s = ema.get(k)
        if s is None or len(s.dropna()) == 0:
            return False
        try:
            vals.append(float(s.dropna().iloc[-1]))
        except Exception:
            return False
    # EMA5 < EMA10 < EMA20 < EMA60 < EMA120
    return all(vals[i] < vals[i + 1] for i in range(len(vals) - 1))


def is_large_cap(symbol: str, market: str, is_etf: bool = False) -> bool:
    """대형주 판정: KR → KOSPI200/KOSDAQ150, US → S&P500 포함 여부.

    ETF는 필터 미적용(통과). CRYPTO 등 기타 시장도 통과.
    """
    if is_etf:
        return True
    if market == "KR":
        from services.scan_symbols_list import KOSDAQ150_SYMBOLS, KOSPI200_SYMBOLS
        return symbol in KOSPI200_SYMBOLS or symbol in KOSDAQ150_SYMBOLS
    if market == "US":
        from services.scan_symbols_list import SP500_TICKERS
        return symbol in SP500_TICKERS
    return True  # CRYPTO 등


def is_pullback(ema: dict) -> bool:
    """눌림목: EMA20 > EMA60 > EMA120 (장기 상승추세) + EMA5 하락 (단기 눌림)."""
    for k in ["ema_5", "ema_20", "ema_60", "ema_120"]:
        s = ema.get(k)
        if s is None or len(s.dropna()) < 2:
            return False

    try:
        e5 = ema["ema_5"].dropna()
        e20 = ema["ema_20"].dropna()
        e60 = ema["ema_60"].dropna()
        e120 = ema["ema_120"].dropna()

        # 장기 상승추세: EMA20 > EMA60 > EMA120
        long_up = float(e20.iloc[-1]) > float(e60.iloc[-1]) > float(e120.iloc[-1])
        # 단기 눌림: EMA5 현재값 < 직전값
        ema5_declining = float(e5.iloc[-1]) < float(e5.iloc[-2])

        return long_up and ema5_declining
    except Exception:
        return False


def check_buy_signal_precise(df: pd.DataFrame, last_rsi: float, last_sq: int) -> tuple[str | None, str | None]:
    """Pine Script 정밀 BUY 신호 판정 — _simulate_signals 사용.

    사전 필터를 통과한 종목에만 적용 (RSI < 50 또는 스퀴즈 해소 가능성).
    Returns: (signal_text, signal_date) or (None, None)
    """
    # 사전 필터: 10거래일 이내 BUY 신호 가능성이 전혀 없는 종목만 스킵
    # (신호 후 강하게 랠리하면 현재 RSI가 높을 수 있으므로 임계값 완화)
    if last_rsi >= 80 and last_sq == 0:
        return None, None

    # 데이터 신선도 확인 — 마지막 봉이 DATA_STALENESS_DAYS 이상 오래됐으면 stale → 스킵
    from datetime import datetime as _dt, timezone as _tz
    today_utc = _dt.now(_tz.utc).date()
    last_bar_date = df.index[-1].date() if hasattr(df.index[-1], "date") else None
    if last_bar_date and (today_utc - last_bar_date).days > DATA_STALENESS_DAYS:
        return None, None

    try:
        from routes.charts import _calc_all, _simulate_signals

        timestamps = [int(idx.timestamp()) for idx in df.index]
        indicators_data, _, _ = _calc_all(df, timestamps)
        markers = _simulate_signals(df, timestamps, indicators_data, "1d")

        if not markers:
            return None, None

        last_marker = markers[-1]
        if last_marker["text"] in ("BUY", "SQZ BUY"):
            signal_dt = datetime.utcfromtimestamp(last_marker["time"])
            # SIGNAL_LOOKBACK_DAYS 이내 (df는 실제 거래일만 포함 → 주말·공휴일 자동 제외)
            signal_date = signal_dt.date()
            matching = [i for i, idx in enumerate(df.index) if idx.date() == signal_date]
            if matching:
                trading_days_since = len(df) - 1 - matching[0]
                if trading_days_since <= SIGNAL_LOOKBACK_DAYS:
                    return last_marker["text"], signal_dt.strftime("%Y-%m-%d")

        return None, None
    except Exception:
        return None, None
