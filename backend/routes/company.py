"""회사 정보 & 확장 투자 지표 API — yfinance ticker.info 기반, 1시간 캐시."""

import asyncio
import time
from datetime import datetime

from fastapi import APIRouter
from loguru import logger

router = APIRouter(tags=["company"])

# 메모리 캐시 (1시간 TTL)
_cache: dict[str, dict] = {}
_CACHE_TTL = 3600


def _safe_float(val, multiply: float = 1.0, decimals: int = 2):
    """숫자 변환 — None/NaN/0 안전 처리."""
    if val is None:
        return None
    try:
        f = float(val)
        if f != f:  # NaN check
            return None
        return round(f * multiply, decimals)
    except (TypeError, ValueError):
        return None


def _safe_int(val):
    if val is None:
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def _fmt_ticker(symbol: str, market: str) -> str | None:
    """시장에 따라 yfinance 티커 포맷 결정."""
    if market in ("CRYPTO",):
        return None
    if market == "KOSDAQ":
        return f"{symbol}.KQ"
    if market in ("KR", "KOSPI"):
        return f"{symbol}.KS"
    return symbol  # US, 기타


def _translate_to_korean(text: str) -> str:
    """Google Translate 무료 API로 영문 → 한국어 번역. 실패 시 원문 반환."""
    if not text:
        return text
    try:
        import httpx
        import urllib.parse
        url = "https://translate.googleapis.com/translate_a/single"
        params = {
            "client": "gtx",
            "sl": "en",
            "tl": "ko",
            "dt": "t",
            "q": text,
        }
        resp = httpx.get(url, params=params, timeout=5.0)
        if resp.status_code == 200:
            data = resp.json()
            translated = "".join(chunk[0] for chunk in data[0] if chunk[0])
            return translated if translated else text
    except Exception:
        pass
    return text


def _fetch_company(symbol: str, market: str) -> dict:
    """yfinance에서 회사 정보 + 투자 지표 + 매출 세그먼트 조회."""
    import yfinance as yf

    ticker_sym = _fmt_ticker(symbol, market)
    if ticker_sym is None:
        return {"company": None, "metrics": None, "revenue_segments": None, "cached_at": None}

    try:
        t = yf.Ticker(ticker_sym)
        info = t.info or {}

        currency = "KRW" if market in ("KR", "KOSPI", "KOSDAQ") else "USD"

        # ── Company Info ──────────────────────────────────────────────────────
        name = info.get("shortName") or info.get("longName") or symbol
        logo_url = info.get("logo_url") or None
        description_raw = info.get("longBusinessSummary") or None
        # 모든 종목 한국어 번역 (yfinance는 영문만 제공)
        if description_raw:
            description = _translate_to_korean(description_raw)
        else:
            description = description_raw
        industry = info.get("industry") or None
        sector = info.get("sector") or None
        country = info.get("country") or None
        exchange = info.get("exchange") or None
        employees = _safe_int(info.get("fullTimeEmployees"))
        website = info.get("website") or None

        company = {
            "name": name,
            "logo_url": logo_url,
            "description": description,
            "industry": industry,
            "sector": sector,
            "country": country,
            "exchange": exchange,
            "employees": employees,
            "website": website,
        }

        # ── Investment Metrics ────────────────────────────────────────────────
        per = _safe_float(info.get("trailingPE"))
        pbr = _safe_float(info.get("priceToBook"))
        roe = _safe_float(info.get("returnOnEquity"), multiply=100)
        roa = _safe_float(info.get("returnOnAssets"), multiply=100)
        eps = _safe_float(info.get("trailingEps"))
        bps = _safe_float(info.get("bookValue"))
        operating_margin = _safe_float(info.get("operatingMargins"), multiply=100)
        debt_to_equity = _safe_float(info.get("debtToEquity"))
        market_cap = _safe_int(info.get("marketCap"))

        # 배당수익률: yfinance KR 종목은 이미 % 값(예: 1.13 = 1.13%)으로 반환
        # US 종목은 소수(예: 0.02 = 2%)로 반환 → 1.0 기준으로 구분
        div_raw = info.get("dividendYield")
        dividend_yield = None
        if div_raw is not None:
            try:
                dv = float(div_raw)
                if dv > 0:
                    # > 1.0 이면 이미 % 형식 (KR yfinance 특이사항)
                    dividend_yield = round(dv, 2) if dv > 1.0 else round(dv * 100, 2)
            except (TypeError, ValueError):
                pass

        metrics = {
            "per": per,
            "pbr": pbr,
            "roe": roe,
            "roa": roa,
            "eps": eps,
            "bps": bps,
            "dividend_yield": dividend_yield,
            "market_cap": market_cap,
            "operating_margin": operating_margin,
            "debt_to_equity": debt_to_equity,
            "currency": currency,
        }

        # ── Revenue Segments ──────────────────────────────────────────────────
        revenue_segments = None
        try:
            rev_df = t.revenue_by_product
            if rev_df is not None and not rev_df.empty:
                # 가장 최근 날짜 컬럼 선택
                latest_col = rev_df.columns[0]
                period_str = latest_col.strftime("%Y-%m") if hasattr(latest_col, "strftime") else str(latest_col)[:7]

                total = float(rev_df[latest_col].sum())
                if total > 0:
                    segments = []
                    for name_seg, row in rev_df.iterrows():
                        val = row[latest_col]
                        if val is None or (hasattr(val, "__float__") and float(val) != float(val)):
                            continue
                        fval = float(val)
                        if fval <= 0:
                            continue
                        segments.append({
                            "name": str(name_seg),
                            "revenue": round(fval, 0),
                            "percentage": round(fval / total * 100, 1),
                            "period": period_str,
                        })
                    if segments:
                        revenue_segments = sorted(segments, key=lambda x: x["percentage"], reverse=True)
        except Exception as e:
            logger.debug(f"revenue_by_product 조회 실패 [{symbol}]: {e}")

        cached_at = datetime.utcnow().isoformat()
        return {
            "company": company,
            "metrics": metrics,
            "revenue_segments": revenue_segments,
            "cached_at": cached_at,
        }

    except Exception as e:
        logger.debug(f"회사 정보 조회 실패 [{market}/{symbol}]: {e}")
        return {"company": None, "metrics": None, "revenue_segments": None, "cached_at": None}


@router.get("/company/{symbol}")
async def get_company_info(symbol: str, market: str = "KR"):
    """종목 회사 정보 + 확장 투자 지표 + 매출 세그먼트 (yfinance, 1시간 캐시)."""
    if market == "CRYPTO":
        return {"company": None, "metrics": None, "revenue_segments": None, "cached_at": None}

    cache_key = f"{market}:{symbol}"
    if cache_key in _cache:
        entry = _cache[cache_key]
        if time.time() - entry["_ts"] < _CACHE_TTL:
            return entry["data"]

    data = await asyncio.to_thread(_fetch_company, symbol, market)
    _cache[cache_key] = {"data": data, "_ts": time.time()}
    return data
