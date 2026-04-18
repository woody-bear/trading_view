# Tasks: 종목 상세화면 2단 분석 뷰 (1차 차트 → 2차 가치)

**Input**: Design documents from `/specs/022-stock-detail-layered-analysis/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/company.openapi.yaml, quickstart.md

**Tests**: 본 스펙은 테스트를 명시 요청. 백엔드 단위/통합 테스트만 포함(프론트는 수동 + 회귀 시나리오 위주).

**Organization**: 사용자 스토리(US1·US2·US3)별 phase + Setup·Foundational·Polish phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 파일이 다르고 선행 미완료 의존이 없는 경우 병렬 실행 가능
- **[Story]**: US1(차트 1차 탭) / US2(가치 2차 탭) / US3(URL·뒤로가기)

## Path Conventions
풀스택 Web — `backend/`, `frontend/src/` 기준 (plan.md 구조 참조).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 본 기능 한정 디렉토리 골격 준비 (DB·env 변경 없음).

- [X] T001 [P] `frontend/src/components/value/` 디렉토리 생성 (가치 분석 카드용)
- [X] T002 [P] `frontend/src/styles/value-tab.css` 빈 파일 생성 (모바일 스냅 스크롤용)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 의존하는 자산군 판정 + 응답 계약.

**⚠️ CRITICAL**: 이 단계 완료 전 어떤 사용자 스토리도 구현 불가.

- [X] T003 [P] `backend/services/asset_class.py` 신설 — `AssetClass` Enum(STOCK_KR/STOCK_US/ETF/CRYPTO/INDEX/FX) + `classify(symbol: str, market: str) -> AssetClass`. ETF 마스터(`KR_ETF_SYMBOLS`, `US_ETF_TICKERS`)를 `scan_symbols_list.py`에서 import해 우선순위 트리 구현 (research.md R2 참조)
- [X] T004 [P] `backend/tests/unit/test_asset_class.py` 작성 — 6개 자산군 매핑 + 미식별 fallback 검증 (005930→STOCK_KR, AAPL→STOCK_US, 069500→ETF, SPY→ETF, BTC-USD→CRYPTO, 알수없는 시장→INDEX)
- [X] T005 `backend/routes/company.py` 수정 — 응답 dict에 (a) `"asset_class": classify(symbol, market).value`, (b) `"reporting_period"` 두 필드 추가. `reporting_period`는 `info.get("mostRecentQuarter")`(분기, "YYYY-Q#" 포맷)와 `info.get("lastFiscalYearEnd")`(연간, "YYYY-MM-DD") 중 최신값으로 추출, 결측 시 `null`. 미지원 자산군(ETF/CRYPTO/INDEX/FX)에서는 `metrics: None` + `reporting_period: None`로 단축 응답하되 `asset_class`·`cached_at`은 채움 (contracts/company.openapi.yaml 참조)
- [X] T006 `backend/tests/integration/test_company_endpoint.py` 작성 — 시나리오 4종 응답 검증: KR 주식(asset_class=STOCK_KR + metrics 채움 + reporting_period 존재), US 주식(STOCK_US + reporting_period), KR ETF(ETF + metrics=null + reporting_period=null), Crypto(CRYPTO + metrics=null). 모두 200 응답 보장
- [X] T007 [P] `frontend/src/types/company.ts` 수정 — `AssetClass` union 타입 + `CompanyResponse.asset_class` + `CompanyResponse.reporting_period: string | null` 필드 추가. `CompanyMetrics`에 currency 명시
- [X] T008 [P] `frontend/src/api/client.ts` 수정 — `getCompanyInfo` 반환 타입에 `asset_class`·`reporting_period` 추가 (T007 의존)

**Checkpoint**: 백엔드 응답에 `asset_class`가 전달되고, 프론트 타입이 정렬됨. 이제 US1/US2/US3 병렬 진행 가능.

---

## Phase 3: User Story 1 — 1차 차트 분석 탭 (Priority: P1) 🎯 MVP

**Goal**: 상세 진입 시 기본으로 노출되는 차트 분석 탭이 기존 동작과 100% 동일하게 작동.

**Independent Test**: 005930·AAPL 등으로 진입 시 차트·BB·RSI·MACD·스퀴즈·BUY/SELL 마커가 추가 클릭 없이 즉시 표시되며, 기간·민감도·지표 토글이 기존과 동일하게 동작 (FR-002, SC-001).

- [X] T009 [US1] `frontend/src/components/DetailTabs.tsx` 신설 — 탭 스트립 UI(차트/가치 라벨), `activeTab` prop·`onChange` 콜백, ETF/Crypto에서 가치 탭 disabled 스타일링. (스토리1에선 차트 탭 활성 표시만 사용)
- [X] T010 [US1] `frontend/src/pages/SignalDetail.tsx` 수정 — 상단에 `<DetailTabs>`를 sticky 배치하고, 기존 차트 트리 전체를 1차 탭 콘텐츠로 **그대로 래핑**(JSX 이동만, 로직 무변경). 회귀 방지를 위해 기존 컴포넌트·prop 이름 유지
- [X] T011 [P] [US1] `frontend/src/store/detailViewStore.ts` 신설 — Zustand 스토어, `byKey: Record<\`${market}:${symbol}\`, ChartUiState>`, `set()` 액션. data-model.md §4 시그니처
- [X] T012 [US1] SignalDetail의 차트 기간/지표 토글 핸들러를 `detailViewStore.set()`과 연결, 초기값은 스토어에서 읽어 복원 (FR-010 — 동일 세션 내 보존). 새로고침 시 휘발 (persist 미사용)

