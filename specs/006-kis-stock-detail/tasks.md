# Tasks: 종목 상세화면 업그레이드 (KIS API)

**Input**: Design documents from `/specs/006-kis-stock-detail/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested — test tasks not included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in all descriptions

## Path Conventions

- **Backend**: `backend/services/`, `backend/routes/`
- **Frontend**: `frontend/src/components/`, `frontend/src/pages/`

---

## Phase 1: Setup

**Purpose**: 백엔드 KIS 클라이언트 확장 + 프론트엔드 API 클라이언트 추가

- [x] T001 `kis_client.py`에 `get_stock_detail()` 메서드 추가 — quote().indicator 필드(EPS, BPS, PER, PBR, 52주 고/저, 시가총액, 업종, 위험상태, 가격제한) 반환 + 5분 메모리 캐시 in `backend/services/kis_client.py`
- [x] T002 `kis_client.py`에 `get_orderbook()` 메서드 추가 — stock.orderbook()에서 매도/매수 호가 + 잔량 + 비율 반환 (캐시 없음) in `backend/services/kis_client.py`
- [x] T003 [P] `/api/stocks/{symbol}/detail` 엔드포인트 추가 — get_stock_detail() 호출, KIS 미연동 시 `{"status":"unavailable"}` 반환 in `backend/routes/prices.py`
- [x] T004 [P] `/api/stocks/{symbol}/orderbook` 엔드포인트 추가 — get_orderbook() 호출, KIS 미연동 시 graceful 처리 in `backend/routes/prices.py`
- [x] T005 프론트엔드 API 함수 추가 — `fetchStockDetail(symbol, market)`, `fetchOrderbook(symbol, market)` in `frontend/src/api/client.ts`

**Checkpoint**: API 엔드포인트가 동작하고, `curl`로 투자지표/호가 데이터 확인 가능

---

## Phase 2: User Story 1 — 기본 투자지표 확인 (Priority: P1) 🎯 MVP

**Goal**: 한국 주식 상세화면에서 PER, PBR, EPS, BPS, 시가총액, 업종을 표시

**Independent Test**: 한국 종목 상세화면 진입 → 차트 아래 투자지표 카드 6개 표시 확인, KIS 미연동 시 안내 메시지 확인

### Implementation

- [x] T006 [US1] `StockFundamentals.tsx` 컴포넌트 생성 — PER/PBR/EPS/BPS 카드 + 시가총액 + 업종 표시, KIS 미연동 시 "미연동" 안내 in `frontend/src/components/StockFundamentals.tsx`
- [x] T007 [US1] `SignalDetail.tsx`에 StockFundamentals 컴포넌트 통합 — 차트 아래, 기존 지표 섹션 위에 배치. 한국/미국만 표시, 암호화폐 숨김 in `frontend/src/pages/SignalDetail.tsx`

**Checkpoint**: 한국 종목 상세화면에서 투자지표 6개가 1초 이내 표시

---

## Phase 3: User Story 2 — 52주 고가/저가 현재 위치 확인 (Priority: P1)

**Goal**: 52주 범위에서 현재가 위치를 시각적 바로 표시

**Independent Test**: 종목 상세화면에서 52주 범위 progress bar 표시, 저점 근처 시 강조 라벨 확인

### Implementation

- [x] T008 [US2] `StockFundamentals.tsx`에 52주 범위 바 추가 — 최고/최저가 + 날짜 + 현재가 위치 progress bar + 저점/고점 근처 강조 라벨 in `frontend/src/components/StockFundamentals.tsx`

**Checkpoint**: 52주 범위와 현재가 위치가 시각적으로 즉시 파악 가능

---

## Phase 4: User Story 3 — 매도/매수 호가창 확인 (Priority: P2)

**Goal**: 실시간 매도/매수 호가 5단계 + 잔량 비율 시각화

**Independent Test**: 장 중 한국 종목 상세화면에서 호가 10단계 + 매수/매도 잔량 바 + 우세 라벨 확인

### Implementation

- [x] T009 [US3] `OrderbookPanel.tsx` 컴포넌트 생성 — 매도 5호가(빨간) + 매수 5호가(파란) + 잔량 바 + 총잔량 비율 + "매수 우세"/"매도 우세" 라벨 + 장 마감 시 안내 in `frontend/src/components/OrderbookPanel.tsx`
- [x] T010 [US3] `SignalDetail.tsx`에 OrderbookPanel 통합 — StockFundamentals 아래 배치. 한국 주식만 표시, 미국/암호화폐 숨김 in `frontend/src/pages/SignalDetail.tsx`

**Checkpoint**: 장 중 호가 데이터가 표시되고 매수/매도 비율이 시각화됨

---

## Phase 5: User Story 4 — 투자 위험 경고 표시 (Priority: P2)

**Goal**: 매매정지, 과열종목, 투자경고/위험/주의 상태 경고 배너

**Independent Test**: 매매정지/투자경고 종목 진입 시 상단 경고 배너 확인, 정상 종목은 배너 없음

### Implementation

- [x] T011 [US4] `RiskWarningBanner.tsx` 컴포넌트 생성 — halt=빨간(매매정지), overbought=주황(과열종목), risk=caution(주의)/warning(경고)/risk(위험) 배너. 정상 시 숨김 in `frontend/src/components/RiskWarningBanner.tsx`
- [x] T012 [US4] `SignalDetail.tsx`에 RiskWarningBanner 통합 — 차트 바로 위에 배치. StockDetail 응답의 halt/overbought/risk 값 사용 in `frontend/src/pages/SignalDetail.tsx`

**Checkpoint**: 매매정지/과열/경고 종목에서 해당 배너 표시, 정상 종목은 배너 없음

---

## Phase 6: User Story 5 — 가격제한 정보 표시 (Priority: P3)

**Goal**: 상한가/하한가/기준가 표시

**Independent Test**: 한국 종목 상세화면에서 기준가/상한가/하한가가 표시되고, 상한가 근접 시 강조

### Implementation

- [x] T013 [US5] `StockFundamentals.tsx`에 가격제한 영역 추가 — 기준가, 상한가, 하한가 표시. 현재가가 상한가 90% 이상이면 "상한가 근접" 강조 in `frontend/src/components/StockFundamentals.tsx`

**Checkpoint**: 한국 종목 상세화면에서 가격제한 정보 정상 표시

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 통합 테스트, 빌드, 문서

- [x] T014 프론트엔드 빌드 및 TypeScript 검증 — `pnpm build` + `tsc --noEmit` 통과 확인 in `frontend/`
- [x] T015 [P] 백엔드 lint 검증 — `ruff check .` 통과 확인 in `backend/`
- [x] T016 통합 검증 — 한국/미국/암호화폐 종목 각각 상세화면 진입 후 정상 동작 확인 (quickstart.md 기준)
- [x] T017 전체시장스캔조건.md 문서 업데이트 — KIS 종목 상세 확장 내용 반영 in `.claude/docs/전체시장스캔조건.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (US1)**: Depends on T001, T003, T005
- **Phase 3 (US2)**: Depends on Phase 2 (같은 컴포넌트 확장)
- **Phase 4 (US3)**: Depends on T002, T004, T005 — 별도 컴포넌트라 US1과 병렬 가능
- **Phase 5 (US4)**: Depends on Phase 2 (StockDetail 응답 필요)
- **Phase 6 (US5)**: Depends on Phase 2 (같은 컴포넌트 확장)
- **Phase 7 (Polish)**: Depends on all desired user stories

