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


def _parse_html(html: str) -> NaverFundamentalsPayload:
    """네이버 종목 메인 페이지 HTML에서 PER/PBR/EPS/BPS + 기준일 추출.

    각 필드 파싱은 독립적 — 한 필드 실패해도 나머지는 정상 반환.
    """
    from datetime import datetime, timezone

    payload: NaverFundamentalsPayload = {
        "per": None,
        "pbr": None,
        "eps": None,
        "bps": None,
        "reporting_period": None,
        "source": "naver",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        soup = BeautifulSoup(html, "html.parser")
        aside = soup.find("div", class_="aside_invest_info")
    except Exception as e:
        logger.debug(f"naver parse soup failed: {e}")
        return payload
    if not aside:
        return payload

    def _find_th(keys: list[str]):
        """th 중 keys 모두 포함된 첫 번째 요소."""
        for th in aside.find_all("th"):
            txt = th.get_text(" ", strip=True)
            if all(k in txt for k in keys):
                return th
        return None

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

    # PER + EPS (같은 row)
    th_per_eps = _find_th(["PER", "EPS"])
    if th_per_eps:
        try:
            td = th_per_eps.find_parent("tr").find("td")
            ems = td.find_all("em") if td else []
            if len(ems) >= 1:
                payload["per"] = _to_float(ems[0].get_text(strip=True))
            if len(ems) >= 2:
                payload["eps"] = _to_int(ems[1].get_text(strip=True))
            # reporting_period — "(YYYY.MM)" 추출
            m = _PERIOD_RE.search(th_per_eps.get_text(" ", strip=True))
            if m:
                y, mo = int(m.group(1)), int(m.group(2))
                q = (mo - 1) // 3 + 1
                payload["reporting_period"] = f"{y}-Q{q}"
        except Exception as e:
            logger.debug(f"naver PER/EPS row parse fail: {e}")

    # PBR + BPS (같은 row)
    th_pbr_bps = _find_th(["PBR", "BPS"])
    if th_pbr_bps:
        try:
            td = th_pbr_bps.find_parent("tr").find("td")
            ems = td.find_all("em") if td else []
            if len(ems) >= 1:
                payload["pbr"] = _to_float(ems[0].get_text(strip=True))
            if len(ems) >= 2:
                payload["bps"] = _to_int(ems[1].get_text(strip=True))
            # reporting_period 폴백 (PER row에서 못 찾았으면)
            if payload.get("reporting_period") is None:
                m = _PERIOD_RE.search(th_pbr_bps.get_text(" ", strip=True))
                if m:
                    y, mo = int(m.group(1)), int(m.group(2))
                    q = (mo - 1) // 3 + 1
                    payload["reporting_period"] = f"{y}-Q{q}"
        except Exception as e:
            logger.debug(f"naver PBR/BPS row parse fail: {e}")

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

        try:
            html = r.content.decode("euc-kr", errors="ignore")
        except Exception as e:
            _record_fail(symbol, "decode", str(e))
            return None

        try:
            payload = _parse_html(html)
        except Exception as e:
            _record_fail(symbol, "parse", str(e))
            return None

        # 모든 핵심 필드가 None이면 실패로 집계(페이지 구조 변경 의심)
        if all(payload.get(k) is None for k in ("per", "pbr", "eps", "bps")):
            _record_fail(symbol, "parse", "all fields None")
            return None

        _cache[symbol] = {"payload": payload, "expires_at": time.time() + TTL_SECONDS}
        _stats["ok"] += 1
        return payload
