# API Contract: 회사 정보 & 투자 지표

**Feature**: 018-stock-detail-info

---

## GET /api/company/{symbol}

종목의 회사 정보, 확장 투자 지표, 매출 세그먼트를 반환.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `symbol` | path | string | Yes | 종목 코드 (예: `005930`, `AAPL`) |
| `market` | query | string | No | `KR` \| `KOSPI` \| `KOSDAQ` \| `US` \| `CRYPTO` (기본값: `KR`) |

### Response 200 — 정상

```json
{
  "company": {
    "name": "string",
    "logo_url": "string | null",
    "description": "string | null",
    "industry": "string | null",
    "sector": "string | null",
    "country": "string | null",
    "exchange": "string | null",
    "employees": "integer | null",
    "website": "string | null"
  },
  "metrics": {
    "per": "float | null",
    "pbr": "float | null",
    "roe": "float | null",
    "roa": "float | null",
    "eps": "float | null",
    "bps": "float | null",
    "dividend_yield": "float | null",
    "market_cap": "integer | null",
    "operating_margin": "float | null",
    "debt_to_equity": "float | null",
    "currency": "KRW | USD"
  },
  "revenue_segments": [
    {
      "name": "string",
      "revenue": "float",
      "percentage": "float",
      "period": "YYYY-MM"
    }
  ] | null,
  "cached_at": "ISO 8601 string"
}
```

### Response — CRYPTO 또는 데이터 없음

```json
{
  "company": null,
  "metrics": null,
  "revenue_segments": null,
  "cached_at": null
}
```

### Cache

- TTL: 1시간 (서버 메모리)
- Cache key: `"{market}:{symbol}"`
- 서버 재시작 시 초기화

### Notes

- `roe`, `roa`, `dividend_yield`, `operating_margin`은 백분율(%) 값 (0.085 → 8.5)
- `market_cap`은 해당 통화 단위 절댓값 (프론트에서 억/조 변환)
- `revenue_segments`는 US 대형주에만 존재, 나머지는 `null`
- CRYPTO market이면 즉시 null 반환 (yfinance 조회 없음)
