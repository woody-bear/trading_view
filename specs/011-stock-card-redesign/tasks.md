# Tasks: 메인페이지 종목 카드 항목 및 디자인 개선

**Input**: `/specs/011-stock-card-redesign/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 해당 유저 스토리 (US1~US4)

---

## Phase 1: Setup

**Purpose**: 추가 프로젝트 초기화 불필요. 유틸리티 파일 위치 확인.

- [X] T001 frontend/src/utils/ 디렉터리 존재 확인 (없으면 생성)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 유저 스토리가 의존하는 공통 기반. 이 Phase가 완료되어야 US1~US4 작업 가능.

⚠️ **CRITICAL**: Phase 2 완료 전 어떤 카드 컴포넌트도 수정하지 않는다.

- [X] T002 [P] 공유 Badge 타입 + indicatorLabels 유틸리티 생성 in `frontend/src/utils/indicatorLabels.ts` — `marketBadge()`, `signalStrengthBadge()`, `indicatorBadges()` 함수 및 Badge 인터페이스 구현 (contracts/label-utility.md 계약 준수, 우선순위: SQ>RSI>BB>거래량>MACD, 최대 4개)
- [X] T003 [P] `/api/signals` 응답에 market_type 필드 추가 in `backend/routes/signals.py` — watchlist symbol로 stock_master 조회하여 market_type 포함 (없으면 market 값 폴백)
- [X] T004 [P] Signal 인터페이스에 market_type 필드 추가 in `frontend/src/types/index.ts` — `market_type?: string`

**Checkpoint**: T002·T003·T004 완료 → 유틸리티 import 가능, API 응답에 market_type 포함 확인

---

## Phase 3: User Story 1 - 지표 상태 즉시 파악 (Priority: P1) 🎯 MVP

**Goal**: 관심종목·차트BUY·투자과열·추천 4개 카드 모두에 시장 유형 배지 + 신호 강도 + 지표 조건 라벨(최대 4개) 표시

**Independent Test**: 메인페이지에서 BUY 신호 종목 카드를 보고 5초 이내에 BUY 라벨 + 시장 유형 + 조건 라벨 확인 가능

- [X] T005 [P] [US1] SignalCard 리팩터 in `frontend/src/components/SignalCard.tsx` — 기존 중복 indicatorBadges 함수 제거, T002 유틸리티로 교체, market_type 배지 + signalStrengthBadge + indicatorBadges 적용 (고정 라벨 항상 표시, 지표 최대 4개)
- [X] T006 [P] [US1] BuyCard 리팩터 in `frontend/src/pages/Dashboard.tsx` — 기존 `reasons` 배열(string[]) 제거, T002 유틸리티 import 후 `{ label, cls }` Badge 구조로 교체, market_type 배지 추가
- [X] T007 [P] [US1] PickCard 리팩터 in `frontend/src/pages/Dashboard.tsx` — 기존 인라인 tags 배열 제거, T002 유틸리티로 교체, market_type 배지 추가
- [X] T008 [P] [US1] 투자과열 카드 리팩터 in `frontend/src/pages/Dashboard.tsx` — 기존 인라인 조건 렌더링 제거, T002 유틸리티로 교체, market_type 배지 추가

**Checkpoint**: 4개 카드 모두 동일한 Badge 구조 사용, 시장 유형 배지 표시 확인

---

## Phase 4: User Story 2 - 4개 섹션 일관된 색상 체계 (Priority: P2)

**Goal**: 동일 지표 조건이 4개 섹션 어디서든 동일 색상 라벨로 표시 (US1 공유 유틸로 자동 보장)

**Independent Test**: RSI < 30인 종목이 관심종목과 차트 BUY 섹션 양쪽에 있을 때, 두 카드의 "RSI 과매도" 라벨 색상이 동일함을 확인

- [X] T009 [US2] 4개 카드 타입에서 동일 조건 라벨 색상 일관성 검증 in `frontend/src/utils/indicatorLabels.ts` — 각 Badge cls 값이 카드 타입과 무관하게 동일한지 확인, 불일치 시 유틸리티 수정

**Checkpoint**: 모든 카드에서 동일 조건 = 동일 색상 Tailwind 클래스 확인

---

## Phase 5: User Story 3 - 전체 사이트 컬러 테마 밝기 조정 (Priority: P2)

**Goal**: 페이지 배경 #0D1117→#141E2E, 카드 배경 #161B22→#1C2840 등 CSS 변수 5개 조정

**Independent Test**: 메인페이지 + 설정 + 스크랩 페이지를 열었을 때 카드가 배경보다 명확히 밝아 구분되며 눈부심 없음

- [X] T010 [US3] CSS 변수 5개 업데이트 in `frontend/src/index.css` — `--bg: #141E2E`, `--card: #1C2840`, `--border: #2E3F5C`, `--navy: #223358`, `--muted: #94A3B8` (data-model.md 참조)

