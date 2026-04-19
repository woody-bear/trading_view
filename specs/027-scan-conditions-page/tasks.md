---

description: "Tasks for 조회조건 페이지 (027-scan-conditions-page) — PC Mermaid 도표 + 모바일 조건표 이원화"
---

# Tasks: 조회조건 페이지

**Input**: Design documents from `/specs/027-scan-conditions-page/`  
**Prerequisites**: plan.md ✅, spec.md ✅ (clarify 4회 반영), research.md ✅, data-model.md ✅, contracts/ui-contract.md ✅, quickstart.md ✅

**Tests**: 본 기능에는 별도 자동 테스트 작성 요청 없음 — 회귀 검증은 quickstart.md 수동 절차.

**Organization**: 4개 user story (P1 매수 통합 파이프라인 PC 도표+모바일 조건표, P2 SELL 영역 PC+모바일, P2 코드 모듈화, P3 탭 네비) 기준 그룹화.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 파일·의존성 분리 → 병렬 가능
- **[Story]**: US1, US2, US3, US4 매핑
- 절대 경로 기준

## Path Conventions (Web app)

- Backend: `/Users/woody/workflow/trading_view/backend/`
- Frontend: `/Users/woody/workflow/trading_view/frontend/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 의존성 설치 + 디렉토리 구조 준비

- [X] T001 [P] Install mermaid npm package by running `pnpm add mermaid` in `/Users/woody/workflow/trading_view/frontend/`
- [X] T002 [P] Create directory `/Users/woody/workflow/trading_view/frontend/src/constants/`
- [X] T003 [P] Create directory `/Users/woody/workflow/trading_view/frontend/src/components/conditions/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 user story가 공유하는 데이터 구조 + 반응형 래퍼 컴포넌트

**⚠️ CRITICAL**: 이 phase 완료 후에만 US1, US2가 의미 있게 시작. US3 백엔드·US4 네비는 Phase 1 완료 후 독립 병렬 시작 가능.

- [X] T004 Define `Step`, `StepKind`, `StepBranch` TypeScript interfaces + `CONDITION_VALUES` readonly constant in `/Users/woody/workflow/trading_view/frontend/src/constants/conditions.ts` per data-model.md §1.1 and §1.4 (RSI_BUY_PRESETS, RSI_SELL=60, COOLDOWN_BARS=5, SIGNAL_LOOKBACK_DAYS=20, DATA_STALENESS_DAYS=7, MIN_CANDLES=60, RESPONSIVE_BREAKPOINT_PX=768)
- [X] T005 Implement `stepsToMermaidFlowchart(steps: readonly Step[]): string` helper in `/Users/woody/workflow/trading_view/frontend/src/constants/conditions.ts` per data-model.md §2
- [X] T006 Create `/Users/woody/workflow/trading_view/frontend/src/components/conditions/FlowchartView.tsx` (PC 전용) — mermaid 동적 import
- [X] T007 Create `/Users/woody/workflow/trading_view/frontend/src/components/conditions/ConditionStepTable.tsx` (모바일 전용) — 카드 리스트
- [X] T008 Create `/Users/woody/workflow/trading_view/frontend/src/components/conditions/ConditionsSection.tsx` 반응형 래퍼
- [X] T009 Create `/Users/woody/workflow/trading_view/frontend/src/pages/ScanConditions.tsx` (완성 — BUY/SELL 영역 + RSI 프리셋 표 포함)
- [X] T010 Register route `/conditions` in `/Users/woody/workflow/trading_view/frontend/src/App.tsx`

**Checkpoint**: 빈 페이지가 `/conditions`에서 PC↔모바일 반응형으로 접근 가능 (콘텐츠 비어있음). Step 타입 + 변환 헬퍼 + 반응형 래퍼 준비 완료. US1·US2 구현 가능, US3 백엔드·US4 네비는 이미 병렬 진행 중이어도 됨.

---

