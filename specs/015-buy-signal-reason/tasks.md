# Tasks: BUY 신호 이유 한줄 설명

**Input**: Design documents from `/specs/015-buy-signal-reason/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Phase 2 (Foundational) → Phase 3 (US1: 이유 표시) → Phase 4 (US2: 수치 강조) → Polish

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- File paths are relative to repository root

---

## Phase 1: Setup

*신규 의존성 없음, 프로젝트 구조 변경 없음 — 이 단계는 건너뜀*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리가 의존하는 공통 타입 정의

**⚠️ CRITICAL**: US1, US2 구현 전에 반드시 완료

- [x] T001 Define `BuySignalItem`, `ReasonPart`, `BuyReason` types and `NavigateState` interface in `frontend/src/utils/buyReason.ts`

**Checkpoint**: 타입 정의 완료 → US1/US2 구현 병렬 가능

---

## Phase 3: User Story 1 - BUY 신호 이유 한줄 설명 표시 (Priority: P1) 🎯 MVP

**Goal**: BUY 리스트에서 종목 상세로 진입 시 신호 이유를 한 문장으로 배너에 표시한다

**Independent Test**: Dashboard BuyCard 탭 → SignalDetail 진입 → 가격 영역 아래 BuySignalBanner 확인. 브라우저 새로고침 → 배너 사라짐 확인

### Implementation for User Story 1

- [x] T002 [US1] Implement `generateBuyReason(item: BuySignalItem): ReasonPart[]` template logic in `frontend/src/utils/buyReason.ts`
  - SQZ BUY 3-branch tree (trend=BULL+vol≥2 / trend=BULL / else)
  - BUY 6-branch tree (rsi<30+BULL+vol≥2 / rsi<30+BULL / vol≥2+macd>0 / vol≥2 / macd>0 / trend=BULL / default)
  - 공통 후미: `last_signal_date` 있으면 ` (MM-DD)` 추가
  - Fallback: 지표 없으면 `[{ text: 'BUY 신호가 감지됐습니다' }]`

- [x] T003 [P] [US1] Create `BuySignalBanner` component in `frontend/src/components/BuySignalBanner.tsx`
  - Props: `{ item: BuySignalItem }`
  - 내부에서 `generateBuyReason(item)` 호출
  - `ReasonPart[]`를 순회하며 `highlight=true`이면 `text-[var(--buy)] font-bold` span 렌더링
  - 배경: `bg-[var(--buy)]/10 border border-[var(--buy)]/30 rounded-xl p-3 mb-3`
  - 좌측 `🟢` 아이콘 포함

- [x] T004 [P] [US1] Modify `Dashboard.tsx` — BuyCard `onClick` navigate에 `state: { buySignal: item }` 추가
  - 기존: `nav(\`/\${symbol}?market=...\`)`
  - 변경: `nav(\`/\${symbol}?market=...\`, { state: { buySignal: item } })`

- [x] T005 [P] [US1] Modify `Scan.tsx` — BUY 항목 `onClick` navigate에 `state: { buySignal: item }` 추가
  - 기존: `navigate(\`/\${symbol}?market=...\`)`
  - 변경: `navigate(\`/\${symbol}?market=...\`, { state: { buySignal: item } })`

- [x] T006 [US1] Modify `SignalDetail.tsx` — `useLocation` state 읽기 + `BuySignalBanner` 삽입
  - `const { state } = useLocation()` 추가 (`NavigateState` 타입 캐스팅)
  - `BuySignalBanner` import 추가
  - 가격 영역 바로 아래, `PositionGuide` 위에 삽입: `{state?.buySignal && <BuySignalBanner item={state.buySignal} />}`

**Checkpoint**: US1 완료 기준 — BUY 리스트 진입 시 배너 표시, 검색/URL/새로고침 시 미표시

---

## Phase 4: User Story 2 - 수치 강조 표시 (Priority: P2)

**Goal**: 이유 문장 안의 RSI, 거래량 등 핵심 수치를 BUY 색상으로 시각적으로 강조한다

**Independent Test**: 시나리오 2 (RSI 24 → `[24]` 강조), 시나리오 3 (RSI 36, vol 2.8 → `[36]`, `[2.8배]` 강조)

*US2는 US1의 `ReasonPart.highlight` 메커니즘에 이미 내장됨 — T002와 T003에서 동시에 구현*

- [x] T007 [US2] Verify highlight rendering: `generateBuyReason` 출력에서 수치 파트(`highlight: true`)가 올바른 위치에 있는지 quickstart 6개 시나리오로 수동 검증
  - 시나리오 1: vol `3.2` highlight
  - 시나리오 2: rsi `24` highlight
  - 시나리오 3: rsi `36`, vol `2.8` highlight
  - 시나리오 4: rsi `38` highlight
  - 시나리오 5: 배너 미표시
  - 시나리오 6: fallback 문장 (highlight 없음)

**Checkpoint**: US2 완료 기준 — 모든 quickstart 시나리오에서 수치 강조 확인

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T008 Run `cd frontend && pnpm build` and verify no TypeScript errors
- [x] T009 Run `cd frontend && pnpm lint` and fix any lint errors
- [ ] T010 Manual integration test (quickstart.md 통합 테스트 순서 5단계 수행):
  1. Dashboard 모바일 에뮬레이터 → 차트 BUY 신호 섹션 종목 카드 탭
  2. SignalDetail → 가격 영역 아래 BuySignalBanner 확인
  3. BuySignalBanner → PositionGuide 순서 확인
  4. 브라우저 새로고침 → 배너 사라짐 확인
  5. 검색으로 동일 종목 진입 → 배너 없음 확인

---

## Dependencies

```
T001 (Types)
  ↓
T002 (generateBuyReason) → T003 (BuySignalBanner) → T006 (SignalDetail)
T004 (Dashboard nav)    ↗
T005 (Scan nav)         ↗
T006 → T007 (highlight verification)
T007 → T008 → T009 → T010
```

**Parallel opportunities**:
- T003, T004, T005 모두 T002 완료 후 병렬 실행 가능 (서로 다른 파일)
- T008, T009 순차 실행

---

## Implementation Strategy

**MVP Scope** (US1만으로 완성): T001 → T002 → T003 + T004 + T005 (병렬) → T006 → T008

US2(수치 강조)는 T002/T003 구현 시 `highlight: true` 파트를 함께 생성하므로 US1 완료 시 US2도 자동 충족됨.

**총 태스크**: 10개 (구현 6 + 검증 1 + 폴리쉬 3)
**예상 신규 파일**: 2개 (`buyReason.ts`, `BuySignalBanner.tsx`)
**수정 파일**: 3개 (`SignalDetail.tsx`, `Dashboard.tsx`, `Scan.tsx`)
