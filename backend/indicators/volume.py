import pandas as pd


def calculate_volume_ratio(df: pd.DataFrame, length: int = 20) -> pd.Series:
    """거래량 비율 계산 (현재 거래량 / 20일 평균)."""
    avg = df["volume"].rolling(window=length).mean()
    ratio = df["volume"] / avg
    return ratio
