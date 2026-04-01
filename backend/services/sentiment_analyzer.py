"""시장 방향성 분석 — CNN Fear & Greed Index + 주요 지표."""

import asyncio
import json
import urllib.request
from datetime import datetime

import pandas as pd
from loguru import logger

_CNN_FG_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
_CNN_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Accept": "application/json",
    "Referer": "https://edition.cnn.com/",
}


def _fetch_index(ticker: str, period: str = "5d") -> dict | None:
    """yfinance Ticker.history로 지수 데이터 조회 (동기, thread-safe)."""
    import yfinance as yf
    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period, auto_adjust=True)
        if df is None or df.empty or len(df) < 2:
            return None
        current = float(df["Close"].iloc[-1])
        prev = float(df["Close"].iloc[-2])
        change = current - prev
        change_pct = (change / prev * 100) if prev else 0
        return {
            "value": round(current, 2),
            "prev_close": round(prev, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "direction": "up" if change > 0 else "down" if change < 0 else "flat",
        }
    except Exception as e:
        logger.debug(f"지수 조회 실패 [{ticker}]: {e}")
        return None


def _fetch_all_indices() -> dict:
    """VIX, 코스피, S&P500, 나스닥, USD/KRW 순차 조회 (yfinance thread-safety 문제 회피)."""
    tickers = [
        ("vix", "^VIX", "VIX"),
        ("kospi", "^KS11", "코스피"),
        ("sp500", "^GSPC", "S&P 500"),
        ("nasdaq", "^IXIC", "나스닥"),
        ("usdkrw", "USDKRW=X", "USD/KRW"),
    ]
    result = {}
    for key, ticker, name in tickers:
        data = _fetch_index(ticker)
        if data:
            result[key] = {"name": name, **data}
        else:
            result[key] = {"name": name, "value": 0, "change": 0, "change_pct": 0, "direction": "flat"}
    return result


async def fetch_market_indices() -> dict:
    """VIX, 코스피, S&P500, 나스닥, USD/KRW 조회 (단일 스레드로 순차 실행)."""
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_fetch_all_indices), timeout=20
        )
    except Exception as e:
        logger.debug(f"시장 지표 조회 실패: {e}")
        return {
            k: {"name": n, "value": 0, "change": 0, "change_pct": 0, "direction": "flat"}
            for k, n in [("vix","VIX"),("kospi","코스피"),("sp500","S&P 500"),("nasdaq","나스닥"),("usdkrw","USD/KRW")]
        }


