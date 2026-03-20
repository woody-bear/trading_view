import pandas as pd
import pandas_ta_classic as ta


def calculate_macd(
    df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9
) -> dict:
    """MACD(12/26/9) 계산. MACD선, 시그널선, 히스토그램 반환."""
    macd = ta.macd(df["close"], fast=fast, slow=slow, signal=signal)
    if macd is None or macd.empty:
        return {"macd_line": None, "signal_line": None, "histogram": None}

    cols = macd.columns
    macd_col = [c for c in cols if "MACD_" in c and "MACDs" not in c and "MACDh" not in c][0]
    signal_col = [c for c in cols if "MACDs" in c][0]
    hist_col = [c for c in cols if "MACDh" in c][0]

    return {
        "macd_line": macd[macd_col],
        "signal_line": macd[signal_col],
        "histogram": macd[hist_col],
    }
