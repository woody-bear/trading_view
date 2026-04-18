# Data Model: 종목 상세 — 투자 지표 및 회사 정보 패널

**Feature**: 018-stock-detail-info  
**Date**: 2026-04-08

---

## Entities

### CompanyInfo

yfinance `ticker.info`에서 추출. DB 저장 없음 — 메모리 캐시만 사용.

| Field | Type | Source (ticker.info) | Nullable | Notes |
|-------|------|---------------------|----------|-------|
| `name` | string | `shortName` \| `longName` | No | 항상 존재 |
| `logo_url` | string \| null | `logo_url` | Yes | 없으면 null → 프론트에서 텍스트 아바타 |
| `description` | string \| null | `longBusinessSummary` | Yes | |
| `industry` | string \| null | `industry` | Yes | |
| `sector` | string \| null | `sector` | Yes | |
| `country` | string \| null | `country` | Yes | |
| `exchange` | string \| null | `exchange` | Yes | |
| `employees` | int \| null | `fullTimeEmployees` | Yes | US only 실질적 |
| `website` | string \| null | `website` | Yes | US only 실질적 |

---

### InvestmentMetrics

TTM 기준 지표. DB 저장 없음.

| Field | Type | Source (ticker.info) | Nullable | Notes |
|-------|------|---------------------|----------|-------|
| `per` | float \| null | `trailingPE` | Yes | TTM 기준 |
| `pbr` | float \| null | `priceToBook` | Yes | |
| `roe` | float \| null | `returnOnEquity` | Yes | 소수 → ×100 % 변환 |
| `roa` | float \| null | `returnOnAssets` | Yes | 소수 → ×100 % 변환 |
| `eps` | float \| null | `trailingEps` | Yes | TTM 기준 |
| `bps` | float \| null | `bookValue` | Yes | |
| `dividend_yield` | float \| null | `dividendYield` | Yes | 소수 → ×100 % 변환; 무배당 → null |
| `market_cap` | int \| null | `marketCap` | Yes | 원화/달러 절댓값 |
| `operating_margin` | float \| null | `operatingMargins` | Yes | 소수 → ×100 % 변환 |
| `debt_to_equity` | float \| null | `debtToEquity` | Yes | |
| `currency` | string | derived | No | "KRW" (KR) \| "USD" (US) |

---

### RevenueSegment

yfinance `ticker.revenue_by_product` DataFrame에서 추출. US 대형주에만 존재.

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | 세그먼트명 |
| `revenue` | float | 절댓값 (원화/달러) |
| `percentage` | float | 전체 대비 비중 (0~100) |
| `period` | string | "YYYY-MM" 형식 기준 날짜 |

---

## API Response Shape

### `GET /api/company/{symbol}?market=KR`

```json
{
  "company": {
    "name": "삼성전자",
    "logo_url": null,
    "description": "삼성전자는...",
    "industry": "Semiconductors",
    "sector": "Technology",
    "country": "South Korea",
    "exchange": "KSC",
    "employees": null,
    "website": null
  },
  "metrics": {
    "per": 14.2,
    "pbr": 1.1,
    "roe": 8.5,
    "roa": 4.2,
    "eps": 4123.0,
    "bps": 52000.0,
    "dividend_yield": 2.1,
    "market_cap": 380000000000000,
    "operating_margin": 12.3,
    "debt_to_equity": 34.5,
    "currency": "KRW"
  },
  "revenue_segments": null,
  "cached_at": "2026-04-08T10:00:00"
}
```

**CRYPTO 응답**: `{"company": null, "metrics": null, "revenue_segments": null}`  
**오류 응답**: `{"company": null, "metrics": null, "revenue_segments": null}` (섹션 숨김 처리)

---

## No DB Schema Changes

이 기능은 DB 스키마 변경 없음. 모든 데이터는 yfinance에서 실시간 조회 후 메모리 캐시.