### User Story Dependencies

- **US1 (투자지표)**: Setup 완료 후 즉시 시작 가능
- **US2 (52주 범위)**: US1과 같은 컴포넌트 → US1 이후 순차
- **US3 (호가창)**: 별도 컴포넌트 → US1과 병렬 가능
- **US4 (위험경고)**: 별도 컴포넌트 → US1과 병렬 가능
- **US5 (가격제한)**: US1 컴포넌트 확장 → US2 이후 순차

### Parallel Opportunities

```
Phase 1: T003 [P] + T004 [P] (서로 다른 엔드포인트)
Phase 2+4: US1(T006~T007) || US3(T009~T010) || US4(T011~T012) (서로 다른 컴포넌트)
Phase 7: T014 [P] + T015 [P] (프론트/백 독립)
```

---

## Parallel Example: Phase 1

```bash
# Backend endpoints (different route handlers):
Task: T003 "/api/stocks/{symbol}/detail endpoint in backend/routes/prices.py"
Task: T004 "/api/stocks/{symbol}/orderbook endpoint in backend/routes/prices.py"

# After Phase 1, these stories can run in parallel:
Task: T006-T007 "US1: StockFundamentals"
Task: T009-T010 "US3: OrderbookPanel"
Task: T011-T012 "US4: RiskWarningBanner"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Phase 1: Setup (T001~T005)
2. Phase 2: 투자지표 표시 (T006~T007)
3. Phase 3: 52주 범위 바 (T008)
4. **STOP and VALIDATE**: 종목 상세화면에서 PER/PBR/EPS/BPS/52주 확인
5. Deploy/demo if ready

### Full Delivery

1. MVP + Phase 4 (호가창) + Phase 5 (위험경고) + Phase 6 (가격제한)
2. Phase 7: Polish

---

## Notes

- KIS API 키 없으면 모든 KIS 관련 UI가 graceful하게 숨겨짐
- 암호화폐 종목은 KIS 패널 전체 미표시
- 투자지표 5분 캐시로 KIS API 부하 최소화
- 기존 차트/지표 기능에 영향 없음 — 독립적 컴포넌트 추가 방식
