# Contract: 시장 방향성 API

## GET /api/sentiment/overview

현재 시장 지표 종합 조회.

**Response**:
```json
{
  "fear_greed": 62.5,
  "fear_greed_label": "Greed",
  "sentiment_summary": "낙관적 분위기",
  "vix": { "name": "VIX", "value": 15.2, "change": -1.3, "change_pct": -7.9, "direction": "down" },
  "kospi": { "name": "코스피", "value": 2650.12, "change": 22.5, "change_pct": 0.86, "direction": "up" },
  "sp500": { "name": "S&P 500", "value": 5280.50, "change": 45.2, "change_pct": 0.86, "direction": "up" },
  "nasdaq": { "name": "나스닥", "value": 16450.30, "change": 210.5, "change_pct": 1.30, "direction": "up" },
  "usdkrw": { "name": "USD/KRW", "value": 1385.20, "change": -3.2, "change_pct": -0.23, "direction": "down" },
  "updated_at": "2026-03-24T10:30:00"
}
```

## GET /api/sentiment/history

Fear & Greed 30일 추이.

**Response**:
```json
{
  "dates": ["2026-02-22", "2026-02-23", ...],
  "values": [45.2, 42.1, ...],
  "updated_at": "2026-03-24T10:30:00"
}
```
