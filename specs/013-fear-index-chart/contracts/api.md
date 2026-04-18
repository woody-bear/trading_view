# API Contracts: 공포지수 차트 개선 (013-fear-index-chart)

## Modified Endpoints

### GET /api/sentiment/history

**변경 사항**: `days` 쿼리 파라미터 추가 (기존 기본값 30 유지)

**Request**:
```
GET /api/sentiment/history?days=90
```

| Parameter | Type | Default | Allowed |
|-----------|------|---------|---------|
| `days` | integer | 30 | 30, 90, 365 |

**Response** (기존과 동일):
```json
{
  "dates": ["2026-01-01", "2026-01-02", "..."],
  "values": [42, 38, 45, "..."],
  "updated_at": "2026-04-03T12:00:00"
}
```

**Error Response** (기존과 동일):
```json
{ "dates": [], "values": [], "error": "..." }
```

**Backward Compatibility**: `days` 없이 호출하면 기존과 동일하게 30일 반환

---

## New Endpoints

### GET /api/sentiment/vix-history

**Purpose**: VIX 히스토리 차트 데이터 제공 (기간 선택 가능)

**Request**:
```
GET /api/sentiment/vix-history?days=90
```

| Parameter | Type | Default | Allowed |
|-----------|------|---------|---------|
| `days` | integer | 365 | 30, 90, 365 |

**Response**:
```json
{
  "dates": ["2025-04-01", "2025-04-02", "..."],
  "values": [16.5, 18.2, 22.1, "..."],
  "updated_at": "2026-04-03T12:00:00"
}
```

**Error Response**:
```json
{ "dates": [], "values": [], "error": "..." }
```

**Notes**:
- VIX 기준선(20, 30)은 프론트엔드 상수로 처리 (응답에 포함 안 함)
- yfinance `^VIX` 조회, 장 시간 외에는 전일 종가 반환
