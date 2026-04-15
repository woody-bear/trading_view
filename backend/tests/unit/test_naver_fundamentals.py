"""naver_fundamentals 단위 테스트 — _is_target 규칙 + fixture 파싱."""

from pathlib import Path

import pytest

from services.naver_fundamentals import _is_target, _parse_html

FIXTURES = Path(__file__).parent.parent / "fixtures"


# ── T005: _is_target 스킵 규칙 ─────────────────────────────────────────────

@pytest.mark.parametrize(
    "symbol,asset_class,market,expected",
    [
        # 대상
        ("005930", "STOCK_KR", "KR", True),
        ("000660", "STOCK_KR", "KR", True),
        # 비대상 — 자산군 불일치
        ("AAPL", "STOCK_US", "US", False),
        ("BTC-USD", "CRYPTO", "CRYPTO", False),
        # 비대상 — KR이지만 ETF
        ("069500", "STOCK_KR", "KR", False),  # KODEX 200 → ETF 리스트에 있음
        # 비대상 — 6자리 숫자가 아님
        ("ABC123", "STOCK_KR", "KR", False),
        ("12345", "STOCK_KR", "KR", False),
    ],
)
def test_is_target(symbol, asset_class, market, expected):
    assert _is_target(symbol, asset_class, market) is expected


# ── T007: SK하이닉스 fixture 파싱 ──────────────────────────────────────────

def test_parse_sk_hynix():
    html = (FIXTURES / "naver_000660.html").read_bytes().decode("euc-kr", errors="ignore")
    payload = _parse_html(html)

    assert payload["per"] is not None and payload["per"] > 0
    assert payload["pbr"] is not None and payload["pbr"] > 0
    assert payload["eps"] is not None and payload["eps"] > 0
    assert payload["bps"] is not None and payload["bps"] > 0

    # fixture 스냅샷 시점 기준: PER≈19.27, PBR≈6.51, EPS≈58955, BPS≈174539
    assert 10 < payload["per"] < 40
    assert 3 < payload["pbr"] < 15
    assert 30000 < payload["eps"] < 100000
    assert 100000 < payload["bps"] < 300000

    assert payload["reporting_period"] == "2025-Q4"
    assert payload["source"] == "naver"
    assert payload["fetched_at"]


# ── T008: 삼성전자 fixture 파싱 ───────────────────────────────────────────

def test_parse_samsung():
    html = (FIXTURES / "naver_005930.html").read_bytes().decode("euc-kr", errors="ignore")
    payload = _parse_html(html)

    # 최소한 PER/EPS/PBR/BPS 중 3개 이상은 채워져야 (SC-001 의미)
    filled = sum(1 for k in ("per", "pbr", "eps", "bps") if payload.get(k) is not None)
    assert filled >= 3, f"expected ≥3 filled, got {filled}: {payload}"

    assert payload["source"] == "naver"
    assert payload["reporting_period"] is not None
