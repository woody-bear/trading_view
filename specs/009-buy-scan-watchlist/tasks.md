# Tasks: BUY 사인조회 주식목록 페이지

**Input**: Design documents from `/specs/009-buy-scan-watchlist/`
**Branch**: `009-buy-scan-watchlist`
**Spec**: spec.md | **Plan**: plan.md | **Data Model**: data-model.md | **Contracts**: contracts/api.md

**Organization**: 사용자 스토리 기준 정렬 (US1→US2→US3/4). 테스트 없음 (명세서 미요청).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 선행 작업 불필요)
- **[Story]**: 해당 사용자 스토리 (US1~US4)

---

## Phase 1: Setup (공통 인프라)

**Purpose**: 라우트, 네비게이션, API 클라이언트 함수 추가 — 모든 US의 진입점

- [x] T001 `frontend/src/App.tsx`에 `/buy-list` 라우트 추가 (`/:symbol` 동적 라우트 앞에 선언, `BuyList` 컴포넌트 import)
- [x] T002 [P] `frontend/src/components/BottomNav.tsx`에 BUY조회 탭 추가 (TrendingUp 아이콘, path: `/buy-list`, label: `BUY조회` — 추천 탭 다음 위치, 6탭 레이아웃)
- [x] T003 [P] `frontend/src/App.tsx` PC 상단 헤더에 `BUY조회` 링크 추가 (`/buy-list`, cyan 색상 `text-cyan-400 hover:text-cyan-300`)
- [x] T004 [P] `frontend/src/api/client.ts`에 `fetchScanSymbols()` 함수 추가 (`GET /api/scan/symbols` → `r.data`)

**Checkpoint**: 브라우저에서 `/buy-list` 접근 시 404 대신 빈 페이지 표시, 탭/헤더 링크 클릭 가능

---

## Phase 2: Foundational (백엔드 API)

**Purpose**: US1 종목 목록의 데이터 소스 — 모든 US가 이 API에 의존

**⚠️ CRITICAL**: 이 Phase 완료 전까지 US1 구현 불가

- [x] T005 `backend/services/stock_master.py`에 `get_all_symbols()` async 함수 추가
  - `StockMaster` 전체를 `market_type`, `symbol` 순 정렬 조회
  - breakdown dict 집계: `kospi`(KOSPI+not etf), `kospi_etf`(KOSPI+etf), `kosdaq`, `nasdaq`, `nyse_etf`
  - 반환: `{"total": int, "breakdown": dict, "symbols": list[dict]}`
  - 각 symbol dict: `symbol, name, market, market_type, is_etf`
- [x] T006 `backend/routes/market_scan.py`에 `GET /scan/symbols` 엔드포인트 추가
  - `from services.stock_master import get_all_symbols` 후 반환
  - 인증 불필요 (공개 종목 정보)
  - stock_master 비어있을 때 graceful 반환: `{"total": 0, "breakdown": {모두 0}, "symbols": []}`

**Checkpoint**: `curl http://localhost:8000/api/scan/symbols | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['total'])"` → 3779 출력

---

## Phase 3: User Story 1 — 전체 스캔 대상 종목 목록 확인 (Priority: P1) 🎯 MVP

**Goal**: `/buy-list` 페이지에서 국내/미국 탭 + 카테고리별 종목 표 표시

**Independent Test**: `/buy-list` 접속 시 국내 탭에 코스피(934) / 코스피ETF(870) / 코스닥(1784), 미국 탭에 NASDAQ(107) / NYSE ETF(84) 종목 테이블 표시. 종목 행 클릭 시 `/:symbol?market=` 상세 페이지 이동.

### Implementation for User Story 1

- [x] T007 [US1] `frontend/src/pages/BuyList.tsx` 파일 생성 — 기본 뼈대
  - `useState`: `symbols`, `breakdown`, `loading`, `activeTab('KR'|'US')`
  - `useEffect` 마운트 시 `fetchScanSymbols()` 호출 → 상태 저장
  - 로딩 중: `Loader2` 스피너 중앙 표시
  - 데이터 없음: "종목 데이터를 불러오는 중..." 메시지

- [x] T008 [US1] `BuyList.tsx` 국내/미국 탭 UI 추가
  - 탭 버튼: `국내` / `미국` (activeTab 상태로 활성 스타일 `border-b-2 border-[var(--gold)]`)
  - `activeTab === 'KR'` 시 국내 섹션 렌더링, `'US'` 시 미국 섹션 렌더링

