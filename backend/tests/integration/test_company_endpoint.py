"""/company/{symbol} 통합 테스트 — asset_class 필드·미지원 자산군 단축 응답 검증.

외부 yfinance 호출은 monkeypatch로 스텁하여 네트워크·느린 I/O 배제.
"""

from fastapi.testclient import TestClient


def _make_client(monkeypatch):
    # 가치 지원 자산군에서만 _fetch_company가 호출됨 — 스텁으로 고정 응답 반환
    def _fake_fetch(symbol: str, market: str) -> dict:
        return {
            "company": {"name": f"{symbol} Co", "sector": "Tech", "industry": "Semi"},
            "metrics": {
                "per": 14.2, "pbr": 1.3, "roe": 9.8, "roa": 5.0,
                "eps": 4200, "bps": 30000, "dividend_yield": 2.1,
                "market_cap": 500_000_000, "operating_margin": 12.0,
                "debt_to_equity": 40.0, "currency": "KRW" if market != "US" else "USD",
            },
            "revenue_segments": None,
            "reporting_period": "2025-Q4",
            "cached_at": "2026-04-14T00:00:00",
        }

    from routes import company as company_module
    monkeypatch.setattr(company_module, "_fetch_company", _fake_fetch)
    # 모듈 캐시 비우기
    company_module._cache.clear()

    # 기본적으로 네이버 보강은 비활성(None) — 각 테스트에서 필요 시 override
    from services import naver_fundamentals

    async def _default_no_naver(symbol: str):
        return None

    monkeypatch.setattr(naver_fundamentals, "fetch", _default_no_naver)
    naver_fundamentals._cache.clear()

    from app import app
    return TestClient(app)


def test_stock_kr_returns_asset_class_and_metrics(monkeypatch):
    client = _make_client(monkeypatch)
    r = client.get("/api/company/005930", params={"market": "KR"})
    assert r.status_code == 200
    body = r.json()
    assert body["asset_class"] == "STOCK_KR"
    assert body["metrics"] is not None
    assert body["metrics"]["per"] == 14.2
    assert body["reporting_period"] == "2025-Q4"
    assert body["cached_at"] is not None


def test_stock_us_returns_stock_us(monkeypatch):
    client = _make_client(monkeypatch)
    r = client.get("/api/company/AAPL", params={"market": "US"})
    assert r.status_code == 200
    body = r.json()
    assert body["asset_class"] == "STOCK_US"
    assert body["metrics"] is not None
    assert body["metrics"]["currency"] == "USD"


def test_kr_etf_returns_null_metrics(monkeypatch):
    client = _make_client(monkeypatch)
    r = client.get("/api/company/069500", params={"market": "KR"})  # KODEX 200
    assert r.status_code == 200
    body = r.json()
    assert body["asset_class"] == "ETF"
    assert body["metrics"] is None
    assert body["reporting_period"] is None
    assert body["cached_at"] is not None  # 단축 응답이라도 캐시 시각은 채움


def test_crypto_returns_null_metrics(monkeypatch):
    client = _make_client(monkeypatch)
    r = client.get("/api/company/BTC-USD", params={"market": "CRYPTO"})
    assert r.status_code == 200
    body = r.json()
    assert body["asset_class"] == "CRYPTO"
    assert body["metrics"] is None
    assert body["reporting_period"] is None


# ── T011: 네이버 보강 통합 테스트 (023) ────────────────────────────────

def test_stock_kr_enriched_by_naver(monkeypatch):
    """KR 개별주 응답에 네이버 PER/PBR/EPS/BPS가 yfinance 값을 덮어써야 함."""
    client = _make_client(monkeypatch)
    from services import naver_fundamentals

    async def _fake_naver_fetch(symbol: str):
        return {
            "per": 19.27, "pbr": 6.51, "eps": 58955, "bps": 174539,
            "reporting_period": "2025-Q4",
            "source": "naver", "fetched_at": "2026-04-15T00:00:00+00:00",
        }
    monkeypatch.setattr(naver_fundamentals, "fetch", _fake_naver_fetch)

    r = client.get("/api/company/000660", params={"market": "KR"})
    assert r.status_code == 200
    body = r.json()
    assert body["asset_class"] == "STOCK_KR"
    m = body["metrics"]
    assert m["per"] == 19.27
    assert m["pbr"] == 6.51
    assert m["eps"] == 58955
    assert m["bps"] == 174539
    # yfinance 전용 지표는 그대로
    assert m["roe"] == 9.8
    assert body["reporting_period"] == "2025-Q4"


def test_stock_us_skips_naver(monkeypatch):
    """US 종목은 네이버 호출 스킵 — 기존 yfinance 값 그대로."""
    client = _make_client(monkeypatch)
    from services import naver_fundamentals

    call_count = {"n": 0}

    async def _unexpected_fetch(symbol: str):
        call_count["n"] += 1
        return None
    monkeypatch.setattr(naver_fundamentals, "fetch", _unexpected_fetch)

    r = client.get("/api/company/AAPL", params={"market": "US"})
    assert r.status_code == 200
    body = r.json()
    assert body["asset_class"] == "STOCK_US"
    assert body["metrics"]["per"] == 14.2  # yfinance fake 값
    assert call_count["n"] == 0


def test_stock_kr_naver_none_falls_back(monkeypatch):
    """네이버가 None 반환 시 yfinance 원값 유지."""
    client = _make_client(monkeypatch)
    from services import naver_fundamentals

    async def _fail_fetch(symbol: str):
        return None
    monkeypatch.setattr(naver_fundamentals, "fetch", _fail_fetch)

    r = client.get("/api/company/000660", params={"market": "KR"})
    assert r.status_code == 200
    m = r.json()["metrics"]
    assert m["per"] == 14.2
    assert m["eps"] == 4200
