# API Contract: GET /trendline-channels/{symbol}

**Route file**: `backend/routes/trendline_channels.py`  
**Isolation**: 기존 `/trend-analysis`, `/chart/quick` 엔드포인트와 완전 독립

---

## Request

```
GET /api/trendline-channels/{symbol}?market=KR
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| symbol | path string | ✅ | — | 종목 심볼 (예: `005930`, `AAPL`, `BTC-USD`) |
| market | query string | ✅ | `KR` | 시장 (`KR` / `US` / `CRYPTO`) |

---

## Response (200 OK)

```json
{
  "symbol": "005930",
  "market": "KR",
  "evaluated_at": "2026-04-25T12:00:00Z",
  "periods": {
    "1m": { ... PeriodResult },
    "3m": { ... PeriodResult },
    "6m": { ... PeriodResult },
    "12m": { ... PeriodResult }
  }
}
```

### PeriodResult 구조

```json
{
  "candle_count": 66,
  "lines": [
    {
      "kind": "downtrend_main",
      "start": { "time": 1704067200, "price": 85400.0 },
      "end":   { "time": 1745539200, "price": 72300.0 },
      "style": { "color": "#ef4444", "dashed": false }
    },
    {
      "kind": "downtrend_parallel",
      "start": { "time": 1704067200, "price": 68000.0 },
      "end":   { "time": 1745539200, "price": 55000.0 },
      "style": { "color": "#ef4444", "dashed": true }
    },
    {
      "kind": "uptrend_main",
      "start": { "time": 1714521600, "price": 62000.0 },
      "end":   { "time": 1745539200, "price": 78500.0 },
      "style": { "color": "#22c55e", "dashed": false }
    },
    {
      "kind": "uptrend_parallel",
      "start": { "time": 1714521600, "price": 75000.0 },
      "end":   { "time": 1745539200, "price": 91500.0 },
      "style": { "color": "#22c55e", "dashed": true }
    }
  ],
  "phase": {
    "current_stage": 2,
    "inflection_times": [1736352000, 1739030400],
    "insufficient": false,
    "message": null,
    "steps": [
      {
        "stage": 1,
        "label": "하락추세선 돌파",
        "completed": true,
        "completed_time": 1736352000,
        "completed_price": 74500.0,
        "volume_ratio": 2.3
      },
      {
        "stage": 2,
        "label": "평행추세선 지지",
        "completed": true,
        "completed_time": 1739030400,
        "completed_price": 71200.0,
        "volume_ratio": 1.8
      },
      {
        "stage": 3,
        "label": "평행추세선 돌파",
        "completed": false,
        "completed_time": null,
        "completed_price": null,
        "volume_ratio": null
      },
      {
        "stage": 4,
        "label": "상승추세선 지지",
        "completed": false,
        "completed_time": null,
        "completed_price": null,
        "volume_ratio": null
      },
      {
        "stage": 5,
        "label": "상승추세선 돌파",
        "completed": false,
        "completed_time": null,
        "completed_price": null,
        "volume_ratio": null
      }
    ]
  }
}
```

### 데이터 부족 시 (insufficient=true)

```json
{
  "candle_count": 18,
  "lines": [],
  "phase": {
    "current_stage": 0,
    "inflection_times": [],
    "insufficient": true,
    "message": "분석 불가 — 데이터 부족 (최소 22 거래일 필요)",
    "steps": []
  }
}
```

---

## Error Responses

| Status | Condition |
|--------|-----------|
| 500 | 서비스 내부 오류 — 빈 PeriodResult 반환 (오류 전파 없음) |

> **주의**: 오류 시 빈 응답 반환 (기존 `/trend-analysis` 패턴과 동일). HTTP 500은 로그에만 기록.

---

## Cache Behavior

- 서버: `(symbol, market)` 키로 60초 in-memory 캐시
- 클라이언트: React Query `staleTime: 60_000`
- 탭 전환: 캐시 응답에서 `periods[selectedPeriod]` 참조 — 네트워크 요청 없음