## Phase 3: User Story 1 — 매수 통합 파이프라인 (PC: 도표 / 모바일: 조건표) (Priority: P1) 🎯 MVP

**Goal**: 사용자가 `/conditions`에서 BUY/SQZ BUY 라벨 판정부터 추천종목·눌림목 선정까지 전체 흐름을 확인. PC는 통합 Mermaid 플로우차트, 모바일은 단계별 카드 조건표.

**Independent Test**: PC(≥768px)에서 상단 Mermaid 도표 렌더 확인 (8+ 노드, 분기 1+). 모바일(<768px)에서 동일 단계가 카드 8+개로 세로 나열, Mermaid 도표 미표시, 가로 스크롤 없이 세로 스크롤만으로 전체 확인 가능.

### Implementation for User Story 1

- [X] T011 [US1] Populate `BUY_PIPELINE_STEPS: readonly Step[]` in `conditions.ts` — BUY 진입 분기 + BB 복귀 분기 + SQZ BUY 진입 분기 + merge + 공통 필터(데드크로스/20거래일/7일 신선도/거래량 미적용) + 결과(추천종목/눌림목 분기)
- [X] T012 [US1] Add `export const BUY_PIPELINE_MERMAID: string = stepsToMermaidFlowchart(BUY_PIPELINE_STEPS)` derived export
- [X] T013 [US1] Wire BUY section into `ScanConditions.tsx` with `<ConditionsSection>`
- [X] T014 [US1] Add RSI 민감도 프리셋 표 under BUY section
- [X] T015 [US1] `pnpm build` 통과 — mermaid 번들이 별도 chunk로 분리됨(`chunk-K5T4RW27-*.js` 474KB, `cytoscape.esm-*.js` 434KB, `flowDiagram-*.js` 60KB 등). 수동 브라우저 검증은 서버 재시작(T032) 후

**Checkpoint**: MVP — 매수 통합 파이프라인이 PC는 도표, 모바일은 조건표로 완전 동작. 시연 가능.

---

## Phase 4: User Story 2 — SELL 라벨 별도 영역 (PC: 도표 / 모바일: 조건표) (Priority: P2)

**Goal**: 페이지 하단에 SELL 라벨 발생 조건을 별도 영역으로 표시. PC는 별도 Mermaid, 모바일은 조건표. "차트 표시 전용" 안내 문구 포함.

**Independent Test**: PC에서 SELL 플로우차트 3+ 노드 렌더, 모바일에서 SELL 카드 3+개 + 안내 문구. 양쪽 모두 매수 영역 하단에 배치.

### Implementation for User Story 2

- [X] T016 [US2] Populate `SELL_FLOWCHART_STEPS: readonly Step[]` — 상단 터치/돌파 + 상단 복귀 + RSI > 60 + 모멘텀 하락 + SELL 라벨 + 쿨다운 note
- [X] T017 [US2] Add `SELL_FLOWCHART_MERMAID` derived export
- [X] T018 [US2] Wire SELL `<ConditionsSection>` with guidance text
- [X] T019 [US2] `pnpm build` 통과 (T015와 동일 빌드). 수동 브라우저 검증은 T032 이후

**Checkpoint**: US1 + US2 동시 작동. PC는 상단 매수 + 하단 SELL 두 도표, 모바일은 매수 카드 + SELL 카드.

---

## Phase 5: User Story 3 — 조건 정의 코드 모듈화 (프론트 + 백엔드) (Priority: P2)

**Goal**: 프론트는 Phase 2~4에서 `conditions.ts`로 이미 중앙화 완료. 본 phase는 **백엔드 추출** 집중.

**Independent Test**: `scan_conditions.py`에서 `SIGNAL_LOOKBACK_DAYS`를 변경하면 `full_market_scanner.py` 수정 없이 스캔 로직 반영. 리팩토링 전후 `run_full_scan()` 결과 동일 종목/카테고리 일치.

### Implementation for User Story 3

