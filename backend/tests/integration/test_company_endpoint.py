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
