"""네이버 파이낸스 크롤러 — KR 개별주 PER/PBR/EPS/BPS 보강 (023).

정책:
- 대상: KR 개별 상장주식(STOCK_KR) 한정. ETF/CRYPTO/US는 스킵.
- 호출 시점: 사용자 상세 진입(on-demand)만. 전체 스캔 루프에서 호출 금지.
- 캐시: in-memory, TTL 24시간.
- 실패 시: 조용히 None 반환 → 호출자가 yfinance 폴백.
- 동시 호출: symbol Lock으로 중복 네트워크 요청 방지.
"""

from __future__ import annotations

import asyncio
import re
import time
from collections import deque
from typing import TypedDict

import httpx
from bs4 import BeautifulSoup
from loguru import logger

from services.scan_symbols_list import KR_ETF_SYMBOLS

NAVER_URL_TEMPLATE = "https://finance.naver.com/item/main.naver?code={symbol}"
TTL_SECONDS = 86400  # 24h (Clarifications Q1)
TIMEOUT_SECONDS = 3.0
UA_HEADER = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_SIX_DIGIT = re.compile(r"^\d{6}$")
_PERIOD_RE = re.compile(r"(\d{4})\.(\d{2})")


class NaverFundamentalsPayload(TypedDict, total=False):
    per: float | None
    pbr: float | None
    eps: int | None
    bps: int | None
    # aside_invest_info 추가 필드
    market_cap: int | None            # 원 단위 (조·억원 텍스트 → int)
    dividend_yield: float | None      # % 단위, "N/A" → None
    sector: str | None                # 업종명 (동일업종 링크 text)
    # cop_analysis(기업실적분석) 최근 확정 연간 실적
    roe: float | None                 # %
    operating_margin: float | None    # %
    debt_to_equity: float | None      # %
    reporting_period: str | None
    fetched_at: str
    source: str  # always "naver"


class _CacheEntry(TypedDict):
    payload: NaverFundamentalsPayload
    expires_at: float


_cache: dict[str, _CacheEntry] = {}
_locks: dict[str, asyncio.Lock] = {}
_stats: dict = {
    "ok": 0,
    "fail": 0,
    "recent_fails": deque(maxlen=10),
}


def _is_target(symbol: str, asset_class: str, market: str | None = None) -> bool:
    """네이버 크롤링 대상 여부. STOCK_KR + 6자리 숫자 + ETF 제외."""
    if asset_class != "STOCK_KR":
        return False
    if not symbol or not _SIX_DIGIT.match(symbol):
        return False
    if symbol in KR_ETF_SYMBOLS:
        return False
    return True


_MARKET_CAP_JO_RE = re.compile(r"(\d+)\s*조")
_MARKET_CAP_EOK_RE = re.compile(r"([\d,]+)\s*억")
_NUMBER_RE = re.compile(r"-?[\d,]+\.?\d*")


def _to_float(s: str) -> float | None:
    try:
        return float(s.replace(",", "").strip())
    except (ValueError, AttributeError):
        return None


def _to_int(s: str) -> int | None:
    try:
        return int(float(s.replace(",", "").strip()))
    except (ValueError, AttributeError):
        return None


def _parse_market_cap(td_text: str) -> int | None:
    """'3조 4,758 억원' → 3,475,800,000,000. 단위 혼합 파싱."""
    s = td_text.replace("\xa0", " ").strip()
    jo = 0
    eok = 0
    m = _MARKET_CAP_JO_RE.search(s)
    if m:
        try:
            jo = int(m.group(1))
        except ValueError:
            jo = 0
    m = _MARKET_CAP_EOK_RE.search(s)
    if m:
        try:
            eok = int(m.group(1).replace(",", ""))
        except ValueError:
            eok = 0
    if jo == 0 and eok == 0:
        return None
    total_eok = jo * 10_000 + eok
    return total_eok * 100_000_000  # 1억 = 10^8


def _parse_dividend_yield(td_text: str) -> float | None:
    """'1.25%' → 1.25, 'N/A' → None."""
    s = td_text.strip()
    if not s or s == "-" or "N/A" in s.upper():
        return None
    m = _NUMBER_RE.search(s.replace(",", ""))
    if not m:
        return None
    try:
        return float(m.group(0))
    except ValueError:
        return None


