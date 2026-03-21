# Tasks: 종목 상세화면 차트 오류 수정 및 사용성 개선

**Input**: Design documents from `/specs/002-fix-chart-usability/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested — test tasks are excluded.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/` (Python 3.12, FastAPI)
- **Frontend**: `frontend/src/` (React 18, TypeScript, Tailwind CSS)

---

## Phase 1: Setup

**Purpose**: Verify existing dev environment and create directories for new files

- [x] T001 Create `backend/utils/` directory and add empty `__init__.py` in `backend/utils/__init__.py`
- [x] T002 [P] Verify frontend dev server runs (`cd frontend && pnpm dev`) and backend runs (`cd backend && uvicorn app:app --reload --port 8000`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Toast system and chart UI primitives needed by multiple user stories

**⚠️ CRITICAL**: US1~US10 depend on these shared components

- [x] T003 [P] Create Zustand toast store with `addToast(type, message, duration?)` and `removeToast(id)` actions, max 3 simultaneous toasts, auto-remove after duration (default 3000ms) in `frontend/src/stores/toastStore.ts` (per contracts/toast-api.md)
- [x] T004 [P] Create Toast renderer component — renders toasts from `useToastStore`, positioned bottom-center above mobile tabbar, with success(green)/error(red)/info(blue) color coding and fade-in/fade-out animation in `frontend/src/components/ui/Toast.tsx`
- [x] T005 Mount `<Toast />` component at root level in `frontend/src/App.tsx` so toasts are globally visible
- [x] T006 [P] Create ChartSkeleton component — 3 blocks (h-[450px] + h-[110px] + h-[110px]) with bg-gray-800 animate-pulse, matching chart layout dimensions, in `frontend/src/components/charts/ChartSkeleton.tsx` (per contracts/chart-error-boundary.md)
- [x] T007 [P] Create ChartEmptyState component — accepts `status: 'empty'|'timeout'|'error'`, shows appropriate message and optional retry button, in `frontend/src/components/charts/ChartEmptyState.tsx` (per contracts/chart-error-boundary.md)
- [x] T008 [P] Create ChartErrorBoundary class component — wraps chart area (670px height), catches render errors, shows fallback UI with "차트를 표시할 수 없습니다" message and refresh button that resets boundary state, in `frontend/src/components/charts/ChartErrorBoundary.tsx` (per contracts/chart-error-boundary.md)

**Checkpoint**: Foundation ready — shared UI primitives available for all user stories

---

## Phase 3: User Story 7 — 마지막 일봉 이상값 방지 (Priority: P1) 🎯 MVP

**Goal**: yfinance 미완성 당일 캔들을 제거하고, 실시간 가격으로 당일 캔들을 정확하게 구성하여 마지막 일봉 급락/급등 문제 해결

**Independent Test**: 장중에 KR 종목(005930) 차트를 조회하여 마지막 캔들이 전일 종가 대비 비정상적 갭 없이 자연스럽게 이어지는지 확인

### Implementation for User Story 7

- [x] T009 [US7] Create market hours utility with `is_market_open(market)`, `get_last_complete_date(market)`, `is_candle_complete(candle_date, market)` — KR: 15:30 KST (Asia/Seoul), US: 16:00 ET (America/New_York with DST), CRYPTO: UTC 00:00 — using Python standard `zoneinfo` module, weekend handling (금→월), in `backend/utils/market_hours.py` (per contracts/chart-data-integrity.md)
- [x] T010 [US7] Add `_strip_incomplete_candle(df, market, timeframe)` function to `backend/services/chart_cache.py` — if last candle date is "today" and market is open, remove it from DataFrame before returning/caching
- [x] T011 [US7] Replace UTC 20-hour freshness check with `_is_cache_fresh(last_ts, market)` using `get_last_complete_date(market)` in `backend/services/chart_cache.py` — last candle date >= last complete date means fresh
- [x] T012 [US7] Call `_strip_incomplete_candle()` in both cache-hit and cache-update paths of `get_chart_data()` in `backend/services/chart_cache.py`
- [x] T013 [US7] Add `market_open: bool` field to quick_chart API response by calling `is_market_open(market)` in `backend/routes/quick_chart.py`
- [x] T014 [US7] Update IndicatorChart SSE real-time price handler (useEffect at line ~229) to preserve original candle `open` value — only update `high = Math.max(lc.high, price)`, `low = Math.min(lc.low, price)`, `close = price` in `frontend/src/components/charts/IndicatorChart.tsx`
- [x] T015 [US7] Update IndicatorChart to handle `market_open=true`: when chart data has `market_open` flag and `realtimePrice` is available, create a new today candle with `open=close=high=low=realtimePrice.price` appended to candle data, then update via SSE. If `market_open=true` but `realtimePrice` is not yet received, show only completed candles without creating an empty today candle in `frontend/src/components/charts/IndicatorChart.tsx`

**Checkpoint**: 마지막 일봉이 정확하게 표시됨 — 장중 미완성 캔들 제거, 실시간 당일 캔들 구성

---

## Phase 4: User Story 1 — 차트 데이터 없을 때 명확한 안내 (Priority: P1)

**Goal**: 빈 캔들 배열 반환 시 안내 메시지 표시, 10초 타임아웃 시 재시도 버튼

**Independent Test**: `http://localhost:3000/INVALID123` 접근 시 "차트 데이터가 없습니다" 안내 메시지 확인

### Implementation for User Story 1

- [x] T016 [US1] Update SignalDetail page to check `data.candles.length === 0` after chart query resolves — show `<ChartEmptyState status="empty" />` instead of IndicatorChart in `frontend/src/pages/SignalDetail.tsx`
- [x] T017 [US1] Add 10-second timeout to chart data query using React Query's `signal` + AbortController — on timeout show `<ChartEmptyState status="timeout" onRetry={refetch} />` in `frontend/src/pages/SignalDetail.tsx`
- [x] T018 [US1] Add chart query error handling — on fetch error show `<ChartEmptyState status="error" onRetry={refetch} />` in `frontend/src/pages/SignalDetail.tsx`

**Checkpoint**: 빈/에러/타임아웃 차트 상태에서 명확한 안내 메시지 표시

---

## Phase 5: User Story 2 — 차트 로딩 중 부분 콘텐츠 표시 (Priority: P1)

**Goal**: 차트 로딩 중 종목 정보를 먼저 보여주고 차트 영역만 스켈레톤 UI 표시

**Independent Test**: Chrome DevTools Slow 3G에서 상세화면 진입 시 종목 정보가 차트보다 먼저 표시되는지 확인

### Implementation for User Story 2

- [x] T019 [US2] Restructure SignalDetail page to show header section (종목명, 현재가, 신호 상태, 지표 게이지) independently of chart data — move signal data display above chart, remove full-page loading block in `frontend/src/pages/SignalDetail.tsx`
- [x] T020 [US2] Show `<ChartSkeleton />` while chart data query `isLoading=true`, transition to actual IndicatorChart with opacity animation when data arrives in `frontend/src/pages/SignalDetail.tsx`

**Checkpoint**: 종목 기본 정보가 1초 이내 표시, 차트는 스켈레톤 → 실제 차트 부드러운 전환

---

## Phase 6: User Story 3 — API 실패 시 사용자 피드백 (Priority: P2)

**Goal**: 민감도 변경, 관심종목 추가 등 성공/실패 시 토스트 메시지 제공

**Independent Test**: 백엔드 중지 상태에서 민감도 변경 시 에러 토스트 확인

### Implementation for User Story 3

- [x] T021 [US3] Add toast feedback to sensitivity change handler — `addToast('success', '민감도가 변경되었습니다')` on success, `addToast('error', '설정 변경에 실패했습니다')` in catch block (currently empty) in `frontend/src/pages/SignalDetail.tsx`
- [x] T022 [US3] Add toast feedback to watchlist add handler — `addToast('success', '관심종목에 추가되었습니다')` on success, `addToast('info', '이미 등록된 종목입니다')` on 409, `addToast('error', '추가에 실패했습니다')` on other errors in `frontend/src/pages/SignalDetail.tsx`
- [x] T023 [US3] Add toast feedback to watchlist delete handler (if exists in Dashboard) — success/error messages in relevant page components

**Checkpoint**: 모든 사용자 액션에 2초 이내 성공/실패 토스트 피드백

---

## Phase 7: User Story 4 — 실시간 연결 상태 가시성 (Priority: P2)

**Goal**: SSE 연결 상태를 connected/reconnecting/disconnected 3단계로 시각적 표시

**Independent Test**: 네트워크 차단 후 인디케이터가 황색 "재연결 중..." → 적색 "연결 끊김" + 재연결 버튼으로 전환 확인

### Implementation for User Story 4

- [x] T024 [US4] Extend `useRealtimePrice` hook to return `connectionStatus: 'connected'|'reconnecting'|'disconnected'` alongside existing `connected: boolean` (backward compatible) — use EventSource `readyState` (CONNECTING=0→reconnecting, OPEN=1→connected, CLOSED=2→disconnected), add reconnect failure detection after 3 consecutive errors (~30초), and add `reconnect()` function that closes current EventSource and creates new one. Ensure cleanup on unmount: `es.close()` in useEffect return (FR-008 SSE cleanup) in `frontend/src/hooks/useRealtimePrice.ts` (per contracts/connection-indicator.md)
- [x] T025 [P] [US4] Create ConnectionIndicator component — green "실시간" / yellow "재연결 중..." / red "연결 끊김" + 재연결 button, accepts `status` and `onReconnect` props in `frontend/src/components/ui/ConnectionIndicator.tsx` (per contracts/connection-indicator.md)
- [x] T026 [US4] Integrate ConnectionIndicator into SignalDetail page — replace existing green "실시간" badge with `<ConnectionIndicator status={connectionStatus} onReconnect={reconnect} />`, add manual reconnect function that closes and reopens EventSource in `frontend/src/pages/SignalDetail.tsx`

**Checkpoint**: SSE 연결 끊김 시 3초 이내 상태 전환, 수동 재연결 가능

---

## Phase 8: User Story 5 — 차트 시그널 마커 렌더링 안정성 (Priority: P2)

**Goal**: 마커 렌더링 실패 시 차트 본체는 정상 표시, 마커 미표시 안내 제공

**Independent Test**: markers에 잘못된 time 값 주입 후 차트 정상, "시그널 마커를 표시할 수 없습니다" 경고 확인

### Implementation for User Story 5

- [x] T027 [US5] Wrap `createSeriesMarkers()` call in try-catch in IndicatorChart — on failure, set `markerWarning=true` state flag instead of crashing, log error to console in `frontend/src/components/charts/IndicatorChart.tsx`
- [x] T028 [US5] Add marker warning UI — when `markerWarning=true`, show small yellow banner below chart: "시그널 마커를 표시할 수 없습니다" in `frontend/src/components/charts/IndicatorChart.tsx`

**Checkpoint**: 마커 오류 시 차트 정상, 경고 배너 표시

---

## Phase 9: User Story 8 — 캐시 신선도 시간대 인식 (Priority: P2)

**Goal**: 시장별 장 마감 기준으로 캐시 freshness 판단하여 불필요한 재다운로드 방지

**Independent Test**: KR 장 마감(15:30 KST) 후 조회 → 캐시 fresh, 다음 영업일 09:00 KST 조회 → 캐시 stale

### Implementation for User Story 8

- [x] T029 [US8] (Already implemented in T009~T012 as part of US7) Verify market_hours utility covers weekend/holiday edge cases — test KR Friday 15:30 → fresh until Monday 09:00, CRYPTO fresh until next UTC 00:00, in `backend/utils/market_hours.py`

**Checkpoint**: 장 마감 후 캐시가 다음 영업일까지 유효 유지 (US7의 T009~T012에서 대부분 구현 완료)

---

## Phase 10: User Story 6 — 차트 컴포넌트 에러 격리 (Priority: P3)

**Goal**: 차트 런타임 오류가 전체 페이지를 크래시시키지 않고 차트 영역만 에러 상태로 표시

**Independent Test**: IndicatorChart에 의도적 throw 추가 → 차트만 에러, 나머지 정상

### Implementation for User Story 6

- [x] T030 [US6] Wrap IndicatorChart (and RSI/MACD subcharts) with `<ChartErrorBoundary>` in SignalDetail page — on error show fallback UI with "차트를 표시할 수 없습니다. 새로고침해 주세요." and refresh button that resets ErrorBoundary, in `frontend/src/pages/SignalDetail.tsx`

**Checkpoint**: 차트 에러 시 나머지 페이지(가격, 지표, 설정) 100% 정상 동작

---

## Phase 11: User Story 9 — BUY/SELL 마커 호버 색상 강조 (Priority: P3)

**Goal**: 크로스헤어가 BUY/SELL 마커 위치에 도달하면 색상을 강조색으로 변경

**Independent Test**: BUY 마커 위치에 크로스헤어 이동 → 색상이 `#22c55e` → `#4ade80`으로 변경, 벗어나면 복원

### Implementation for User Story 9

- [x] T031 [US9] Add `id` field to all markers in IndicatorChart — format `{position}-{time}` (e.g., `belowBar-1742515200`), store markers array with original colors in ref in `frontend/src/components/charts/IndicatorChart.tsx`
- [x] T032 [US9] Add `subscribeCrosshairMove()` handler — on `param.time` matching a marker's time, call `markersPlugin.setMarkers()` with highlighted color (BUY: `#4ade80`, SELL: `#f87171`); on no match, restore original colors. Gate with `window.matchMedia('(hover: hover)')` to disable on mobile in `frontend/src/components/charts/IndicatorChart.tsx` (per contracts/marker-interaction.md)

**Checkpoint**: PC에서 크로스헤어 이동 시 마커 색상 변경/복원, 모바일에서 비활성화

---

## Phase 12: User Story 10 — BUY 마커 클릭 매수지점 기록 (Priority: P3)

**Goal**: BUY 마커 클릭 시 매수 가격을 차트에 수평선+수익률 라벨로 시각화, localStorage에 영속 저장

**Independent Test**: BUY 마커 클릭 → 가격 수평선 표시, 새로고침 후 수평선 유지, 재클릭 시 삭제

### Implementation for User Story 10

- [x] T033 [P] [US10] Create `useBuyPoint(symbol)` hook — read/write localStorage key `buyPoints:{symbol}`, return `{ buyPoint, setBuyPoint, removeBuyPoint, toggleBuyPoint }`, JSON serialize/deserialize BuyPoint `{ symbol, price, date, markerTime }`. Handle localStorage unavailable (private browsing): fallback to React state (session-only), show info toast "매수지점이 이 세션에서만 유지됩니다" on fallback in `frontend/src/hooks/useBuyPoint.ts` (per contracts/marker-interaction.md)
- [x] T034 [US10] Add `subscribeClick()` handler in IndicatorChart — on click, find BUY marker matching `param.time`, call `toggleBuyPoint({ symbol, price: candle.close, date, markerTime })` from useBuyPoint hook. If same marker, remove; if different BUY marker, replace in `frontend/src/components/charts/IndicatorChart.tsx`
- [x] T035 [US10] Render buy point price line — when `buyPoint` exists, call `candleSeries.createPriceLine({ price, color: '#22c55e', lineWidth: 1, lineStyle: 2, title })` with market-aware currency formatting (KR: "매수 ₩{price}", US: "매수 ${price}", CRYPTO: "매수 ${price}") using existing `guessMarket` util, store ref for cleanup. On buyPoint removal, call `candleSeries.removePriceLine(ref)` in `frontend/src/components/charts/IndicatorChart.tsx`
- [x] T036 [US10] Update buy point profit label in real-time — useEffect on `realtimePrice` changes, recalculate `pct = ((currentPrice - buyPrice) / buyPrice * 100).toFixed(1)` with sign prefix (+/-), update priceLine title via `applyOptions({ title: '매수 ₩{price} (+{pct}%)' })` in `frontend/src/components/charts/IndicatorChart.tsx`

**Checkpoint**: BUY 클릭 → 수평선 + 수익률 표시, 새로고침 후 유지, 재클릭 삭제, 실시간 수익률 업데이트

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: 모바일 최적화, SSE cleanup, 전체 검증

- [x] T037 [US9] Add 200ms throttle to WebSocket `onPriceUpdate` handler in IndicatorChart — use requestAnimationFrame + timestamp check to limit `candleSeries.update()` calls to max 5/sec (per spec FR-009, SC-006 60fps target) in `frontend/src/components/charts/IndicatorChart.tsx`
- [x] T038 Implement and verify SSE cleanup on page navigation — ensure useRealtimePrice's EventSource `close()` is called on component unmount (FR-008), handle React StrictMode double-mount by tracking EventSource ref, abort pending EventSource on rapid symbol switching in `frontend/src/hooks/useRealtimePrice.ts`
- [x] T039 Run all quickstart.md test scenarios (15 items) — verify each scenario passes manually
- [x] T040 Code cleanup — remove unused imports, ensure consistent Korean/English comments, verify TypeScript types for new components

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US7 (Phase 3)**: Backend first, then frontend. HIGHEST PRIORITY — fixes core data accuracy bug
- **US1 (Phase 4)**: Depends on Foundational (ChartEmptyState from T007)
- **US2 (Phase 5)**: Depends on Foundational (ChartSkeleton from T006)
- **US3 (Phase 6)**: Depends on Foundational (Toast from T003~T005)
- **US4 (Phase 7)**: Independent of other stories
- **US5 (Phase 8)**: Independent of other stories
- **US8 (Phase 9)**: Depends on US7 (reuses market_hours.py from T009)
- **US6 (Phase 10)**: Depends on Foundational (ChartErrorBoundary from T008)
- **US9 (Phase 11)**: Depends on US5 (marker id infrastructure from T027)
- **US10 (Phase 12)**: Depends on US9 (marker id + click infrastructure)
- **Polish (Phase 13)**: Depends on all desired stories being complete

### User Story Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundational) → US7 (P1, 데이터 정확성)
                                          ↗ US1 (P1, 빈 차트 안내)
                                         ↗ US2 (P1, 스켈레톤)
                                        ↗ US3 (P2, 토스트)
                                       ↗ US4 (P2, 연결 상태)
                                      ↗ US5 (P2, 마커 안정성) → US9 (P3, 마커 호버) → US10 (P3, 매수지점)
                                     ↗ US8 (P2, 캐시 시간대) ← US7
                                    ↗ US6 (P3, 에러 격리)
```

### Parallel Opportunities

- **Phase 2**: T003, T004, T006, T007, T008 모두 다른 파일 → 병렬 가능
- **US7 백엔드**: T009(market_hours) 완료 후 T010~T013 순차
- **US1+US2+US3**: Phase 2 완료 후 병렬 가능 (모두 SignalDetail.tsx 수정이지만 다른 영역)
- **US4+US5**: 서로 독립적, 병렬 가능
- **US9+US10**: US9 → US10 순차 (마커 id 인프라 의존)

---

## Parallel Example: Foundational Phase

```bash
# 모든 기반 컴포넌트를 병렬로 생성:
Task: T003 "Create toast store in frontend/src/stores/toastStore.ts"
Task: T004 "Create Toast component in frontend/src/components/ui/Toast.tsx"
Task: T006 "Create ChartSkeleton in frontend/src/components/charts/ChartSkeleton.tsx"
Task: T007 "Create ChartEmptyState in frontend/src/components/charts/ChartEmptyState.tsx"
Task: T008 "Create ChartErrorBoundary in frontend/src/components/charts/ChartErrorBoundary.tsx"
```

## Parallel Example: After Foundational

```bash
# P1 스토리들을 병렬로 진행:
Developer/Agent A: US7 (T009~T015) — 백엔드 + 프론트엔드 차트 데이터 정확성
Developer/Agent B: US1 (T016~T018) + US2 (T019~T020) — 빈 차트 안내 + 스켈레톤
Developer/Agent C: US3 (T021~T023) + US4 (T024~T026) — 토스트 + 연결 상태
```

---

## Implementation Strategy

### MVP First (US7 + US1 + US2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US7 (마지막 일봉 정확성 — 핵심 버그 수정)
4. Complete Phase 4: US1 (빈 차트 안내)
5. Complete Phase 5: US2 (스켈레톤 로딩)
6. **STOP and VALIDATE**: P1 스토리 3개 독립 테스트
7. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → 기반 준비
2. US7 → 데이터 정확성 확보 (핵심 가치)
3. US1 + US2 → 로딩/빈 상태 UX (MVP 완성)
4. US3 + US4 + US5 + US8 → P2 기능 추가
5. US6 + US9 + US10 → P3 기능 추가
6. Polish → 모바일 최적화, 정리

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US7은 백엔드(T009~T013) + 프론트엔드(T014~T015) 양쪽 수정
- US8은 US7에서 구현한 market_hours.py를 재사용 → T029는 검증 작업
- IndicatorChart.tsx는 여러 US에서 수정되므로 순서 중요: US7(T014~T015) → US5(T027~T028) → US9(T031~T032) → US10(T034~T036) → Polish(T037)
- 모든 새 컴포넌트는 외부 npm 패키지 없이 기존 스택(React, Zustand, Tailwind)으로 구현
