# Data Model: 위기 이벤트 시장 지표 히스토리

**Branch**: `012-crisis-indicator-history` | **Date**: 2026-04-02

## Overview

기존 SQLite WAL DB(`backend/data/ubb_pro.db`)에 4개 신규 테이블을 추가. 기존 테이블 스키마 변경 없음.

---

## Entities

### 1. crisis_event

위기 이벤트 마스터 데이터. 초기 15~20개 정적 레코드로 시드, 운영자가 유지.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER PK | NO | Auto-increment |
| `name` | TEXT | NO | 이벤트 이름 (예: "2008 글로벌 금융위기") |
| `event_type` | TEXT | NO | ENUM: `war`, `pandemic`, `financial_crisis`, `natural_disaster` |
| `start_date` | DATE | NO | 이벤트 공식 시작일 (Day 0 기준) |
| `end_date` | DATE | YES | 종료일. NULL = 진행 중 |
| `is_ongoing` | BOOLEAN | NO | Default: false. 현재 진행 중 이벤트 여부 |
| `description` | TEXT | NO | 발생 배경·경제 영향 요약 (500자 내외) |
| `severity_level` | TEXT | NO | ENUM: `low`, `moderate`, `high`, `critical` |
| `best_comparison_event_id` | INTEGER FK | YES | 이 이벤트와 비교할 과거 이벤트 ID. NULL이면 카테고리 폴백 사용 |
| `created_at` | DATETIME | NO | 레코드 생성 시각 |

**Constraints**:
- `best_comparison_event_id` → `crisis_event(id)`, self-referential FK
- `is_ongoing=true`인 레코드의 `end_date`는 NULL
- `is_ongoing=false`인 레코드의 `best_comparison_event_id`는 항상 NULL (과거 이벤트는 비교 대상이지 기준이 아님)

**Seed data (최소)**:
```
진행중: 이란-미국 갈등 (2025-06~, war, is_ongoing=true, best_comparison_event_id → 1973 ID)
과거: 1973 오일쇼크, 2008 금융위기, COVID-19 팬데믹, 러-우 전쟁, 9/11 테러,
      닷컴버블, 1987 블랙먼데이, 1997 아시아금융위기, 2011 유럽재정위기,
      2020 코로나 폭락, 걸프전(1990), 한국전쟁(1950), 스페인독감(1918),
      브렉시트(2016), 실리콘밸리은행 사태(2023)
```

---

### 2. market_indicator

시장 지표 마스터. 정적 8개 레코드.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER PK | NO | Auto-increment |
| `name` | TEXT | NO | 지표명 (예: "S&P500") |
| `category` | TEXT | NO | ENUM: `equity`, `bond`, `commodity`, `fx` |
| `ticker` | TEXT | NO | yfinance 티커 (예: `^GSPC`) |
| `unit` | TEXT | NO | 단위 (예: `index`, `%`, `USD/bbl`, `USD/KRW`) |
| `earliest_date` | DATE | NO | 실제 데이터 시작일 (티커별 상이) |

**Seed data**:
| id | name | category | ticker | unit | earliest_date |
|----|------|----------|--------|------|---------------|
| 1 | S&P500 | equity | ^GSPC | index | 1950-01-03 |
| 2 | 코스피 | equity | ^KS11 | index | 1996-12-11 |
| 3 | 나스닥 | equity | ^IXIC | index | 1971-02-05 |
| 4 | 금(현물) | commodity | GC=F | USD/oz | 2000-08-30 |
| 5 | WTI 원유 | commodity | CL=F | USD/bbl | 2000-08-23 |
| 6 | 달러인덱스(DXY) | fx | DX-Y.NYB | index | 1971-01-04 |
| 7 | 미국채10년금리 | bond | ^TNX | % | 1962-01-02 |
| 8 | 원/달러 환율 | fx | KRW=X | USD/KRW | 2003-12-01 |

---

### 3. indicator_data_point

이벤트별 지표 일별 데이터. 이벤트 start_date 기준 ±180일.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER PK | NO | Auto-increment |
| `event_id` | INTEGER FK | NO | → crisis_event(id) |
| `indicator_id` | INTEGER FK | NO | → market_indicator(id) |
| `date` | DATE | NO | 데이터 날짜 |
| `value` | REAL | YES | 실제 지표값. NULL = 데이터 없음 (휴장일·미존재) |
| `change_pct_from_event_start` | REAL | YES | 이벤트 발생일 대비 변화율 %. NULL = 기준 데이터 없음 |

**Constraints**:
- UNIQUE(event_id, indicator_id, date)
- 휴장일(주말·공휴일)은 이전 영업일 값으로 채움 (forward fill)
- 지표 데이터가 이벤트 시작 이전에 존재하지 않는 경우 (예: KOSPI, 1973년) value=NULL

**Index**: (event_id, indicator_id, date) — 비교 차트 조회 쿼리 최적화

---

### 4. event_indicator_stats

이벤트-지표별 요약 통계 (완료된 이벤트 또는 진행 중 이벤트의 현재까지 통계).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER PK | NO | Auto-increment |
| `event_id` | INTEGER FK | NO | → crisis_event(id) |
| `indicator_id` | INTEGER FK | NO | → market_indicator(id) |
| `max_drawdown_pct` | REAL | YES | 최대 낙폭 (음수, 예: -34.2) |
| `max_gain_pct` | REAL | YES | 최대 상승폭 (양수, 예: 18.5) |
| `days_to_bottom` | INTEGER | YES | 발생일부터 최저점까지 일수 |
| `recovery_days` | INTEGER | YES | 최저점에서 원금 회복까지 일수. NULL = 미회복 |
| `updated_at` | DATETIME | NO | 마지막 통계 갱신 시각 |

**Constraints**:
- UNIQUE(event_id, indicator_id)
- 진행 중 이벤트는 매일 업데이트, 완료 이벤트는 1회 계산 후 고정

---

## Entity Relationships

```
crisis_event (1) ──────────────── (N) indicator_data_point
     │                                        │
     │ best_comparison_event_id (self FK)     │
     └────────────────────────────────────    │
                                              │
market_indicator (1) ─────────────────────── ┘
     │
     └── (1) ─── (N) event_indicator_stats
                          │
               crisis_event (1) ─────────────┘
```

---

## Alembic Migration

새 마이그레이션 파일 1개:
- `backend/alembic/versions/xxxx_add_crisis_event_tables.py`
- 4개 테이블 생성 + 인덱스 + 시드 데이터 삽입

---

## 데이터 적재 전략

1. **초기 적재** (Alembic 마이그레이션 시 또는 별도 스크립트):
   - `crisis_event` 시드 15~20개
   - `market_indicator` 시드 8개
   - 각 이벤트의 `indicator_data_point` 계산 (yfinance `period='max'` 조회)
   - `event_indicator_stats` 계산

2. **일별 갱신** (APScheduler, 새벽 2시 KST):
   - `is_ongoing=true` 이벤트만 대상
   - 최신 영업일 데이터 추가
   - `event_indicator_stats` 재계산

3. **커스텀 시작일 비교** (요청 시 동적 계산):
   - DB에 저장하지 않음
   - 요청 시 yfinance로 해당 기간 데이터 조회 → 응답에 포함
   - 캐시 키: `custom_{start_date}_{indicator_id}`로 메모리 캐시 (TTL 1시간)
