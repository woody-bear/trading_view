# Quickstart & Test Scenarios: 위기 이벤트 시장 지표 히스토리

**Branch**: `012-crisis-indicator-history` | **Date**: 2026-04-02

## 핵심 통합 시나리오

### Scenario 1: 페이지 진입 → 자동 비교 차트 (P3 / SC-007)

```
1. GET /api/crisis/default-comparison
   → { current_event: {이란-미국갈등}, comparison_event: {1973오일쇼크}, match_type: "curated" }

2. GET /api/crisis/compare?event_ids=16,3&indicator_id=1&days=90
   → { series: [ {이란-미국, data_points: [...]}, {1973오일쇼크, data_points: [...]} ] }

3. 차트 렌더링 — 두 이벤트의 S&P500 변화율이 Day 0 기준으로 정렬되어 표시
4. 이란-미국 갈등 라인은 현재 날짜까지만 (현재 날짜 이후 데이터 없음)
```

**검증**: 3초 이내 차트 렌더링, 이벤트 발생일 수직선 표시, 색상 구분

---

### Scenario 2: 이벤트 선택 → 개별 지표 차트 (P1 / SC-001)

```
1. GET /api/crisis/events?type=financial_crisis
   → [2008 금융위기, 2011 유럽재정위기, 닷컴버블, ...]

2. 사용자가 "2008 글로벌 금융위기" 선택
   GET /api/crisis/events/1/indicators?days_before=30&days_after=180
   → 8개 지표 각각의 일별 데이터

3. 차트 표시:
   - S&P500: 리먼쇼크 -48.2% MDD
   - 금(GC=F): 안전자산 도피 + 상승
   - 원유(CL=F): 경기침체 기대감으로 급락
   - 미국채10년: 급락 (금리 하락)
```

**검증**: 8개 지표 모두 표시 (KOSPI, 금, 원유, 원/달러는 2000년 이후 완전 커버)

---

### Scenario 3: 커스텀 시작일 비교 (FR-012 / SC-008)

```
1. 사용자가 커스텀 시작일 입력: "2025-04-02" (미국 관세 전쟁 시작)
2. GET /api/crisis/compare?event_ids=custom,1&indicator_id=1&days=60&custom_start_date=2025-04-02
   → { series: [ {custom "현재(2025-04-02~)", data: [...]}, {2008금융위기, data: [...]} ] }
3. 2초 이내 응답, 두 이벤트의 S&P500 비교 차트 표시
```

**검증**: custom_start_date 파라미터 처리, SC-008 "2초 이내" 응답

---

### Scenario 4: 요약 통계 카드 (P2 / SC-006)

```
1. GET /api/crisis/events/1/stats (2008 금융위기)
   → S&P500: MDD -48.2%, 최저점 도달 180일, 회복 590일
2. 요약 카드 표시: "▼ 48.2% 최대 낙폭 | 590일 회복"
```

**검증**: stats 응답이 차트와 동일 화면에 표시 (SC-006)

---

### Scenario 5: 데이터 없음 케이스 (Edge Case)

```
1. GET /api/crisis/events/10/indicators (1973 오일쇼크, days_before=30)
   →  코스피: has_data=false, no_data_reason="1996년 이전 데이터 없음"
   →  S&P500: has_data=true, data_points=[...]
2. 차트에서 코스피는 "데이터 없음" 회색 메시지로 표시
3. 다른 지표는 정상 렌더링
```

---

### Scenario 6: 모바일 좌우 스와이프 (FR-010 / SC-004)

```
1. 모바일 화면, 상단 이벤트 칩 영역에서 좌우 스와이프
   → 이벤트 전환 (1973 오일쇼크 → 2008 금융위기)
2. 차트 영역에서 좌우 드래그
   → 타임라인 이동 (Day -30 ~ Day +90 탐색)
3. 두 제스처가 충돌하지 않음
```

**검증**: touch-action 구역 분리, 제스처 충돌 없음

---

## 프론트엔드 페이지 구조

```
/crisis                          ← 신규 라우트 (별도 탭/페이지)
├── CrisisPage.tsx               ← 진입점, default-comparison 자동 로드
├── CrisisEventList.tsx          ← 이벤트 목록 + 유형 필터
├── CrisisCompareChart.tsx       ← 비교 차트 (lightweight-charts 기반)
├── CrisisIndicatorChart.tsx     ← 개별 이벤트 지표 차트
├── CrisisStatCard.tsx           ← 요약 통계 카드 (MDD, 회복일 등)
└── CrisisCustomBaseline.tsx     ← 커스텀 시작일 입력 UI
```

## 백엔드 파일 구조

```
backend/
├── routers/
│   └── crisis.py                ← /api/crisis/* 엔드포인트
├── services/
│   └── crisis_service.py        ← 데이터 조회·통계 계산 로직
├── fetchers/
│   └── crisis_fetcher.py        ← yfinance period='max' 조회 + 캐시
├── models/
│   └── crisis_models.py         ← SQLAlchemy ORM 모델 4개
└── alembic/versions/
    └── xxxx_add_crisis_tables.py ← DB 마이그레이션
```
