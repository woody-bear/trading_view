import pandas as pd
import pandas_ta_classic as ta


def calculate_rsi(df: pd.DataFrame, length: int = 14) -> pd.Series:
    """RSI(14) 계산."""
    result = ta.rsi(df["close"], length=length)
    if result is None:
        return pd.Series([None] * len(df), index=df.index)
    return result