**Checkpoint US1**: 1차 탭 단독으로 기존 차트 분석이 회귀 없이 동작.

---

## Phase 4: User Story 2 — 2차 가치 분석 탭 (Priority: P1)

**Goal**: KR·US 개별주식에서 가치 분석 탭 클릭 시 시가총액·PER·PBR·ROE·EPS·배당수익률·섹터를 중요도 순으로 카드 표시. ETF·Crypto·지수·외환은 disabled + 안내.

**Independent Test**: 가치 탭 클릭 → KR·US 주식은 7개 카드 노출(SC-002, p95 1.5초), KR ETF·BTC-USD는 disabled 탭 + 툴팁/토스트 안내 (FR-003, FR-006).

- [X] T013 [P] [US2] `frontend/src/components/value/MetricCard.tsx` 신설 — props: `label, value, unit, helpText`. 결측 시 "—" 표시, 툴팁(FR-011), 카드 레이아웃 Tailwind 적용
- [X] T014 [P] [US2] `frontend/src/components/value/UnsupportedNotice.tsx` 신설 — PC=툴팁, 모바일=토스트(`useEffect`로 1회 노출). 문구 "ETF·암호화폐·지수·외환은 가치 분석 미지원입니다" (Q2)
- [X] T015 [US2] `frontend/src/components/ValueAnalysisTab.tsx` 신설 — `useQuery(['company', market, symbol], getCompanyInfo, { staleTime: 60*60*1000 })`. 응답 `asset_class`로 분기:
  - `STOCK_KR | STOCK_US` → metrics 6개 카드(중요도 순: 시총→PER→PBR→ROE→EPS→배당) + `company.sector` 카드 1개 = 총 7장 (FR-003, Q3, C4 정정)
  - 그 외 → `<UnsupportedNotice />` 렌더
  - 헤더에 **보고 기준일** = `reporting_period` (예: "2025-Q4 기준")을 메인 라벨로, **갱신 시각** = `cached_at`을 푸터 보조 영역에 작게 표기 (FR-007 분리)
  - 통화 표기: `metrics.currency`(KRW/USD)에 따라 시총·EPS 단위 자동 적용
  - 로딩 스켈레톤·에러 상태 처리 (Acceptance Scenario 2)
- [X] T016 [US2] `frontend/src/pages/SignalDetail.tsx`에 2차 탭 컨테이너 마운트 — `activeTab === 'value'`일 때만 `<ValueAnalysisTab market symbol />` 렌더(언마운트 시 React Query 캐시는 유지). 1차 탭 마운트 상태는 보존(`hidden` 토글 또는 CSS display) 하여 차트 재렌더 비용 회피
- [X] T017 [US2] `DetailTabs`의 가치 탭 disabled 처리 — 부모로부터 `assetClass`를 prop으로 받아 `STOCK_KR|STOCK_US`가 아니면 disabled. PC hover 툴팁 / 모바일 탭 시 onClick 핸들러로 토스트 트리거
- [X] T018 [P] [US2] `frontend/src/styles/value-tab.css` 작성 — `@media (max-width: 768px) { .value-tab-scroll { scroll-snap-type: y mandatory } .value-tab-section { scroll-snap-align: start } }`. PC는 일반 스크롤 (FR-012)
- [X] T019 [US2] `ValueAnalysisTab` 본문 컨테이너에 `.value-tab-scroll` 클래스, 각 카드(또는 카드 묶음)에 `.value-tab-section` 클래스 부여 (T018 의존). BottomNav 높이만큼 `padding-bottom` 적용해 마지막 카드 가림 방지 (FR-009)

**Checkpoint US2**: 가치 탭 단독으로 4종 시나리오(KR/US/ETF/Crypto)에서 의도된 UX 노출.

---

