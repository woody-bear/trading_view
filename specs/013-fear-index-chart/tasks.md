# Tasks: 공포지수 차트 개선

**Input**: Design documents from `/specs/013-fear-index-chart/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US]**: Which user story this task belongs to

---

## Phase 1: Setup

**Purpose**: 기존 인프라 확인 (신규 프로젝트 초기화 불필요)

- [X] T001 lightweight-charts v5 및 yfinance가 기존 의존성에 포함된 것 확인 — frontend/package.json, backend/requirements.txt

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 유저 스토리가 의존하는 백엔드 API 변경 — US1·US2·US3 모두 이 API를 사용

**⚠️ CRITICAL**: Phase 2 완료 전에는 프론트엔드 작업 시작 불가

- [X] T002 `GET /api/sentiment/history` 라우터에 `days: int = 30` 쿼리 파라미터 추가 — backend/routes/sentiment.py (기존 hardcode 30 → 파라미터로 교체, 하위 호환 유지)
- [X] T003 `get_vix_history_raw(days: int = 365) -> dict` 신규 비동기 함수 추가 — backend/services/sentiment_analyzer.py (기존 `_fetch_vix_history()` 함수를 래핑, `{"dates": [...], "values": [...], "updated_at": ...}` 반환)
- [X] T004 `GET /api/sentiment/vix-history` 신규 엔드포인트 추가 — backend/routes/sentiment.py (`days: int = 365` 파라미터, T003 함수 호출)

**Checkpoint**: `curl localhost:8000/api/sentiment/history?days=90` 및 `curl localhost:8000/api/sentiment/vix-history?days=365` 정상 응답 확인

---

## Phase 3: User Story 1 — 공포지수 히스토리 차트 (Priority: P1) 🎯 MVP

**Goal**: Fear & Greed Index를 1개월/3개월/1년 기간 탭으로 선택해서 lightweight-charts 기반 라인 차트로 표시, hover/touch 시 툴팁 표시

**Independent Test**: 기간 탭 클릭 → 해당 기간 차트 1초 이내 전환, 마우스 오버 시 날짜·수치 툴팁 확인

### Implementation for User Story 1

- [X] T005 [P] [US1] `fetchSentimentHistory(days: number)` 시그니처 변경 + `fetchVIXHistory(days: number)` 함수 추가 — frontend/src/api/client.ts (파라미터 없는 기존 호출을 `days=30` 기본값으로 하위 호환)
- [X] T006 [US1] SentimentPanel에 `selectedDays: 30 | 90 | 365` 상태 추가 및 React Query queryKey를 `['sentiment-history', selectedDays]`로 변경 — frontend/src/components/SentimentPanel.tsx (T005 완료 후)
- [X] T007 [US1] `FearGreedChart` 서브컴포넌트 구현 — frontend/src/components/SentimentPanel.tsx
  - `createChart` + `LineSeries` (lightweight-charts v5 tree-shaking API 사용)
  - priceScale: `minValue: 0, maxValue: 100` 고정 (Y축 0~100 강제)
  - crosshairMode: Magnet, `subscribeCrosshairMove`로 커스텀 툴팁(날짜 + "공포 28" 형식)
  - `useEffect` cleanup으로 chart.remove() 호출
  - `touch-action: pan-y` 적용 (모바일 스크롤 비충돌)
- [X] T008 [US1] 기존 `MiniTrendChart` SVG를 `FearGreedChart` lightweight-charts 컴포넌트로 교체 + 기간 탭 UI 렌더링 — frontend/src/components/SentimentPanel.tsx
  - 탭: `[{ label: '1개월', days: 30 }, { label: '3개월', days: 90 }, { label: '1년', days: 365 }]`
  - 선택 탭 스타일: `text-[var(--gold)] border-b border-[var(--gold)]`
  - 차트 높이: `h-48` (모바일), `h-56` (PC)

**Checkpoint**: 기간 탭 3개 표시 + 탭 전환 시 해당 기간 라인 차트 표시 + hover 툴팁 동작 확인

---

## Phase 4: User Story 2 — 공포·탐욕 구간 색상 시각화 (Priority: P2)

**Goal**: Fear & Greed 차트 배경에 공포(0~25 빨강) / 중립(25~75 회색) / 탐욕(75~100 초록) 구간 색상 오버레이 표시

**Independent Test**: 차트 배경에 3개 색상 구간 밴드가 Y축 고정(0-100) 기준으로 정확히 나뉘어 표시됨

### Implementation for User Story 2

- [X] T009 [US2] `FearGreedChart` 컨테이너에 CSS absolute position 색상 밴드 오버레이 추가 — frontend/src/components/SentimentPanel.tsx
  - 컨테이너: `position: relative; overflow: hidden`
  - 빨강 밴드: `position: absolute; bottom: 0; height: 25%; background: rgba(239,68,68,0.07); pointer-events: none; z-index: 0`
  - 회색 밴드: `position: absolute; bottom: 25%; height: 50%; background: rgba(100,116,139,0.04); pointer-events: none; z-index: 0`
  - 초록 밴드: `position: absolute; top: 0; height: 25%; background: rgba(34,197,94,0.07); pointer-events: none; z-index: 0`
  - 차트 div: `position: relative; z-index: 1`
- [X] T010 [US2] `FearGreedGauge` 컴포넌트에서 점수 ≤ 20일 때 수치 텍스트·레이블이 빨간색으로 표시되는지 확인 및 필요 시 수정 — frontend/src/components/SentimentPanel.tsx (기존 `getColor()` 로직 검토, SVG text fill 색상 확인)

**Checkpoint**: 차트 배경에 3색 구간 표시, 극도 공포 시 게이지 수치 빨간색 확인

---

## Phase 5: User Story 3 — VIX 단독 확장 차트 (Priority: P3)

**Goal**: VIX 미니카드 클릭 시 VIX 히스토리 차트가 패널 내에 펼쳐지며 VIX 20·30 수평 점선 기준선과 >30 구간 빨간 음영 표시

**Independent Test**: VIX 미니카드 클릭 → 차트 확장, VIX 20·30 점선 표시, 다시 클릭 → 차트 축소

### Implementation for User Story 3

- [X] T011 [US3] `vixExpanded: boolean` 상태 추가 + VIX 미니카드 `onClick` 핸들러를 기존 차트 이동 → VIX 확장 토글로 변경 — frontend/src/components/SentimentPanel.tsx (기존 `handleIndexClick('VIX')` 분기 처리)
- [X] T012 [US3] `VIXExpandChart` 서브컴포넌트 구현 — frontend/src/components/SentimentPanel.tsx
  - `fetchVIXHistory(selectedDays)` 조회 (queryKey: `['vix-history', selectedDays]`)
  - `LineSeries` (VIX 라인, color: `#60a5fa`)
  - `HistogramSeries` (VIX > 30인 봉만 `color: rgba(239,68,68,0.3)`, 나머지 투명)
  - `touch-action: pan-y`
