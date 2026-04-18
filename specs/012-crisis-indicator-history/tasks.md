# Tasks: 위기 이벤트 시장 지표 히스토리

**Input**: Design documents from `specs/012-crisis-indicator-history/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are relative to `/Users/woody/workflow/trading_view/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 라우터 등록 및 진입점 연결 — 이후 모든 작업의 기반

- [X] T001 Register crisis router in backend/app.py (import crisis from routers, add `app.include_router(crisis.router, prefix="/api/crisis")`)
- [X] T002 Add /crisis route to frontend/src/App.tsx (import Crisis page, add `<Route path="/crisis" element={<Crisis />}/>`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB 모델, 마이그레이션, 데이터 fetcher — 모든 User Story 구현 전 완료 필수

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create SQLAlchemy async ORM models for all 4 entities in backend/models/crisis_models.py (CrisisEvent with is_ongoing+best_comparison_event_id self-FK, MarketIndicator with ticker+earliest_date, IndicatorDataPoint with event_id+indicator_id+date+value+change_pct_from_event_start+UNIQUE constraint, EventIndicatorStats with max_drawdown_pct+max_gain_pct+days_to_bottom+recovery_days)
- [X] T004 Create Alembic migration + seed data in backend/alembic/versions/xxxx_add_crisis_tables.py (4 tables + indices on (event_id, indicator_id, date) + seed 8 MarketIndicator rows with tickers/earliest_dates per data-model.md)
- [X] T005 Create backend/fetchers/crisis_fetcher.py — yfinance downloader using `period='max'` (not `_yf_period()`), forward-fill holidays, compute change_pct_from_event_start relative to event start_date value, return as list of IndicatorDataPoint dicts
- [X] T006 Create backend/scripts/seed_crisis_data.py — seed 15+ CrisisEvent rows per data-model.md seed list (including is_ongoing=true for 이란-미국갈등 with best_comparison_event_id pointing to 1973 오일쇼크), run crisis_fetcher for each event, populate indicator_data_point + event_indicator_stats
- [X] T007 Add crisis API functions to frontend/src/api/client.ts (fetchCrisisEvents(type?), fetchCrisisEventIndicators(eventId, daysBefore, daysAfter, indicatorIds?), fetchCrisisEventStats(eventId), fetchCrisisDefaultComparison(), fetchCrisisCompare(eventIds, indicatorId, days?, customStartDate?))

**Checkpoint**: DB migrated, seed data loaded, API client functions ready — User Story phases can now begin

---

## Phase 3: User Story 1 — 이벤트 선택 및 지표 차트 (Priority: P1) 🎯 MVP

**Goal**: 이벤트 목록에서 선택 → 해당 이벤트의 주요 지표 차트 표시 (±30/90/180일, 이벤트 기준 수직선)

**Independent Test**: "2008 금융위기"를 선택하면 S&P500·KOSPI·금·달러인덱스의 이벤트 발생일 기준 전후 차트가 표시된다 (quickstart.md Scenario 2)

- [X] T008 [P] [US1] Implement get_events(event_type?) + get_event_indicators(event_id, days_before, days_after, indicator_ids?) in backend/services/crisis_service.py (query IndicatorDataPoint, return structured dict per contracts/api.md, has_data=false + no_data_reason when data missing)
- [X] T009 [US1] Implement GET /api/crisis/events and GET /api/crisis/events/{event_id}/indicators endpoints in backend/routers/crisis.py (query params: type, days_before default 30, days_after default 180, indicator_ids; call crisis_service; return 404 if event not found)
- [X] T010 [P] [US1] Create frontend/src/components/crisis/CrisisEventList.tsx — scrollable list of crisis events, each card shows name/type badge/severity/is_ongoing badge, onClick selects event, no filter UI yet (added in US2)
- [X] T011 [US1] Create frontend/src/components/crisis/CrisisIndicatorChart.tsx — lightweight-charts LineChart, renders one line per indicator with change_pct_from_event_start on Y-axis, vertical line marker at day_offset=0, period selector buttons (±30d/±90d/±180d), indicator category tabs (주식/채권/원자재/환율), shows "데이터 없음" grey placeholder when has_data=false
- [X] T012 [US1] Create frontend/src/pages/Crisis.tsx — initial P1 layout: CrisisEventList on left (PC) or top (mobile), CrisisIndicatorChart on right/below, fetch indicator data on event selection, loading skeleton while fetching

**Checkpoint**: User Story 1 fully functional — event selection → chart renders within 3 seconds (SC-001)

---

## Phase 4: User Story 2 — 필터링 및 요약 통계 (Priority: P2)

**Goal**: 유형 필터로 이벤트 목록 좁히기 + 이벤트별 MDD·회복일 요약 통계 카드 표시

**Independent Test**: "전쟁" 필터 선택 시 전쟁 이벤트만 표시, 이벤트 선택 시 S&P500 MDD(-X%)와 회복일 카드 표시 (quickstart.md Scenario 4)

- [X] T013 [P] [US2] Implement get_event_stats(event_id) in backend/services/crisis_service.py (query EventIndicatorStats, compute max_drawdown_pct/max_gain_pct/days_to_bottom/recovery_days per indicator, return per contracts/api.md)
- [X] T014 [US2] Implement GET /api/crisis/events/{event_id}/stats endpoint in backend/routers/crisis.py (call crisis_service.get_event_stats, 404 if event not found)
- [X] T015 [P] [US2] Create frontend/src/components/crisis/CrisisStatCard.tsx — card showing indicator name + MDD (red) + max gain (green) + 회복일 (days), null-safe (shows "—" when recovery_days is null i.e. not yet recovered)
- [X] T016 [US2] Add type filter chips (전체/전쟁/팬데믹/금융위기/자연재해) to frontend/src/components/crisis/CrisisEventList.tsx (filter state in component, pass type param to fetchCrisisEvents), add CrisisStatCard row below CrisisIndicatorChart in Crisis.tsx

**Checkpoint**: User Story 2 functional — filter + stats card visible on same screen as chart (SC-006)

---

## Phase 5: User Story 3 — 현재 vs 과거 비교 차트 (Priority: P3)

**Goal**: 진입 즉시 자동 비교 차트 표시 (현재 진행중 vs 과거 유사), 좌우 스와이프로 모바일 조작, 커스텀 시작일 입력 지원

**Independent Test**: 페이지 진입 시 3초 내 이란-미국갈등 vs 1973 오일쇼크 비교 차트 자동 표시, 차트 드래그 탐색 동작 (quickstart.md Scenario 1)

- [X] T017 [P] [US3] Implement get_default_comparison() + compare_events(event_ids, indicator_id, days, custom_start_date?) in backend/services/crisis_service.py (get_default_comparison: query is_ongoing=true event → join best_comparison_event_id → fallback to same category; compare_events: fetch IndicatorDataPoint for each event_id aligned to day_offset, for custom_start_date use crisis_fetcher dynamically + in-memory cache 1hr)
- [X] T018 [US3] Implement GET /api/crisis/default-comparison and GET /api/crisis/compare endpoints in backend/routers/crisis.py (compare: validate max 3 event_ids → 400 if exceeded, call crisis_service, return series array per contracts/api.md)
- [X] T019 [P] [US3] Create frontend/src/components/crisis/CrisisCompareChart.tsx — lightweight-charts multi-line chart, each series is one event in distinct color, X-axis = day_offset (Day -30 to Day +90), Y-axis = change_pct (%), vertical line at day_offset=0, crosshair tooltip shows all series values at hover point, ongoing event line ends at latest available day
- [X] T020 [P] [US3] Create frontend/src/components/crisis/CrisisCustomBaseline.tsx — date input field + "비교 추가" button, validates date format and not future date, calls fetchCrisisCompare with custom_start_date, adds result as new series to compare chart
- [X] T021 [US3] Update frontend/src/pages/Crisis.tsx — on mount call fetchCrisisDefaultComparison() → auto-render CrisisCompareChart with result, add CrisisCustomBaseline below chart, event list stays for manual selection override
- [X] T022 [US3] Implement mobile swipe gesture zones in frontend/src/pages/Crisis.tsx — event selector header area: `touch-action: pan-y` (CSS, swipe left/right to switch selected event), chart container: `touch-action: manipulation` (lightweight-charts handles pan/drag), no JS velocity logic needed (zone-based per research.md)

**Checkpoint**: User Story 3 functional — auto comparison on load (SC-007), custom baseline <2s (SC-008), mobile swipe no conflicts (SC-004)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 데이터 자동 갱신, 에러 처리, 네비게이션 통합

- [X] T023 Add APScheduler daily job (02:00 KST) in backend/app.py — fetch latest data for is_ongoing=true events via crisis_fetcher, update indicator_data_point + event_indicator_stats (append new day, do not re-fetch historical)
- [X] T024 Add error/loading/empty states across all crisis components — loading skeleton on fetch, "데이터 없음" grey placeholder for missing indicators, retry button on 503 error (quickstart.md Scenario 5)
- [X] T025 Add Crisis menu item to mobile bottom tab bar (5th or replace existing) and desktop header nav in frontend/src/App.tsx (route: /crisis, icon: suitable SVG, label: "위기")

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 2; integrates with US1 components (T016 modifies Crisis.tsx)
- **US3 (Phase 5)**: Depends on Phase 2; integrates with US1+US2 (Crisis.tsx auto-load replaces manual entry)
- **Polish (Phase 6)**: Depends on all US phases

### User Story Dependencies

- **US1 (P1)**: Can start immediately after Foundational — no other story dependency
- **US2 (P2)**: Can start after Foundational — adds stats card + filter to US1 components (extend, not break)
- **US3 (P3)**: Can start after Foundational — replaces Crisis.tsx default view (builds on US1 chart components)

### Within Each User Story

- Backend service → Router endpoint → Frontend component → Page integration
- T008/T013/T017 (services) must complete before T009/T014/T018 (routers)
- T009/T014/T018 (routers) must complete before frontend components can be tested end-to-end
- Components marked [P] within a story can be built in parallel

### Parallel Opportunities

**Phase 2 — Backend + Frontend parallel**:
```
Task: T003 (ORM models)
Task: T007 (client.ts API functions — stubs OK)
```
```
Task: T004 (migration) — after T003
Task: T005 (fetcher) — after T003
Task: T006 (seed script) — after T004+T005
```

**Phase 3 — US1 parallel**:
```
Task: T008 (service) + T010 (EventList component) — parallel
→ T009 (router, after T008) + T011 (Chart component, after T010)
→ T012 (Crisis.tsx integration, after T009+T011)
```

**Phase 4 — US2 parallel**:
```
Task: T013 (stats service) + T015 (StatCard component) — parallel
→ T014 (stats router, after T013) + T016 (integration, after T015)
```

**Phase 5 — US3 parallel**:
```
Task: T017 (compare service) + T019 (CompareChart) + T020 (CustomBaseline) — parallel
→ T018 (compare router, after T017)
→ T021 (Crisis.tsx auto-load, after T018+T019+T020)
→ T022 (gesture zones, after T021)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundational (T003→T007) — run seed script, verify DB populated
3. Complete Phase 3: User Story 1 (T008→T012)
4. **STOP and VALIDATE**: Select "2008 금융위기" → S&P500 chart renders in <3 seconds
5. Deploy/demo if sufficient

### Incremental Delivery

1. Phase 1+2 → Foundation ready
2. Phase 3 (US1) → Event list + chart → **MVP demo**
3. Phase 4 (US2) → Add filter + stats cards → Enhanced demo
4. Phase 5 (US3) → Auto comparison + mobile swipe → Full feature
5. Phase 6 → Daily refresh + error states → Production ready

### Critical Path

`T003 → T004 → T005 → T006 → T008 → T009 → T012` (backend MVP)
`T007 → T010 → T011 → T012` (frontend US1)
`T017 → T018 → T021 → T022` (US3 auto-comparison)

---

## Notes

- **Data seed (T006)**: Initial fetch of 15+ events × 8 indicators × ±180 days takes ~10-11s per event → run as one-time script, not inline with migration
- **KOSPI/Gold/WTI for pre-2000 events** (1973, 1987 등): has_data=false expected — "데이터 없음" UI handles gracefully
- **커스텀 시작일 (T017)**: Dynamic fetch is cached in-memory 1hr — not persisted to DB
- **Gesture zones (T022)**: Pure CSS solution (touch-action), no custom JS gesture detection
- **is_ongoing event daily refresh (T023)**: Only appends new days, never re-fetches historical data