- [x] T009 [US1] `BuyList.tsx` 카테고리별 종목 테이블 구현
  - **국내 탭**: 3개 섹션 — `코스피 (N개)` / `코스피 ETF (N개)` / `코스닥 (N개)`
  - **미국 탭**: 2개 섹션 — `NASDAQ (N개)` / `NYSE ETF (N개)`
  - 각 섹션: 카테고리 헤더(종목수 포함) + 테이블(`#`, `종목코드`, `종목명`, `ETF` 뱃지)
  - symbols 배열을 `market_type + is_etf`로 필터링하여 각 섹션에 분배
  - 종목 행 클릭: `navigate(\`/${item.symbol}?market=${item.market_type}\`)`
  - 행 hover 스타일: `hover:bg-white/5 cursor-pointer`

**Checkpoint**: US1 완전 동작 — 페이지 로드 후 국내/미국 탭 전환 시 각 카테고리 종목 수 및 목록 확인 가능, 클릭 시 상세 이동

---

## Phase 4: User Story 2 — 종목 검색 (Priority: P2)

**Goal**: 검색창 입력 시 종목명/코드 실시간 필터링

**Independent Test**: 검색창에 "삼성" 입력 시 삼성 포함 종목만 표시. "AAPL" 입력 시 미국 탭 전환 없이 AAPL 행 필터링. 검색 초기화 시 전체 복원.

### Implementation for User Story 2

- [x] T010 [US2] `BuyList.tsx`에 검색 상태 및 UI 추가
  - `useState`: `searchQuery('')`
  - 검색창: `Search` 아이콘 + `<input autoComplete="new-password" placeholder="종목명 또는 코드 검색..." />`
  - 입력값 있을 때 X 버튼으로 초기화
  - `placeholder:text-slate-500 focus:border-blue-500/50 focus:outline-none` 스타일 적용

- [x] T011 [US2] `BuyList.tsx` 필터링 로직 추가
  - `useMemo` 사용: `searchQuery`가 바뀔 때만 재계산
  - `filteredSymbols = symbols.filter(s => s.name.includes(query) || s.symbol.toUpperCase().includes(query.toUpperCase()))`
  - 검색어가 있을 때 탭에 무관하게 전체 markets 대상 필터링 (국내+미국 모두 검색)
  - 결과 없을 때: "검색 결과가 없습니다" 메시지 표시
  - 테이블 렌더링은 `filteredSymbols`를 사용하도록 T009 로직 교체

**Checkpoint**: US2 완전 동작 — 검색어 입력과 동시에 필터링, 탭 전환 시 검색어 유지

---

## Phase 5: User Story 3 & 4 — 스캔 상황판 + 총 종목수 요약 (Priority: P3)

**Goal**: 페이지 상단에 (1) 총 스캔 종목수 배너, (2) 스캔 스케줄 9개 슬롯 상황판 표시

**Independent Test**: 상황판에 9개 슬롯(KR 7개 + US 2개) 표시. 오늘 완료된 스캔은 초록(✓), 진행중이면 주황 점멸, 예정은 회색. 요약 배너에 "총 3,779개 스캔 중 / 국내 3,588 / 미국 191" 표시.

### Implementation for User Story 3 & 4

- [x] T012 [US3] `frontend/src/api/client.ts` 확인 — `fetchFullScanHistory`, `fetchFullScanStatus` 이미 존재 확인 (추가 불필요)

- [x] T013 [US4] [P] `BuyList.tsx` 총 종목수 요약 배너 추가
  - `breakdown` 상태 기반 계산: `국내 = kospi + kospi_etf + kosdaq`, `미국 = nasdaq + nyse_etf`
  - 배너 레이아웃: `총 {total}개 스캔 중 | 국내 {kr}개 | 미국 {us}개`
  - 로딩 전: skeleton 또는 `-` 표시

- [x] T014 [US3] `BuyList.tsx` 스캔 상황판 상태 추가
  - `useState`: `scanHistory`, `scanStatus`
  - `useEffect` 마운트 시: `fetchFullScanHistory(20)` + `fetchFullScanStatus()` 병렬 호출 (`Promise.all`)
  - `scanStatus.running === true` 일 때 5초 폴링 (`setInterval` + cleanup)
  - SCAN_SCHEDULE 상수 정의 (9개 슬롯: KR 9:30~15:30, US 19:50/03:50)

- [x] T015 [US3] `BuyList.tsx` 스캔 슬롯 매핑 로직 구현
  - `buildScanSlots(history, status)` 유틸 함수:
    - history의 각 항목 `started_at`을 KST로 변환 → HH:mm 추출
    - SCAN_SCHEDULE 슬롯과 ±15분 범위 매칭
    - 매칭된 슬롯: `status='completed'`, `completedAt`, `scannedCount`, `buyCount` 채움
    - `scanStatus.running === true` 이면 현재 시각과 가장 가까운 미매칭 슬롯을 `status='running'`
    - 나머지: `status='pending'`
  - 반환: `ScanSlot[]` (9개)