def _parse_cop_analysis(soup) -> dict:
    """기업실적분석(cop_analysis)에서 ROE/영업이익률/부채비율의 최근 확정 연간 실적 값 추출."""
    result = {"roe": None, "operating_margin": None, "debt_to_equity": None}
    section = soup.find("div", class_="section cop_analysis")
    if not section:
        return result
    table = section.find("table")
    if not table:
        return result
    thead = table.find("thead")
    tbody = table.find("tbody")
    if not thead or not tbody:
        return result

    # 기간 헤더 행(두 번째 tr) — YYYY.MM 또는 YYYY.MM (E) 패턴
    period_texts: list[str] = []
    for tr in thead.find_all("tr"):
        ths = tr.find_all("th")
        texts = [th.get_text(" ", strip=True) for th in ths]
        if any(_PERIOD_RE.search(t) for t in texts):
            period_texts = texts
            break
    if not period_texts:
        return result

    # 표준 구조: 앞 4개가 연간(3개 확정 + 1개 (E)), 뒤 6개가 분기.
    # 최근 확정 연간 = 연간 구간 중 (E) 없는 마지막 인덱스.
    annual_end = min(4, len(period_texts))
    latest_idx = None
    for i in range(annual_end - 1, -1, -1):
        if "(E)" not in period_texts[i] and _PERIOD_RE.search(period_texts[i]):
            latest_idx = i
            break
    if latest_idx is None:
        return result

    label_to_key = [
        ("ROE", "roe"),
        ("영업이익률", "operating_margin"),
        ("부채비율", "debt_to_equity"),
    ]
    for tr in tbody.find_all("tr"):
        th = tr.find("th")
        if not th:
            continue
        label = th.get_text(" ", strip=True)
        matched = None
        for prefix, key in label_to_key:
            if label.startswith(prefix):
                matched = key
                break
        if not matched:
            continue
        tds = tr.find_all("td")
        # 최신 확정 인덱스부터 과거 방향으로 폴백
        for idx in range(latest_idx, -1, -1):
            if idx >= len(tds):
                continue
            txt = tds[idx].get_text(" ", strip=True).replace(",", "")
            if not txt or txt == "-":
                continue
            try:
                result[matched] = float(txt)
                break
            except ValueError:
                continue
    return result


