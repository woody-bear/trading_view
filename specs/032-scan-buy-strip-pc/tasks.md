# Tasks: PC 스캔 화면 최상단 BUY 신호 5개 스트립

**Feature**: `032-scan-buy-strip-pc`  
**Branch**: `032-scan-buy-strip-pc`  
**Spec**: `specs/032-scan-buy-strip-pc/spec.md`  
**Plan**: `specs/032-scan-buy-strip-pc/plan.md`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: User story label (US1)
- Exact file paths included in all descriptions

---

## Phase 1: Setup

**Purpose**: 구현 전 기존 구조 파악

- [x] T001 `frontend/src/pages/Dashboard.tsx`를 읽어 `PcScanPanel` 컴포넌트 내부 구조(ScanStatusPanel 위치, BuyCard import, livePrices, fetchFullScanLatest 사용 방식) 파악
- [x] T002 `frontend/src/api/client.ts`에서 `fetchFullScanLatest` 함수 시그니처 및 반환 타입 확인

**Checkpoint**: `PcScanPanel` 구조와 `BuyCard`·`fetchFullScanLatest` 사용 패턴 파악 완료

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 신규 의존성·인프라 없음 — 이 피처는 기존 컴포넌트·API 재사용

> N/A — 신규 테이블, 신규 API 엔드포인트, 신규 패키지 불필요. Phase 1 완료 후 즉시 US1 구현 가능.

---

## Phase 3: User Story 1 — PC 스캔 화면 상단 BUY 5개 표시 (Priority: P1) 🎯 MVP

**Goal**: PC 화면(≥768px) 스캔 페이지의 탭 목록 위에 최근 BUY 신호 최대 5개를 MiniWatchCard 형식으로 항상 표시

**Independent Test**: PC 브라우저(≥768px)로 스캔 페이지 접속 시 탭 위 독립 섹션에 BUY 카드 최대 5개가 표시되고, 탭 전환 시에도 섹션이 유지되면 검증 완료

### Implementation for User Story 1

- [x] T003 [US1] `frontend/src/pages/Dashboard.tsx`에 `PcBuyStrip` 컴포넌트 추가: `useQuery('quick-buy-strip', fetchFullScanLatest, { staleTime: 120_000, refetchInterval: 300_000 })` + `data?.chart_buy?.items?.slice(0, 5) ?? []` + `items.length === 0 → return null`
- [x] T004 [US1] `frontend/src/pages/Dashboard.tsx`의 `PcBuyStrip` 렌더: `hidden md:block` wrapper div, 섹션 헤더("최근 BUY" + count chip), `grid-cols-5` 내 `BuyCard` 최대 5개 (livePrice 주입)
- [x] T005 [US1] `frontend/src/pages/Dashboard.tsx`의 `MarketScanBox` 컴포넌트에서 `ScanStatusPanel` 바로 위에 `<PcBuyStrip livePrices={livePrices} />` 삽입

**Checkpoint**: BUY 카드가 탭 위에 표시되고 탭 전환 시 유지되는지 브라우저 확인

---

## Phase 4: Polish & Cross-Cutting Concerns

- [x] T006 `pnpm build` 실행하여 TypeScript 오류·빌드 오류 없음 확인 (`frontend/` 디렉토리에서)
- [x] T007 `quickstart.md` 5개 시나리오 수동 브라우저 검증: (1) BUY 카드 표시 (2) 탭 전환 유지 (3) 카드 클릭 이동 (4) BUY 없을 때 빈 영역 없음 (5) 모바일 미표시
- [x] T008 모바일 홈 화면 QuickBuyStrip 회귀 없음 확인 (기존 동작 유지)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작 가능
- **Foundational (Phase 2)**: N/A — 건너뜀
- **User Story 1 (Phase 3)**: Phase 1 완료 후 시작 (T001, T002 완료 필요)
- **Polish (Phase 4)**: Phase 3 완료 후 시작

### Within User Story 1

```
T003 (PcBuyStrip 컴포넌트 로직) → T004 (렌더 마크업) → T005 (PcScanPanel에 삽입)
```

T003 → T004: 컴포넌트 선언이 렌더 상세보다 먼저  
T004 → T005: 컴포넌트 완성 후 삽입  

### Parallel Opportunities

- T001, T002: 서로 다른 파일 읽기 → 병렬 실행 가능

---

## Parallel Example: Setup

```bash
# T001, T002는 병렬로 읽기 가능:
Task: "Dashboard.tsx에서 PcScanPanel 구조 파악"
Task: "client.ts에서 fetchFullScanLatest 시그니처 확인"
```

---

## Implementation Strategy

### MVP (이 피처 전체가 단일 스토리)

1. Phase 1: T001, T002 병렬 실행 (구조 파악)
2. Phase 3: T003 → T004 → T005 순차 실행 (PcBuyStrip 구현 + 삽입)
3. Phase 4: T006 → T007 → T008 (빌드 + 브라우저 검증 + 회귀 확인)
4. 완료

### 파일 변경 범위

| 파일 | 변경 유형 |
|------|----------|
| `frontend/src/pages/Dashboard.tsx` | 수정 — `PcBuyStrip` 컴포넌트 추가 + `PcScanPanel`에 삽입 |
| 백엔드 파일 전체 | 변경 없음 |
| 기타 프론트엔드 파일 | 변경 없음 |

---

## Notes

- 신규 import 불필요: `BuyCard`, `fetchFullScanLatest`, `useQuery` 모두 `Dashboard.tsx` 내에 이미 존재
- `livePrices`는 `PcScanPanel`이 이미 보유 — prop으로 `PcBuyStrip`에 전달
- queryKey `'quick-buy-strip'`은 `QuickBuyStrip`(모바일)과 공유 → 추가 API 호출 없음
- 모바일 숨김: `hidden md:flex` (프로젝트 기존 반응형 패턴)
- 빌드 전 브라우저 검증: `pnpm dev`로 확인 후 `pnpm build`로 최종 빌드
