# Tasks: BUY Signal Age Label on Stock Cards

**Input**: Design documents from `/specs/031-signal-days-label/`
**Branch**: `031-signal-days-label` | **Date**: 2026-04-23
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Tests**: Not requested — manual browser verification only (per quickstart.md)

**Organization**: Tasks grouped by user story. US1 (스캔 결과 카드, frontend only) is MVP; US2 (관심종목, backend+frontend) follows after.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 두 User Story 모두에서 사용하는 공유 유틸 및 타입 준비. 모든 후속 태스크의 선행 조건.

- [x] T001 Add `FRESH_SIGNAL_DAYS = 7` constant and `fmtSignalAge(dateStr: string | undefined | null): { label: string; fresh: boolean } | null` function to `frontend/src/utils/format.ts` — 0일→"오늘", N일→"N일 전", 미래/null→null 반환
- [x] T002 Add `last_signal_date?: string` field to `Signal` interface in `frontend/src/types/index.ts`

**Checkpoint**: `fmtSignalAge` 함수 사용 가능, `Signal` 타입 확장 완료

---

## Phase 2: User Story 1 — 스캔 결과 카드 경과일 표시 (Priority: P1) 🎯 MVP

**Goal**: 추천종목·눌림목·대형주 BuyCard에서 기존 날짜 raw 텍스트를 "N일 전" / "오늘" 칩으로 교체. 7일 이하=강조색, 8일 이상=흐린색.

**Independent Test**: 추천종목 카드 확인 → 날짜 문자열("2026-04-xx") 대신 "N일 전" 라벨이 색상과 함께 표시되면 검증 완료.

### Implementation for User Story 1

- [x] T003 [US1] Replace raw `item.last_signal_date` text with `fmtSignalAge` styled chip in BuyCard compact mode (mobile) in `frontend/src/pages/Dashboard.tsx` — `fresh=true` 시 `var(--up)` 색, `fresh=false` 시 `var(--fg-3)` 색
- [x] T004 [US1] Replace raw `item.last_signal_date` text with `fmtSignalAge` styled chip in BuyCard PC full mode in `frontend/src/pages/Dashboard.tsx` — 동일 색상 규칙 적용

**Checkpoint**: 추천종목·눌림목·대형주 카드 모두에서 "N일 전" 라벨 확인, 색상 구분 확인

---

## Phase 3: User Story 2 — 관심종목 카드 경과일 표시 (Priority: P2)

**Goal**: 백엔드 `/signals` 응답에 `last_signal_date` 추가 후, MiniWatchCard에서 BUY 신호 종목에 동일한 경과일 라벨 표시.

**Independent Test**: 관심종목 패널에서 BUY 상태 종목에 "N일 전" 라벨 표시, SELL/NEUTRAL 종목에는 미표시.

### Implementation for User Story 2

- [x] T005 [P] [US2] Add LEFT JOIN with `ScanSnapshotItem` (symbol match, max `last_signal_date` per symbol) to `GET /signals` endpoint and include `"last_signal_date"` field in response dict in `backend/routes/signals.py`
- [x] T006 [US2] Add signal age label to `MiniWatchCard` in `frontend/src/components/WatchlistPanel.tsx` — `s.signal_state === 'BUY'`일 때만 `fmtSignalAge(s.last_signal_date)` 호출하여 칩 표시

**Checkpoint**: 관심종목 BUY 종목에 라벨 표시, SELL/NEUTRAL 종목 미표시

---

## Phase 4: Polish & Cross-Cutting Concerns

- [x] T007 Run `pnpm build` in `frontend/` and verify 0 TypeScript errors
- [ ] T008 [P] Browser verification per `specs/031-signal-days-label/quickstart.md` — 추천종목·눌림목·대형주·관심종목 4개 화면에서 색상 구분 및 라벨 형식 확인

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 가능 — T001, T002 병렬 실행 가능
- **Phase 2 (US1)**: T001 완료 후 시작. T003, T004는 같은 파일(Dashboard.tsx) 내 다른 섹션 — 순차 실행
- **Phase 3 (US2)**: T001 + T002 완료 후 시작. T005(백엔드), T006(프론트) 다른 파일이므로 병렬 가능
- **Phase 4 (Polish)**: Phase 2 + 3 완료 후

### User Story Dependencies

- **US1 (P1)**: Phase 1(T001) 완료 후 독립 실행 가능
- **US2 (P2)**: Phase 1(T001 + T002) 완료 후 시작. T005 백엔드 완료 후 T006 프론트 진행 권장

### Within Each Story

```
T001 (format.ts)  ← T002 (types/index.ts) [병렬]
    ↓                    ↓
T003 → T004          T005 (백엔드) → T006 (프론트)
(Dashboard.tsx)     (signals.py) → (WatchlistPanel.tsx)
```

---

## Parallel Opportunities

```bash
# Phase 1: 동시 실행 가능
Task A: T001  (format.ts 유틸)
Task B: T002  (types/index.ts)

# Phase 3 (US2): T001+T002 완료 후 동시 시작 가능
Task A: T005  (backend/routes/signals.py)
Task B: T006  (frontend/src/components/WatchlistPanel.tsx)
       ← T005 완료 후 실제 데이터로 검증 권장
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: T001, T002 (병렬)
2. Complete Phase 2: T003 → T004
3. **STOP and VALIDATE**: 브라우저에서 추천종목 카드 "N일 전" 라벨 확인
4. Proceed to US2 if validated

### Incremental Delivery

1. T001 + T002 → Foundation ready
2. T003 + T004 → US1 (MVP) → browser verify
3. T005 + T006 → US2 → browser verify
4. T007 + T008 → Build + final validation

---

## Notes

- 백엔드 DB 마이그레이션 없음 — `ScanSnapshotItem.last_signal_date` 기존 컬럼 JOIN 활용
- `fmtSignalAge` null 반환 시 렌더하지 않음 (빈 라벨 없음)
- 총 태스크: 8개 | Setup: 2개 | US1: 2개 | US2: 2개 | Polish: 2개
