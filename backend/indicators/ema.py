import pandas as pd
import pandas_ta_classic as ta


def calculate_ema(df: pd.DataFrame) -> dict:
    """EMA 5/20/50/60/120/200 계산.

    - 20/50/200: 메인 차트 표시 + 내부 판정 (dead cross·BULL/BEAR)
    - 5/60/120: 하단 EMA 보조 차트 전용
    """
    close = df["close"]
    return {
        "ema_5": ta.ema(close, length=5),
        "ema_10": ta.ema(close, length=10),
        "ema_20": ta.ema(close, length=20),
        "ema_50": ta.ema(close, length=50),
        "ema_60": ta.ema(close, length=60),
        "ema_120": ta.ema(close, length=120),
        "ema_200": ta.ema(close, length=200),
    }
