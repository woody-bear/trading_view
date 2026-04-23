# Tasks: List Screens Realtime Price Flicker

**Input**: Design documents from `/specs/030-list-price-flicker/`
**Branch**: `030-list-price-flicker` | **Date**: 2026-04-23
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not requested — manual browser verification only (per quickstart.md)

**Organization**: Tasks grouped by user story. US1 (price flicker) is MVP; US2 (reconnection) verifies existing cleanup behavior.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add CSS color variable required by all subsequent tasks. Must complete before any component work.

- [x] T001 Add `--blue: oklch(0.60 0.18 240)` and `--blue-bg: oklch(0.94 0.06 240)` variables to `frontend/src/styles/tokens.css`

**Checkpoint**: `--blue` and `--blue-bg` available as CSS variables across all components

---

## Phase 2: User Story 1 — 목록 화면 실시간 가격 깜빡임 (Priority: P1) 🎯 MVP

**Goal**: 관심종목·추천종목·눌림목·대형주 목록 화면 전체에서 현재가·등락률이 5초마다 갱신되며, 가격 변동 시 0.8초간 초록(상승)/파란(하락) 깜빡임이 발생한다.

**Independent Test**: 대시보드 열고 5초 대기 → 추천종목 카드에서 현재가·등락률 깜빡임 발생 여부 확인. 음수 등락률이 파란색으로 표시되는지 확인.

### Implementation for User Story 1

- [x] T002 [US1] Fix BuyCard flash color (down: `var(--down)` → `var(--blue)`) and 등락률 static color (`sparkUp ? 'var(--up)' : 'var(--down)'` → `'var(--blue)'`) in `frontend/src/pages/Dashboard.tsx`
- [x] T003 [US1] Extract `PRICE_POLL_INTERVAL_MS = 5_000` constant and change `setInterval(refreshPrices, 30_000)` → `setInterval(refreshPrices, PRICE_POLL_INTERVAL_MS)` in `frontend/src/pages/Dashboard.tsx`
- [x] T004 [P] [US1] Fix hardcoded `livePrices={{}}` → `livePrices={livePrices}` at all 3 occurrences in `frontend/src/pages/Scan.tsx`
- [x] T005 [US1] Add watchlist signal symbols to `extractSymbols()` and pass `livePrices={livePrices}` prop to `<WatchlistPanel>` in `frontend/src/pages/Dashboard.tsx`
- [x] T006 [US1] Add `livePrices?: Record<string, any>` prop to `WatchlistPanel`, pass `livePrice={livePrices?.[signal.symbol]}` to each `MiniWatchCard`, and add `useRef` + `useState` flash logic inside `MiniWatchCard` (identical pattern to BuyCard: 상승=`var(--up)`, 하락=`var(--blue)`, 지속=800ms) with 등락률 color `change_pct > 0 → var(--up)`, `< 0 → var(--blue)`, `=== 0 → var(--fg-2)` in `frontend/src/components/WatchlistPanel.tsx`

**Checkpoint**: 대시보드 + 스캔 페이지 모두에서 4개 목록 화면 깜빡임 동작, 등락률 색상 파란색 적용 확인

---

## Phase 3: User Story 2 — 화면 전환 후 연결 재개 (Priority: P2)

**Goal**: 목록 화면에서 이탈 시 폴링이 정리되고, 복귀 시 자동 재개된다.

**Independent Test**: 대시보드 → 다른 페이지 이동 → 대시보드 복귀 후 5초 내 깜빡임 재발생 확인.

### Implementation for User Story 2

- [x] T007 [US2] Verify `useEffect` cleanup in `frontend/src/pages/Dashboard.tsx` returns `clearInterval(intervalId)` — confirm unmount 시 폴링 종료, remount 시 즉시 재시작되는 기존 패턴이 올바르게 적용되어 있는지 확인하고, 필요 시 수정

**Checkpoint**: 페이지 이탈·복귀 시 콘솔에 setInterval 누적 경고 없음, 복귀 후 5초 내 가격 업데이트 발생

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: 빌드 검증 및 색상 규칙 전체 확인

- [x] T008 Run `pnpm build` in `frontend/` and verify 0 TypeScript errors
- [x] T009 [P] Browser verification per `specs/030-list-price-flicker/quickstart.md` — 4개 화면 깜빡임, 등락률 색상 파란색, 가격 무변동 시 깜빡임 없음 확인

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 가능 — CSS 변수 추가, 다른 모든 태스크의 선행 조건
- **Phase 2 (US1)**: Phase 1 완료 후 시작. T002·T003·T005는 Dashboard.tsx 순차 수정, T004는 Scan.tsx로 병렬 실행 가능
- **Phase 3 (US2)**: Phase 2 완료 후 검증 (기존 cleanup 패턴 확인)
- **Phase 4 (Polish)**: Phase 2·3 완료 후 빌드 및 브라우저 검증

### User Story Dependencies

- **US1 (P1)**: Phase 1 완료 후 시작 — 다른 스토리 의존 없음
- **US2 (P2)**: US1 완료 후 시작 — US1의 폴링 로직 존재 전제

### Within US1 — Execution Order

```
T001 (tokens.css)
    ↓
T002 (Dashboard.tsx BuyCard color)  ← T004 (Scan.tsx fix, 병렬 가능)
    ↓
T003 (Dashboard.tsx polling interval)
    ↓
T005 (Dashboard.tsx extractSymbols + WatchlistPanel prop)
    ↓
T006 (WatchlistPanel.tsx flash logic)
```

### Parallel Opportunities

- **T004** (Scan.tsx): T001 완료 후 T002~T005와 병렬로 진행 가능 (다른 파일)
- **T008, T009** (Polish): 동시 실행 가능

---

## Parallel Example: User Story 1

```bash
# T001 완료 후, 아래 두 작업을 병렬 시작:
Task A: T002 → T003 → T005 → T006  (Dashboard.tsx → WatchlistPanel.tsx)
Task B: T004                         (Scan.tsx — 독립 파일)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: T001 (tokens.css)
2. Complete Phase 2: T002 → T003 → T004 (parallel) → T005 → T006
3. **STOP and VALIDATE**: 브라우저에서 4개 목록 화면 깜빡임 + 파란색 하락 색상 확인
4. Proceed to US2 if validation passes

### Incremental Delivery

1. T001 → Foundation ready
2. T002~T006 → US1 (MVP) complete → browser verify
3. T007 → US2 verify → polish
4. T008~T009 → Build + final validation

---

## Notes

- 백엔드 변경 없음 — `POST /prices/batch` 기존 엔드포인트 그대로 사용
- `usePriceFlash` 훅 수정 금지 — SignalDetail 영향 방지
- CRYPTO 시장 심볼은 extractSymbols()에서 제외 유지 (KIS API 미지원)
- 신규 파일 없음 — 기존 5개 파일 수정만
- 총 태스크: 9개 | US1: 5개 | US2: 1개 | Setup: 1개 | Polish: 2개