**Checkpoint**: 브라우저에서 전체 페이지 배경/카드 색상 변경 확인, 텍스트 가독성 유지

---

## Phase 6: User Story 4 - 카드 레이아웃 반응형 정합성 (Priority: P3)

**Goal**: 라벨이 5개 이상일 때 카드 밖으로 넘치지 않고, 모바일(375px)에서 핵심 정보 잘리지 않음

**Independent Test**: Chrome DevTools 375px 에뮬레이션에서 라벨이 많은 카드가 넘치지 않고 줄바꿈됨

- [X] T011 [US4] 라벨 영역 flex-wrap 적용 확인 in `frontend/src/components/SignalCard.tsx` — 라벨 컨테이너에 `flex flex-wrap gap-1` 적용 여부 확인, 없으면 추가
- [X] T012 [US4] Dashboard 카드 라벨 영역 flex-wrap 확인 in `frontend/src/pages/Dashboard.tsx` — BuyCard·PickCard·overheat 카드 라벨 컨테이너 동일하게 적용

**Checkpoint**: 모바일 375px에서 라벨 overflow 없음, 카드 높이가 자연스럽게 늘어남

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T013 TypeScript 타입 검증 실행 — `pnpm tsc --noEmit` 오류 0건 확인
- [X] T014 [P] quickstart.md 시나리오 1~6 수동 검증 — 6개 시나리오 모두 통과 확인
- [X] T015 [P] 라벨 없는 종목(NEUTRAL, 조건 미충족) 카드 레이아웃 확인 — 빈 라벨 행 미렌더링, 카드 높이 정상

---

## Dependencies & Execution Order

### Phase 의존성

- **Phase 1 (Setup)**: 즉시 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 → **모든 US 블록**
- **Phase 3 (US1)**: Phase 2 완료 후 시작
- **Phase 4 (US2)**: Phase 3 완료 후 시작 (공유 유틸 필요)
- **Phase 5 (US3)**: Phase 2 완료 후 독립 실행 가능 (CSS만 변경)
- **Phase 6 (US4)**: Phase 3 완료 후 시작
- **Phase 7 (Polish)**: 모든 Phase 완료 후

### US 간 의존성

- **US1** → US2 의존 (공유 유틸 기반 일관성 검증이 US1 구현 후 가능)
- **US3** → 독립적 (CSS 변수만, Phase 2 완료 후 바로 실행 가능)
- **US4** → US1 의존 (라벨 추가 후 레이아웃 검증)

### 병렬 실행 기회

- T002, T003, T004 — 동시 실행 가능 (다른 파일)
- T005, T006, T007, T008 — 동시 실행 가능 (T002 완료 후, Dashboard는 한 파일이라 순차)
- T010 (CSS) — T002 완료 직후 독립 실행 가능
- T013, T014, T015 — 동시 실행 가능

---

## Parallel Example: Phase 2 (Foundational)

```bash
# T002, T003, T004 동시 실행:
Task: "indicatorLabels.ts 유틸리티 생성"          → frontend/src/utils/indicatorLabels.ts
Task: "signals.py market_type 추가"               → backend/routes/signals.py
Task: "types/index.ts Signal 타입 market_type 추가" → frontend/src/types/index.ts
```

## Parallel Example: Phase 3 (US1)

```bash
# T005 완료 후, T006·T007·T008은 같은 파일(Dashboard.tsx)이라 순차:
Task: "SignalCard 리팩터" → frontend/src/components/SignalCard.tsx  [독립]
Task: "BuyCard → PickCard → overheat 순차 리팩터" → frontend/src/pages/Dashboard.tsx
```

---

## Implementation Strategy

### MVP (US1 + US3만)

1. Phase 2 완료 (T001~T004)
2. Phase 3 완료 (T005~T008) — 4개 카드 라벨 추가
3. Phase 5 완료 (T010) — CSS 테마 조정
4. **검증**: 메인페이지에서 라벨 + 밝아진 카드 확인
5. **배포 가능 상태**

### 전체 순서

1. Setup → Foundational → US3(CSS) + US1(라벨) 병행 → US2(검증) → US4(반응형) → Polish