- [X] T013 [US3] VIX 기준선 추가 — frontend/src/components/SentimentPanel.tsx
  - `lineSeries.createPriceLine({ price: 20, color: '#f97316', lineStyle: 1, lineWidth: 1, axisLabelVisible: true, title: 'VIX 20' })`
  - `lineSeries.createPriceLine({ price: 30, color: '#ef4444', lineStyle: 1, lineWidth: 1, axisLabelVisible: true, title: 'VIX 30' })`
  - `lineStyle: 1` = Dashed (lightweight-charts LineStyle enum)
- [X] T014 [US3] `VIXExpandChart`를 `vixExpanded` 상태에 따라 조건부 렌더링 + 카드 클릭 시 "확장됨" 시각 피드백(테두리 강조) 추가 — frontend/src/components/SentimentPanel.tsx

**Checkpoint**: VIX 카드 클릭 → 차트 펼침, 20·30 점선 확인, >30 구간 음영 확인, 재클릭 → 축소 확인

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 상태 유지 검증, 코드 정리, quickstart 검증

- [X] T015 `refetchInterval: 300000` 설정 상태에서 `selectedDays`·`vixExpanded` 상태가 refetch 후에도 유지되는 것 확인 — frontend/src/components/SentimentPanel.tsx (React Query devtools로 강제 refetch 후 탭 상태 확인)
- [X] T016 [P] 데이터 없음(빈 배열) 케이스 처리 — FearGreedChart와 VIXExpandChart 모두 `dates.length === 0`일 때 "데이터 없음" 텍스트 표시 — frontend/src/components/SentimentPanel.tsx
- [X] T017 quickstart.md 4개 시나리오 수동 검증 + CLAUDE.md Active Technologies 섹션 업데이트

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작 가능
- **Foundational (Phase 2)**: Phase 1 완료 후 — **모든 US 블로킹**
- **US1 (Phase 3)**: Phase 2 완료 필수, T005 → T006 → T007 → T008 순서
- **US2 (Phase 4)**: T007·T008 완료 후 (FearGreedChart 컴포넌트 존재해야 오버레이 추가 가능)
- **US3 (Phase 5)**: Phase 2 완료 필수 (T005도 필요), T011 → T012 → T013 → T014 순서
- **Polish (Phase 6)**: Phase 3~5 완료 후

