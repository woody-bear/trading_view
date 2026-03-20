import pandas as pd
import pandas_ta_classic as ta


def calculate_ema(df: pd.DataFrame) -> dict:
    """EMA 20/50/200 계산."""
    return {
        "ema_20": ta.ema(df["close"], length=20),
        "ema_50": ta.ema(df["close"], length=50),
        "ema_200": ta.ema(df["close"], length=200),
    }