- [x] T016 [US3] `BuyList.tsx` 스캔 상황판 UI 렌더링
  - 9개 슬롯 가로 스크롤 (`overflow-x-auto`, `flex gap-2`, `min-w-[80px]`)
  - 각 슬롯 카드:
    - **completed**: 초록 테두리 + ✓ CheckCircle + 완료 시각 + "BUY N개"
    - **running**: 주황 테두리 + animate-pulse RefreshCw + 진행률 or 경과 시간
    - **pending**: 회색 테두리 + Clock 아이콘 + 예정 시각
  - KR/US 슬롯 사이 구분선 또는 색상 뱃지로 시장 구분

**Checkpoint**: US3/US4 완전 동작 — 요약 배너 수치 확인, 오늘 실행된 스캔 슬롯에 완료 표시

---

## Phase 6: Polish

**Purpose**: 마무리 및 기존 페이지와 일관성 확보

- [x] T017 [P] `BuyList.tsx` 모바일 반응형 확인 — 테이블 가로 스크롤(`overflow-x-auto`), 상황판 슬롯 카드 크기 조정 (`min-w-[72px] md:min-w-[90px]`)
- [x] T018 [P] `frontend/src/App.tsx` `BuyList` import 추가 및 라우트 순서 검증 (`/buy-list`이 `/:symbol` 앞에 있는지 확인)
- [x] T019 백엔드 `ruff check backend/routes/market_scan.py backend/services/stock_master.py` 실행 후 lint 오류 수정
- [x] T020 [P] `frontend` `pnpm lint` 실행 후 TypeScript 타입 오류 수정 (특히 `BuyList.tsx` interface 정의)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 가능 — T001~T004 전부 병렬 실행 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 시작 (API 클라이언트 함수 T004 선행 필요)
- **Phase 3 (US1)**: Phase 2 완료 후 시작 (백엔드 API T005, T006 필요)
- **Phase 4 (US2)**: Phase 3 완료 후 시작 (BuyList.tsx T007~T009 선행 필요)
- **Phase 5 (US3/4)**: Phase 2 완료 후 Phase 3/4와 병렬 가능 (별도 API 사용)
- **Phase 6 (Polish)**: 모든 Phase 완료 후

### User Story Dependencies

- **US1 (P1)**: Phase 1 + Phase 2 완료 후 독립 구현 가능
- **US2 (P2)**: US1 완료 후 (동일 파일 BuyList.tsx 확장)
- **US3/US4 (P3)**: Phase 1 + Phase 2 완료 후 US1과 병렬 가능

### 파일별 작업 순서

| 파일 | 태스크 | 순서 |
|------|--------|------|
| `stock_master.py` | T005 | Phase 2 |
| `market_scan.py` | T006 | Phase 2 (T005 후) |
| `client.ts` | T004 | Phase 1 (병렬) |
| `App.tsx` | T001, T003, T018 | Phase 1 → Phase 6 |
| `BottomNav.tsx` | T002 | Phase 1 (병렬) |
| `BuyList.tsx` | T007→T009→T010→T011→T013→T014→T015→T016 | Phase 3→4→5 순차 |

---

## Parallel Execution Examples

### Phase 1 (전부 병렬)
```
Task: T001 App.tsx 라우트 추가
Task: T002 BottomNav.tsx 탭 추가
Task: T003 App.tsx 헤더 링크 추가
Task: T004 client.ts fetchScanSymbols 추가
```

### Phase 3 + Phase 5 일부 병렬
```
(Phase 3 진행 중 동시에)
Task: T013 BuyList.tsx 요약 배너 추가 [P — 별도 state]
Task: T014 BuyList.tsx 스캔 상태 fetch 로직 추가 [P — 별도 state]
```

---

## Implementation Strategy

### MVP (US1만)

1. Phase 1 완료 (T001~T004)
2. Phase 2 완료 (T005~T006)
3. Phase 3 완료 (T007~T009)
4. **검증**: `/buy-list` 접속 → 국내/미국 탭 + 전체 종목 테이블 표시 확인

### Full Delivery 순서

1. Phase 1 → Phase 2 → Phase 3 (MVP)
2. Phase 4 (검색)
3. Phase 5 (상황판 + 요약)
4. Phase 6 (polish)

**총 태스크**: 20개
**병렬 가능**: T001, T002, T003, T004 (Phase 1) + T013, T014 (Phase 5 일부)
