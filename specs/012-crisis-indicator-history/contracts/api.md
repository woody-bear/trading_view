# API Contracts: 위기 이벤트 시장 지표 히스토리

**Branch**: `012-crisis-indicator-history` | **Date**: 2026-04-02
**Base path**: `/api/crisis`
**Auth**: 불필요 (FR-011 — 모든 방문자 조회 가능)

---

## GET /api/crisis/events

위기 이벤트 목록 조회. 유형 필터 지원.

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | NO | `war` \| `pandemic` \| `financial_crisis` \| `natural_disaster` |

**Response 200**:
```json
{
  "events": [
    {
      "id": 1,
      "name": "2008 글로벌 금융위기",
      "event_type": "financial_crisis",
      "start_date": "2008-09-15",
      "end_date": "2009-06-30",
      "is_ongoing": false,
      "severity_level": "critical",
      "description": "리먼브라더스 파산으로 시작된 전 세계 금융위기...",
      "has_comparison": true
    },
    {
      "id": 16,
      "name": "이란-미국 갈등 (2025)",
      "event_type": "war",
      "start_date": "2025-06-01",
      "end_date": null,
      "is_ongoing": true,
      "severity_level": "high",
      "description": "이란과 미국 간 군사적 긴장 고조...",
      "has_comparison": true
    }
  ],
  "total": 16
}
```

---

## GET /api/crisis/default-comparison

페이지 진입 시 자동 표시용. 현재 진행 중인 이벤트 + 매칭된 과거 이벤트 쌍 반환. (FR-013)

**Response 200**:
```json
{
  "current_event": {
    "id": 16,
    "name": "이란-미국 갈등 (2025)",
    "start_date": "2025-06-01",
    "is_ongoing": true,
    "event_type": "war"
  },
  "comparison_event": {
    "id": 3,
    "name": "1973 오일쇼크",
    "start_date": "1973-10-06",
    "end_date": "1974-03-18",
    "event_type": "war"
  },
  "match_type": "curated"
}
```

**match_type** values:
- `"curated"` — 큐레이터가 설정한 `best_comparison_event_id`
- `"category"` — 카테고리 폴백 (가장 최근 동일 유형 과거 이벤트)
- `"none"` — 진행 중 이벤트 없음 (current_event: null)

---

## GET /api/crisis/events/{event_id}/indicators

특정 이벤트의 지표별 일별 데이터. 차트 렌더링용. (FR-002, FR-003, FR-004)

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `event_id` | integer | 이벤트 ID |

**Query Parameters**:
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `days_before` | integer | NO | 30 | 발생일 이전 일수 (최대 180) |
| `days_after` | integer | NO | 180 | 발생일 이후 일수 (최대 180) |
| `indicator_ids` | string | NO | all | 콤마 구분 (예: `1,3,6`) |

**Response 200**:
```json
{
  "event": {
    "id": 3,
    "name": "1973 오일쇼크",
    "start_date": "1973-10-06"
  },
  "indicators": [
    {
      "id": 1,
      "name": "S&P500",
      "category": "equity",
      "unit": "index",
      "data_points": [
        {
          "date": "1973-09-06",
          "day_offset": -30,
          "value": 108.43,
          "change_pct": -2.1
        },
        {
          "date": "1973-10-06",
          "day_offset": 0,
          "value": 107.05,
          "change_pct": 0.0
        }
      ],
      "has_data": true
    },
    {
      "id": 2,
      "name": "코스피",
      "category": "equity",
      "unit": "index",
      "data_points": [],
      "has_data": false,
      "no_data_reason": "1996년 이전 데이터 없음"
    }
  ]
}
```

**Error 404**: `{ "detail": "Event not found" }`

---

## GET /api/crisis/events/{event_id}/stats

이벤트-지표별 요약 통계. (FR-007, SC-006)

**Response 200**:
```json
{
  "event_id": 3,
  "stats": [
    {
      "indicator_id": 1,
      "indicator_name": "S&P500",
      "max_drawdown_pct": -48.2,
      "max_gain_pct": 5.3,
      "days_to_bottom": 180,
      "recovery_days": 590
    }
  ]
}
```

---

## GET /api/crisis/compare

복수 이벤트 비교 차트 데이터. 이벤트 발생일 기준 상대 변화율로 정렬. (FR-009, P3)
커스텀 시작일 지원 (FR-012).

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `event_ids` | string | YES | 콤마 구분 이벤트 ID (최대 3개, 예: `3,16`) |
| `indicator_id` | integer | YES | 비교할 단일 지표 ID |
| `days` | integer | NO | 비교 기간 일수, default 90 (최대 180) |
| `custom_start_date` | string | NO | ISO 날짜 (커스텀 기준선, 예: `2025-06-01`). 이 경우 event_ids에 `custom` 포함 |

**Response 200**:
```json
{
  "indicator": { "id": 1, "name": "S&P500", "unit": "index" },
  "series": [
    {
      "event_id": 3,
      "event_name": "1973 오일쇼크",
      "color": "#EF4444",
      "data_points": [
        { "day_offset": 0, "change_pct": 0.0 },
        { "day_offset": 30, "change_pct": -15.3 },
        { "day_offset": 90, "change_pct": -34.2 }
      ]
    },
    {
      "event_id": "custom",
      "event_name": "현재 (2025-06-01~)",
      "color": "#60A5FA",
      "is_ongoing": true,
      "data_points": [
        { "day_offset": 0, "change_pct": 0.0 },
        { "day_offset": 30, "change_pct": -8.1 }
      ]
    }
  ]
}
```

**Error 400**: `{ "detail": "최대 3개 이벤트까지 선택 가능합니다" }` (이벤트 4개 이상 시)

---

## 에러 응답 공통 포맷

```json
{ "detail": "오류 메시지" }
```

HTTP 상태코드: 200 (성공), 400 (잘못된 파라미터), 404 (리소스 없음), 503 (데이터 로딩 실패)