def _parse_html(html: str) -> NaverFundamentalsPayload:
    """네이버 종목 메인 페이지 HTML에서 지표 + 기준일 추출.

    각 필드 파싱은 독립적 — 한 필드 실패해도 나머지는 정상 반환.
    """
    from datetime import datetime, timezone

    payload: NaverFundamentalsPayload = {
        "per": None,
        "pbr": None,
        "eps": None,
        "bps": None,
        "market_cap": None,
        "dividend_yield": None,
        "sector": None,
        "roe": None,
        "operating_margin": None,
        "debt_to_equity": None,
        "reporting_period": None,
        "source": "naver",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception as e:
        logger.debug(f"naver parse soup failed: {e}")
        return payload

    aside = soup.find("div", class_="aside_invest_info")
    if aside:
        def _find_th(keys: list[str]):
            for th in aside.find_all("th"):
                txt = th.get_text(" ", strip=True)
                if all(k in txt for k in keys):
                    return th
            return None

        # PER + EPS
        th_per_eps = _find_th(["PER", "EPS"])
        if th_per_eps:
            try:
                td = th_per_eps.find_parent("tr").find("td")
                ems = td.find_all("em") if td else []
                if len(ems) >= 1:
                    payload["per"] = _to_float(ems[0].get_text(strip=True))
                if len(ems) >= 2:
                    payload["eps"] = _to_int(ems[1].get_text(strip=True))
                m = _PERIOD_RE.search(th_per_eps.get_text(" ", strip=True))
                if m:
                    y, mo = int(m.group(1)), int(m.group(2))
                    q = (mo - 1) // 3 + 1
                    payload["reporting_period"] = f"{y}-Q{q}"
            except Exception as e:
                logger.debug(f"naver PER/EPS row parse fail: {e}")

        # PBR + BPS
        th_pbr_bps = _find_th(["PBR", "BPS"])
        if th_pbr_bps:
            try:
                td = th_pbr_bps.find_parent("tr").find("td")
                ems = td.find_all("em") if td else []
                if len(ems) >= 1:
                    payload["pbr"] = _to_float(ems[0].get_text(strip=True))
                if len(ems) >= 2:
                    payload["bps"] = _to_int(ems[1].get_text(strip=True))
                if payload.get("reporting_period") is None:
                    m = _PERIOD_RE.search(th_pbr_bps.get_text(" ", strip=True))
                    if m:
                        y, mo = int(m.group(1)), int(m.group(2))
                        q = (mo - 1) // 3 + 1
                        payload["reporting_period"] = f"{y}-Q{q}"
            except Exception as e:
                logger.debug(f"naver PBR/BPS row parse fail: {e}")

        # 시가총액 — 첫 번째 th가 '시가총액'인 row (시가총액순위와 구분)
        try:
            for th in aside.find_all("th"):
                txt = th.get_text(" ", strip=True)
                if txt == "시가총액":
                    td = th.find_parent("tr").find("td")
                    if td:
                        payload["market_cap"] = _parse_market_cap(
                            td.get_text(" ", strip=True)
                        )
                    break
        except Exception as e:
            logger.debug(f"naver market_cap parse fail: {e}")

        # 배당수익률
        th_div = _find_th(["배당수익률"])
        if th_div:
            try:
                td = th_div.find_parent("tr").find("td")
                if td:
                    payload["dividend_yield"] = _parse_dividend_yield(
                        td.get_text(" ", strip=True)
                    )
            except Exception as e:
                logger.debug(f"naver dividend parse fail: {e}")

    # 업종(섹터) — 동일업종 상세 링크에서 텍스트 추출
    try:
        a = soup.find("a", href=re.compile(r"sise_group_detail\.naver.*type=upjong"))
        if a:
            name = a.get_text(strip=True)
            if name:
                payload["sector"] = name
    except Exception as e:
        logger.debug(f"naver sector parse fail: {e}")

    # 기업실적분석 — ROE, 영업이익률, 부채비율
    try:
        cop = _parse_cop_analysis(soup)
        payload["roe"] = cop["roe"]
        payload["operating_margin"] = cop["operating_margin"]
        payload["debt_to_equity"] = cop["debt_to_equity"]
    except Exception as e:
        logger.debug(f"naver cop_analysis parse fail: {e}")

    return payload


def _record_fail(symbol: str, stage: str, error: str) -> None:
    from datetime import datetime, timezone

    _stats["fail"] += 1
    _stats["recent_fails"].append(
        {
            "symbol": symbol,
            "stage": stage,
            "error": error[:200],
            "ts": datetime.now(timezone.utc).isoformat(),
        }
    )


async def fetch(symbol: str) -> NaverFundamentalsPayload | None:
    """네이버에서 보강 페이로드 조회. 실패·스킵 대상이면 None.

    호출자 측에서 _is_target 선행 체크 권장(본 함수도 최소 가드는 수행).
    """
    if not symbol or not _SIX_DIGIT.match(symbol):
        return None

    now = time.time()
    hit = _cache.get(symbol)
    if hit and hit["expires_at"] > now:
        return hit["payload"]

    lock = _locks.setdefault(symbol, asyncio.Lock())
    async with lock:
        # lock 대기 중에 다른 요청이 캐시 채웠을 수 있음 — 재확인
        hit = _cache.get(symbol)
        if hit and hit["expires_at"] > time.time():
            return hit["payload"]

        url = NAVER_URL_TEMPLATE.format(symbol=symbol)
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                r = await client.get(url, headers={"User-Agent": UA_HEADER})
            if r.status_code != 200:
                _record_fail(symbol, "network", f"HTTP {r.status_code}")
                return None
        except httpx.TimeoutException as e:
            _record_fail(symbol, "network", f"timeout: {e}")
            return None
        except httpx.HTTPError as e:
            _record_fail(symbol, "network", f"http error: {e}")
            return None
        except Exception as e:
            _record_fail(symbol, "network", f"unexpected: {e}")
            return None

        # 2026-04 기준 네이버는 UTF-8로 서빙. Content-Type charset을 우선 존중하되
        # 미지정 시 UTF-8 → EUC-KR 폴백.
        charset = None
        ct = r.headers.get("content-type", "")
        m = re.search(r"charset=([^\s;]+)", ct, re.I)
        if m:
            charset = m.group(1).strip().lower()
        html = None
        for enc in ([charset] if charset else []) + ["utf-8", "euc-kr"]:
            try:
                html = r.content.decode(enc, errors="strict")
                break
            except (LookupError, UnicodeDecodeError):
                continue
        if html is None:
            html = r.content.decode("utf-8", errors="replace")

        try:
            payload = _parse_html(html)
        except Exception as e:
            _record_fail(symbol, "parse", str(e))
            return None

        # 모든 핵심 필드가 None이면 실패로 집계(페이지 구조 변경 의심).
        # 배당수익률/시가총액/섹터만 있고 나머지 전부 None인 경우는 드물어서 핵심에서 제외.
        core_keys = ("per", "pbr", "eps", "bps", "roe", "operating_margin", "debt_to_equity", "market_cap")
        if all(payload.get(k) is None for k in core_keys):
            _record_fail(symbol, "parse", "all fields None")
            return None

        _cache[symbol] = {"payload": payload, "expires_at": time.time() + TTL_SECONDS}
        _stats["ok"] += 1
        return payload