### User Story Dependencies

- **US1 (P1)**: Foundational 완료 후 독립 시작 가능 — MVP
- **US2 (P2)**: US1의 `FearGreedChart` 컴포넌트(T007·T008) 완료 후 시작
- **US3 (P3)**: Foundational 완료 후 US1과 병렬 진행 가능 (T005 공유)

### Within Each User Story

- T005 (API 클라이언트) → T006 (상태 추가) → T007 (차트 컴포넌트) → T008 (교체 및 탭 UI)
- T011 (토글 상태) → T012 (VIX 차트) → T013 (기준선) → T014 (조건부 렌더링)

### Parallel Opportunities

- T002·T003: 다른 함수 추가이므로 병렬 가능 (T004는 T003 완료 후)
- T005: 백엔드 완료 후 프론트엔드와 독립 파일이므로 T006·T011과 병렬 가능
- T009·T010: 독립적 (같은 파일이나 다른 컴포넌트) — 순차 권장

---

## Parallel Example: Phase 2 (Foundational)

```
T002: sentiment history 라우터 파라미터 추가
T003: sentiment_analyzer에 get_vix_history_raw 추가  ← 동시 실행 가능
```

## Parallel Example: US3 시작 조건

```
# T005 완료 후 US1과 US3 병렬 시작 가능
US1: T006 → T007 → T008 (FearGreedChart 구현)
US3: T011 → T012 → T013 → T014 (VIXExpandChart 구현)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 완료 (T001)
2. Phase 2 완료 (T002~T004) — **백엔드 API 준비**
3. Phase 3 완료 (T005~T008) — **기간 탭 + lightweight-charts 차트 + 툴팁**
4. **STOP and VALIDATE**: `http://localhost:3000` 에서 기간 탭 전환 + 툴팁 확인
5. MVP 배포 가능

### Incremental Delivery

1. Phase 1~2 완료 → 백엔드 API 준비
2. Phase 3 완료 → 기간 탭 차트 (MVP)
3. Phase 4 완료 → 색상 구간 배경 추가
4. Phase 5 완료 → VIX 확장 차트 추가
5. Phase 6 완료 → 품질 검증

---

## Notes

- `lineStyle: 1` = `LineStyle.Dashed` in lightweight-charts v5
- lightweight-charts v5는 tree-shaking API: `import { createChart, LineSeries, HistogramSeries } from 'lightweight-charts'`
- `priceScale().applyOptions({ minValue: 0, maxValue: 100 })` 또는 `autoscaleInfoProvider`로 Y축 고정
- 기존 `MiniTrendChart` SVG 컴포넌트는 `FearGreedChart`로 교체 시 삭제
- VIX 미니카드의 기존 `handleIndexClick` 로직: `'VIX'` 클릭 시 차트 페이지 이동 → `vixExpanded` 토글로 변경 (다른 4개 지표는 기존 동작 유지)
