"""회사 정보 & 확장 투자 지표 API — yfinance ticker.info 기반, 1시간 캐시."""

import asyncio
import time
from datetime import datetime

from fastapi import APIRouter
from loguru import logger

from services.asset_class import AssetClass, classify, supports_valuation
from services import naver_fundamentals

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


# yfinance sector 영문 → 한글 매핑 (11개 고정)
_SECTOR_KO: dict[str, str] = {
    "Technology": "기술",
    "Healthcare": "헬스케어",
    "Financial Services": "금융",
    "Consumer Cyclical": "경기소비재",
    "Consumer Defensive": "필수소비재",
    "Communication Services": "커뮤니케이션",
    "Industrials": "산업재",
    "Energy": "에너지",
    "Basic Materials": "소재",
    "Real Estate": "부동산",
    "Utilities": "유틸리티",
}


def _translate_sector(sector: str | None) -> str | None:
    if not sector:
        return sector
    return _SECTOR_KO.get(sector, sector)


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


def _extract_reporting_period(info: dict) -> str | None:
    """yfinance info에서 보고 기준일 추출.

    우선순위: mostRecentQuarter(분기) → lastFiscalYearEnd(연간).
    값은 주로 epoch 초 또는 'YYYY-MM-DD' 문자열로 오며, 분기는 "YYYY-Q#"로, 연간은
    "YYYY-MM-DD" 그대로 반환. 결측/파싱 실패 시 None.
    """
    from datetime import datetime as _dt

    def _to_date(val) -> _dt | None:
        if val is None:
            return None
        try:
            if isinstance(val, (int, float)):
                return _dt.utcfromtimestamp(float(val))
            if isinstance(val, str):
                return _dt.strptime(val[:10], "%Y-%m-%d")
        except (TypeError, ValueError, OSError):
            return None
        return None

    q_date = _to_date(info.get("mostRecentQuarter"))
    if q_date is not None:
        quarter = (q_date.month - 1) // 3 + 1
        return f"{q_date.year}-Q{quarter}"

    y_date = _to_date(info.get("lastFiscalYearEnd"))
    if y_date is not None:
        return y_date.strftime("%Y-%m-%d")

    return None


def _fetch_company(symbol: str, market: str) -> dict:
    """yfinance에서 회사 정보 + 투자 지표 + 매출 세그먼트 조회."""
    import yfinance as yf

    ticker_sym = _fmt_ticker(symbol, market)
    if ticker_sym is None:
        return {
            "company": None,
            "metrics": None,
            "revenue_segments": None,
            "reporting_period": None,
            "cached_at": None,
        }

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
        sector = _translate_sector(info.get("sector") or None)
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

        # 배당수익률: 현재 yfinance는 KR/US 공통으로 이미 % 단위로 반환
        # (예: SK하이닉스 0.27 = 0.27%, AAPL 0.4 = 0.4%).
        # 과거 버전은 US=decimal / KR=percent로 달라 1.0 기준 휴리스틱을 썼으나,
        # 현재는 불필요해 제거 — 그대로 % 값으로 사용.
        div_raw = info.get("dividendYield")
        dividend_yield = None
        if div_raw is not None:
            try:
                dv = float(div_raw)
                if dv > 0:
                    dividend_yield = round(dv, 2)
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
        reporting_period = _extract_reporting_period(info)
        return {
            "company": company,
            "metrics": metrics,
            "revenue_segments": revenue_segments,
            "reporting_period": reporting_period,
            "cached_at": cached_at,
        }

    except Exception as e:
        logger.debug(f"회사 정보 조회 실패 [{market}/{symbol}]: {e}")
        return {
            "company": None,
            "metrics": None,
            "revenue_segments": None,
            "reporting_period": None,
            "cached_at": None,
        }


@router.get("/company/{symbol}")
async def get_company_info(symbol: str, market: str = "KR"):
    """종목 회사 정보 + 확장 투자 지표 + 매출 세그먼트 + 자산군 (yfinance, 1시간 캐시).

    응답 필드 `asset_class`(6종)로 프론트가 가치 분석 탭 활성화 여부를 결정한다.
    미지원 자산군(ETF/CRYPTO/INDEX/FX)은 200 응답 + `metrics: null`.
    """
    asset_class = classify(symbol, market)

    # 가치 분석 미지원 자산군 — yfinance 조회 생략하고 단축 응답
    if not supports_valuation(asset_class):
        return {
            "company": None,
            "metrics": None,
            "revenue_segments": None,
            "asset_class": asset_class.value,
            "reporting_period": None,
            "cached_at": datetime.utcnow().isoformat(),
        }

    cache_key = f"{market}:{symbol}"
    if cache_key in _cache and time.time() - _cache[cache_key]["_ts"] < _CACHE_TTL:
        data = _cache[cache_key]["data"]
    else:
        data = await asyncio.to_thread(_fetch_company, symbol, market)
        _cache[cache_key] = {"data": data, "_ts": time.time()}

    out = dict(data)
    out["asset_class"] = asset_class.value

    # 023: KR 개별주 한정 네이버 파이낸스 보강 (PER/PBR/EPS/BPS + 기준일).
    # 캐시 hit/miss 양쪽 경로 모두 적용 — company 캐시는 yfinance 원본만 보관,
    # naver_fundamentals 측 24h 캐시가 중복 네트워크 호출을 방지한다.
    if naver_fundamentals._is_target(symbol, asset_class.value, market):
        naver = await naver_fundamentals.fetch(symbol)
        if naver:
            metrics = dict(out.get("metrics") or {})
            for key in ("per", "pbr", "eps", "bps"):
                nv = naver.get(key)
                if nv is not None:
                    metrics[key] = nv
            out["metrics"] = metrics
            if naver.get("reporting_period"):
                out["reporting_period"] = naver["reporting_period"]
    return out