- [X] T020 [P] [US3] Create `scan_conditions.py` with constants (RSI_BUY_THRESHOLD_PRESETS, RSI_SELL_THRESHOLD=60, COOLDOWN_BARS=5, SIGNAL_LOOKBACK_DAYS=20, DATA_STALENESS_DAYS=7, MIN_CANDLES=60)
- [X] T021 [US3] Move `is_dead_cross`, `is_pullback`, `check_trend`, `check_buy_signal_precise` (verbatim bodies, public names) into scan_conditions.py
- [X] T022 [US3] Update full_market_scanner.py — import from scan_conditions, replace call sites (4개), remove moved definitions, replace `SCAN_MIN_CANDLES` with imported `MIN_CANDLES`
- [X] T023 [US3] Smoke verified: import OK, 단위 테스트 (is_dead_cross 역배열/정배열, is_pullback 눌림목 케이스) 모두 기대값 일치. Full regression scan은 운영 데이터 필요하므로 T032 재시작 후 실행 가능

**Checkpoint**: 백엔드 스캔 로직이 `scan_conditions.py` 단일 모듈 참조. 조건 변경 시 한 파일만 수정.

---

## Phase 6: User Story 4 — 헤더 탭 네비게이션 (Priority: P3)

**Goal**: PC 헤더 + 모바일 BottomNav에 '조회조건' 탭 추가.

**Independent Test**: PC 탭 클릭 → `/conditions` 이동 + 활성 스타일. 모바일 BottomNav 동일 동작.

### Implementation for User Story 4

- [X] T024 [P] [US4] Add `{ path: '/conditions', icon: ListChecks, label: '조회조건' }` to BottomNav.tsx tabs (스크랩과 설정 사이)
- [X] T025 [P] [US4] Add `<a href="/conditions" className="text-emerald-400 …">조회조건</a>` to PC TopNav in App.tsx
- [X] T026 [US4] Build successful (T015과 동일). 활성 탭 시각 구분은 T032 서버 재시작 후 브라우저 검증

**Checkpoint**: 모든 user story 독립 작동. 페이지 접근·PC 도표·모바일 조건표·네비게이션 완전 통합.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 번들 분리 검증, 반응형 전환 QA, 서버 재시작 (Constitution SR-01~SR-06)

- [X] T027 Verified bundle split — `dist/assets/`에 `mermaid.core-D0v4sACs.js`, `flowDiagram-DWJPFMVM-*.js`, `cytoscape.esm-*.js`, `mermaid-parser.core-*.js` 등 다수 mermaid chunk가 main `index-*.js`와 분리됨
- [ ] T028 [수동] DevTools 모바일 에뮬레이션(375px)에서 mermaid chunk 미로드 확인 — 사용자 브라우저 검증 필요
- [ ] T029 [수동] PC(≥768px)에서 mermaid chunk 로드 확인 — 사용자 브라우저 검증 필요
- [ ] T030 [수동] 768px 경계 반응형 전환 시 PC 도표 ↔ 모바일 조건표 전환, 콘솔 에러 없음 확인 — 사용자 브라우저 검증 필요
- [ ] T031 [수동] 전체 quickstart.md §12 체크리스트 — 사용자 브라우저 검증 필요
- [X] T032 백엔드는 `--reload` 모드로 가동 중(자동 재시작), 프론트 `dist/` 빌드 완료. `/conditions` 200 OK 확인. import 모듈이 `services.scan_conditions`로 해석됨
- [X] T033 코드 검토: scan_conditions.py 신규 파일은 dead code 없음, full_market_scanner.py는 함수 4개 제거 후 import 추가 + `SCAN_MIN_CANDLES` → `MIN_CANDLES` 정리. AST syntax 통과

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작, 병렬
- **Phase 2 (Foundational)**: Phase 1 완료 후. US1·US2 전제조건
- **Phase 3 (US1 MVP)**: Phase 2 완료 후. 다른 US와 독립
- **Phase 4 (US2)**: Phase 2 완료 후. US1과 `ScanConditions.tsx` + `conditions.ts` 동시 수정 → 순차 진행 권장
- **Phase 5 (US3 백엔드)**: Phase 1 완료 후 시작 가능. 프론트 US와 완전 병렬
- **Phase 6 (US4 네비)**: Phase 2 완료 후 시작 가능. US1/US2와 파일 충돌 없음 → 병렬 가능
- **Phase 7 (Polish)**: 모든 US 완료 후