def _fetch_cnn_fear_greed() -> dict | None:
    """CNN Fear & Greed Index API 조회 (동기)."""
    try:
        req = urllib.request.Request(_CNN_FG_URL, headers=_CNN_HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        fg = data.get("fear_and_greed", {})
        score = fg.get("score", 50)
        rating = fg.get("rating", "neutral")

        # 라벨 매핑
        rating_map = {
            "extreme fear": "Extreme Fear",
            "fear": "Fear",
            "neutral": "Neutral",
            "greed": "Greed",
            "extreme greed": "Extreme Greed",
        }
        label = rating_map.get(rating.lower(), "Neutral")

        # 히스토리 추출
        history_raw = data.get("fear_and_greed_historical", {}).get("data", [])
        history = []
        for point in history_raw[-30:]:
            history.append({
                "date": datetime.fromtimestamp(point["x"] / 1000).strftime("%Y-%m-%d"),
                "value": round(point["y"], 1),
            })

        return {
            "score": round(score, 1),
            "label": label,
            "history": history,
        }
    except Exception as e:
        logger.warning(f"CNN Fear & Greed API 실패: {e}")
        return None


def calculate_fear_greed(vix_value: float, sp500_pct: float = 0, kospi_pct: float = 0) -> tuple[float, str]:
    """VIX 수준으로 합성 공포/탐욕 점수(0~100) 계산.

    Returns: (score, label)
    """
    # VIX → 기본 점수 (CNN Fear & Greed에 근사하도록 보정)
    if vix_value >= 40:
        base = 3
    elif vix_value >= 30:
        base = 3 + (40 - vix_value) / 10 * 12  # 3~15
    elif vix_value >= 22:
        base = 15 + (30 - vix_value) / 8 * 20  # 15~35
    elif vix_value >= 16:
        base = 35 + (22 - vix_value) / 6 * 25  # 35~60
    elif vix_value >= 12:
        base = 60 + (16 - vix_value) / 4 * 20  # 60~80
    else:
        base = 80 + (12 - max(vix_value, 9)) / 3 * 15  # 80~95

    # S&P500 수익률 보정 (±8, CNN 대비 단일 지표 보정은 작게)
    sp_bonus = max(-8, min(8, sp500_pct * 3))

    # 코스피 수익률 보정 (±4)
    kospi_bonus = max(-4, min(4, kospi_pct * 2))

    score = max(0, min(100, base + sp_bonus + kospi_bonus))

    # 라벨
    if score <= 20:
        label = "Extreme Fear"
    elif score <= 40:
        label = "Fear"
    elif score <= 60:
        label = "Neutral"
    elif score <= 80:
        label = "Greed"
    else:
        label = "Extreme Greed"

    return round(score, 1), label


def determine_sentiment(fear_greed: float, sp500_pct: float, kospi_pct: float) -> str:
    """시장 분위기 종합 판정."""
    if fear_greed < 25 and (sp500_pct < -1 or kospi_pct < -1):
        return "위험 회피 분위기"
    elif fear_greed > 60 and (sp500_pct > 0.5 or kospi_pct > 0.5):
        return "낙관적 분위기"
    return "혼조세"


async def get_sentiment_overview() -> dict:
    """시장 방향성 종합 조회 — CNN Fear & Greed (우선) + 주요 지표 + 분위기."""
    # 지수 조회 + CNN 공포지수를 동시에 실행, 전체 12초 timeout
    try:
        indices, cnn = await asyncio.wait_for(
            asyncio.gather(
                fetch_market_indices(),
                asyncio.to_thread(_fetch_cnn_fear_greed),
            ),
            timeout=12,
        )
    except asyncio.TimeoutError:
        logger.warning("시장 지표 조회 timeout — 기본값 반환")
        indices = {
            k: {"name": n, "value": 0, "change": 0, "change_pct": 0, "direction": "flat"}
            for k, n in [("vix","VIX"),("kospi","코스피"),("sp500","S&P 500"),("nasdaq","나스닥"),("usdkrw","USD/KRW")]
        }
        cnn = None

    sp_pct = indices["sp500"].get("change_pct", 0)
    ks_pct = indices["kospi"].get("change_pct", 0)

    if cnn:
        score = cnn["score"]
        label = cnn["label"]
        source = "CNN Fear & Greed Index"
    else:
        vix_val = indices["vix"]["value"] or 20
        score, label = calculate_fear_greed(vix_val, sp_pct, ks_pct)
        source = "VIX 기반 추정"

    summary = determine_sentiment(score, sp_pct, ks_pct)

    return {
        "fear_greed": score,
        "fear_greed_label": label,
        "fear_greed_source": source,
        "sentiment_summary": summary,
        **indices,
        "updated_at": datetime.now().isoformat(),
    }


async def get_fear_greed_history(days: int = 30) -> dict:
    """CNN Fear & Greed 30일 추이 (실패 시 VIX 기반 fallback)."""
    # CNN 데이터 우선
    cnn = await asyncio.to_thread(_fetch_cnn_fear_greed)
    if cnn and cnn.get("history"):
        history = cnn["history"][-days:]
        return {
            "dates": [h["date"] for h in history],
            "values": [h["value"] for h in history],
            "source": "CNN",
            "updated_at": datetime.now().isoformat(),
        }

    # VIX fallback
    try:
        df = await asyncio.to_thread(_fetch_vix_history, days)
        if df is None:
            return {"dates": [], "values": [], "updated_at": datetime.now().isoformat()}

        dates = []
        values = []
        for idx in df.index:
            vix_val = float(df.loc[idx, "Close"])
            score, _ = calculate_fear_greed(vix_val)
            dates.append(idx.strftime("%Y-%m-%d"))
            values.append(score)

        return {
            "dates": dates,
            "values": values,
            "source": "VIX",
            "updated_at": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"공포지수 추이 조회 실패: {e}")
        return {"dates": [], "values": [], "updated_at": datetime.now().isoformat()}


def _fetch_vix_history(days: int) -> pd.DataFrame | None:
    """VIX 히스토리 조회 (동기)."""
    import yfinance as yf
    try:
        df = yf.download("^VIX", period=f"{days + 5}d", progress=False, auto_adjust=True)
        if df is None or df.empty:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.droplevel(1)
        return df.tail(days)
    except Exception as e:
        logger.debug(f"VIX 히스토리 조회 실패: {e}")
        return None
