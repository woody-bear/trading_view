"""재무 데이터 API — yfinance에서 연간/분기 매출·순이익 조회."""

import asyncio
import time
from typing import Optional

from fastapi import APIRouter
from loguru import logger

router = APIRouter(tags=["financials"])

# 메모리 캐시 (1시간 TTL)
_cache: dict[str, dict] = {}
_CACHE_TTL = 3600


def _fetch_financials(symbol: str, market: str) -> dict:
    """yfinance에서 연간/분기 재무 데이터 조회."""
    import yfinance as yf
    import pandas as pd

    if market in ("KR", "KOSPI", "KOSDAQ"):
        ticker = f"{symbol}.KS"
        if market == "KOSDAQ":
            ticker = f"{symbol}.KQ"
        currency = "KRW"
        unit = 1e8  # 억원 단위
        unit_label = "억원"
    elif market == "CRYPTO":
        # 암호화폐는 재무 데이터 없음
        return {"annual": [], "quarterly": [], "currency": "USD", "unit_label": "B"}
    else:
        ticker = symbol
        currency = "USD"
        unit = 1e9  # B (billion) 단위
        unit_label = "B"

    try:
        t = yf.Ticker(ticker)

        result = {"annual": [], "quarterly": [], "currency": currency, "unit_label": unit_label}

        # 연간 재무
        fin = t.financials
        if fin is not None and not fin.empty:
            for date in fin.columns:
                rev = fin.loc["Total Revenue", date] if "Total Revenue" in fin.index else None
                ni = fin.loc["Net Income", date] if "Net Income" in fin.index else None

                if rev is None and ni is None:
                    continue
                if pd.isna(rev) and pd.isna(ni):
                    continue

                year = date.strftime("%Y")
                result["annual"].append({
                    "year": year,
                    "revenue": round(float(rev) / unit, 1) if rev and not pd.isna(rev) else None,
                    "net_income": round(float(ni) / unit, 1) if ni and not pd.isna(ni) else None,
                    "revenue_raw": float(rev) if rev and not pd.isna(rev) else None,
                    "net_income_raw": float(ni) if ni and not pd.isna(ni) else None,
                })

            # 연도 오름차순 정렬
            result["annual"].sort(key=lambda x: x["year"])

            # 전년 대비 증감률 계산
            for i in range(1, len(result["annual"])):
                prev_rev = result["annual"][i - 1].get("revenue_raw")
                curr_rev = result["annual"][i].get("revenue_raw")
                if prev_rev and curr_rev and prev_rev != 0:
                    result["annual"][i]["revenue_change"] = round((curr_rev - prev_rev) / abs(prev_rev) * 100, 1)

                prev_ni = result["annual"][i - 1].get("net_income_raw")
                curr_ni = result["annual"][i].get("net_income_raw")
                if prev_ni and curr_ni and prev_ni != 0:
                    result["annual"][i]["net_income_change"] = round((curr_ni - prev_ni) / abs(prev_ni) * 100, 1)

        # 분기 재무
        qfin = t.quarterly_financials
        if qfin is not None and not qfin.empty:
            for date in qfin.columns:
                rev = qfin.loc["Total Revenue", date] if "Total Revenue" in qfin.index else None
                ni = qfin.loc["Net Income", date] if "Net Income" in qfin.index else None

                if rev is None and ni is None:
                    continue
                if pd.isna(rev) and pd.isna(ni):
                    continue

                q = (date.month - 1) // 3 + 1
                label = f"{date.strftime('%Y')}-Q{q}"
                result["quarterly"].append({
                    "quarter": label,
                    "revenue": round(float(rev) / unit, 1) if rev and not pd.isna(rev) else None,
                    "net_income": round(float(ni) / unit, 1) if ni and not pd.isna(ni) else None,
                })

            # 분기 오름차순 정렬, 최근 8개만
            result["quarterly"].sort(key=lambda x: x["quarter"])
            result["quarterly"] = result["quarterly"][-8:]

        return result
    except Exception as e:
        logger.debug(f"재무 데이터 조회 실패 [{market}/{symbol}]: {e}")
        return {"annual": [], "quarterly": [], "currency": currency, "unit_label": unit_label}


@router.get("/financials/{symbol}")
async def get_financials(symbol: str, market: str = "KR"):
    """종목 재무 데이터 (연간/분기 매출·순이익)."""
    cache_key = f"{market}:{symbol}"

    # 캐시 확인
    if cache_key in _cache:
        entry = _cache[cache_key]
        if time.time() - entry["_ts"] < _CACHE_TTL:
            return entry["data"]

    data = await asyncio.to_thread(_fetch_financials, symbol, market)

    # 캐시 저장
    _cache[cache_key] = {"data": data, "_ts": time.time()}

    return data