### User Story Dependencies

- **US1 (P1)**: Phase 2 완료 후. 다른 스토리 의존 없음
- **US2 (P2)**: Phase 2 완료 후. US1과 같은 파일 수정 → 순차 권장
- **US3 (P2)**: Phase 1 완료 후. 백엔드 전용 → US1/US2와 완전 독립, **병렬 가능**
- **US4 (P3)**: Phase 2 완료 후. 네비 파일 전용 → 다른 US와 **병렬 가능**

### Within Each User Story

- 상수·타입 정의 → 파생 export → 페이지 wiring → 빌드·검증
- 각 US 독립 재빌드·검증 가능

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 모두 [P]
- **Phase 5 vs Phase 3/4/6**: 백엔드(T020~T023)와 프론트(T011~T019, T024~T026) 완전 병렬
- **T020**: 신규 파일 — [P]
- **T024, T025**: BottomNav.tsx / App.tsx 분리 — [P]

---

## Parallel Example: Setup Phase

```bash
# Phase 1 — 동시 실행
Task: "Install mermaid (T001)"
Task: "Create constants/ dir (T002)"
Task: "Create components/conditions/ dir (T003)"
```

## Parallel Example: Post-Foundational (다중 개발자)

```bash
Developer A: Phase 3 (US1) → Phase 4 (US2) 순차
Developer B: Phase 5 (US3 백엔드) 단독
Developer C: Phase 6 (US4 네비) 단독
→ Phase 7 Polish에서 통합 검증
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup 완료
2. Phase 2 Foundational 완료 (타입+헬퍼+컴포넌트+라우트)
3. Phase 3 US1 완료 (BUY 단계 데이터 + 페이지 wiring)
4. **STOP and VALIDATE**: `/conditions` URL 직접 접근 → PC 도표 + 모바일 조건표 확인
5. 이 시점에서 MVP 완성. 시연 가능.

### Incremental Delivery

1. Setup + Foundational → 뼈대 + 반응형 구조
2. US1 → MVP (매수 파이프라인 PC 도표 + 모바일 조건표)
3. US2 → SELL 영역 추가 (PC 도표 + 모바일 조건표)
4. US3 → 백엔드 모듈 정리 (사용자 가시 변화 없음)
5. US4 → 탭 네비게이션 통합
6. Polish → 번들·반응형 QA

### Parallel Team Strategy

Phase 2 완료 후:
- Dev A: US1 → US2 순차 (동일 파일)
- Dev B: US3 백엔드 (독립)
- Dev C: US4 네비 (독립)

---

## Notes

- [P] tasks = 서로 다른 파일, 의존성 없음
- `ScanConditions.tsx`는 T009(skeleton) → T013(BUY) → T014(RSI 표) → T018(SELL) 누적 수정 → 순차
- `conditions.ts`는 T004(타입+상수) → T005(헬퍼) → T011(BUY steps) → T012(BUY DSL) → T016(SELL steps) → T017(SELL DSL) 누적 수정 → 순차
- Phase 5 백엔드 리팩토링은 기능 변경 없음, 회귀 검증(T023)이 성공 기준
- **번들 분리 (T027~T029)**: Q4 핵심 요구사항 — 모바일 사용자는 mermaid 다운로드 없음
- **반응형 전환 (T030)**: 768px 경계에서 PC 도표 ↔ 모바일 조건표 깔끔히 전환되어야 함
- Constitution SR-01~SR-06: T032 이후 백엔드·프론트 재시작 완료
- 커밋: 각 user story checkpoint에서 `feat:` / `refactor:` 단위 권장
