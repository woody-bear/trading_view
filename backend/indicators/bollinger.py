import pandas as pd
import pandas_ta_classic as ta


def calculate_bb(df: pd.DataFrame, length: int = 20, std: float = 2.0) -> dict:
    """볼린저밴드 계산. 상단/중간/하단 밴드 + %B + BBW 반환."""
    bb = ta.bbands(df["close"], length=length, std=std)
    if bb is None or bb.empty:
        return {"upper": None, "middle": None, "lower": None, "pct_b": None, "width": None}

    cols = bb.columns
    upper_col = [c for c in cols if "BBU" in c][0]
    middle_col = [c for c in cols if "BBM" in c][0]
    lower_col = [c for c in cols if "BBL" in c][0]
    pct_b_col = [c for c in cols if "BBP" in c][0]
    width_col = [c for c in cols if "BBB" in c][0]

    return {
        "upper": bb[upper_col],
        "middle": bb[middle_col],
        "lower": bb[lower_col],
        "pct_b": bb[pct_b_col],
        "width": bb[width_col] / 100.0,  # BBB는 % 단위, 0~1로 정규화
    }


def detect_squeeze(df: pd.DataFrame) -> pd.Series:
    """BB 스퀴즈 4단계 판별. squeeze_pro() 기반.

    반환: 0=NO, 1=LOW, 2=MID, 3=HIGH
    """
    sqz = ta.squeeze_pro(df["high"], df["low"], df["close"])
    if sqz is None or sqz.empty:
        return pd.Series([0] * len(df), index=df.index)

    cols = sqz.columns
    off_col = [c for c in cols if "SQZPRO_OFF" in c]
    wide_col = [c for c in cols if "SQZPRO_ON_WIDE" in c]
    normal_col = [c for c in cols if "SQZPRO_ON_NORMAL" in c]
    narrow_col = [c for c in cols if "SQZPRO_ON_NARROW" in c]

    result = pd.Series(0, index=df.index)

    if narrow_col:
        result = result.where(~sqz[narrow_col[0]].astype(bool), 3)
    if normal_col:
        result = result.where(~((sqz[normal_col[0]].astype(bool)) & (result == 0)), 2)
    if wide_col:
        result = result.where(~((sqz[wide_col[0]].astype(bool)) & (result == 0)), 1)

    return result