## Phase 5: User Story 3 — URL·뒤로가기 일관성 (Priority: P2)

**Goal**: 탭 전환 시 `?tab=chart|value` 쿼리 동기화, 뒤로가기로 이전 탭 복원, 딥링크로 직접 진입 가능.

**Independent Test**: 가치 탭 전환 후 URL에 `?tab=value` 표시, 새 탭에서 같은 URL 열면 가치 탭 활성, 뒤로가기로 차트 탭 복원 (FR-005, SC-005).

- [X] T020 [P] [US3] `frontend/src/hooks/useDetailTab.ts` 신설 — `useSearchParams` 기반 `[tab, setTab]` 반환. 잘못된 값/누락 → `'chart'` 폴백. 전환은 history `push`(뒤로가기 지원, research.md R5)
- [X] T021 [US3] `SignalDetail.tsx`에서 `useDetailTab()` 사용해 `<DetailTabs activeTab=... onChange=...>` 와 본문 분기 동기화 (T010·T020 의존)
- [X] T022 [US3] 탭 빠른 반복 클릭 안정화 — `ValueAnalysisTab`의 React Query는 동일 키이므로 자동으로 마지막 요청만 반영됨을 확인 (Edge Case "빠른 탭 반복 클릭"). `AbortController` 추가 작업 불필요 — 회귀 검증으로 처리

**Checkpoint US3**: URL 동기화·뒤로가기·딥링크 모두 동작.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T023 [P] `quickstart.md` §4 시나리오 4종 수동 실행 — 005930 / AAPL / 069500 / BTC-USD. 결과 스크린샷 또는 체크 결과를 PR 본문에 첨부
- [X] T024 [P] 모바일 검증 (DevTools mobile 또는 실기기) — 가치 탭 스냅 스크롤·BottomNav 비중첩·비활성 탭 토스트 (FR-009·FR-012·Q2)
- [X] T025 회귀 체크 — 1차 차트 탭에서 `rules/chart-buy-label.md`·`rules/chart-sell-label.md` 규칙대로 BUY/SELL 마커가 정확히 표시되는지 (변경 없음 확인). 차트 BUY 거래량 필터 동작도 기존과 동일 (메모리: feedback_chart_buy_volume_filter)
- [X] T026 SR-01~05 준수 — 백엔드 재시작(`uvicorn app:app --reload --host 0.0.0.0 --port 8000`) → 프론트 빌드(`pnpm build`) → 프론트 dev(`pnpm dev`). quickstart.md §2·§3·§7 절차 그대로

---

## Dependencies

```
Setup(T001-T002)
        │
Foundational(T003-T008)        ← T004 depends T003 ; T005 depends T003 ; T006 depends T005 ; T008 depends T007
        │
        ├─ US1(T009-T012)      ← T010 depends T009 ; T012 depends T011 & T010
        │
        ├─ US2(T013-T019)      ← T015 depends T008·T013·T014 ; T016 depends T010·T015 ; T017 depends T009·T016 ; T019 depends T018·T015
        │
        └─ US3(T020-T022)      ← T021 depends T010·T020 ; T022 depends T015·T021
                │
        Polish(T023-T026)      ← T026 마지막
```

스토리 간 독립성:
- US1 단독으로 MVP 가능 (기존 차트 회귀 방지가 핵심).
- US2는 US1 완료 후에만 의미 있음(탭 골격 필요) — Foundational + T009·T010이 선행.
- US3는 US1·US2 둘 다 필요.

## Parallel Execution Examples

**Foundational (T003·T004 / T007·T008 동시)**:
```
백엔드: T003 → T004 시작과 동시에, 별 트랙으로 T007·T008 진행 가능.
```

**US2 카드/안내 컴포넌트 동시**:
```
T013 (MetricCard) ‖ T014 (UnsupportedNotice) ‖ T018 (CSS) — 같은 디렉토리지만 파일 다름.
이후 T015 → T016 → T017 → T019 순.
```

**Polish 검증 동시**:
```
T023 (시나리오 검증) ‖ T024 (모바일 검증) — 다른 영역.
```

## Implementation Strategy (MVP-first)

1. **MVP 1차 릴리즈** (US1 only): Setup + Foundational + Phase3. 사용자에게 "탭 골격이 도입되었지만 기존 차트는 그대로"인 상태를 먼저 배포해 회귀 위험을 차단.
2. **2차 릴리즈** (US2 추가): 가치 탭 노출. KR·US 주식 사용자에게 즉시 가치 정보 제공.
3. **3차 릴리즈** (US3 추가): URL 동기화·딥링크·뒤로가기 — 공유 시나리오 강화.
4. **Polish 단계**: 회귀 시나리오 정밀 검증 + 서버 재시작 절차 준수.
