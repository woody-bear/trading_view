# Tasks: 종목 상세 — 투자 지표 및 회사 정보 패널

**Input**: `specs/018-stock-detail-info/` (plan.md, spec.md, data-model.md, contracts/api.md)  
**Branch**: `018-stock-detail-info`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일, 의존성 없음 → 병렬 실행 가능
- **[Story]**: 해당 User Story (US1, US2, US3)
- 각 파일 경로 명시

---

## Phase 1: Setup

**Purpose**: 신규 파일 생성 전 환경 확인. 이 기능은 DB 마이그레이션 없음.

- [x] T001 `backend/app.py`에서 라우터 등록 위치(include_router 목록) 확인 후 `company` 라우터 등록 라인 추가

---

## Phase 2: Foundational — Backend API

**Purpose**: 프론트엔드 3개 컴포넌트 모두가 의존하는 API 엔드포인트. 이 Phase 완료 전에는 어떤 US도 구현 불가.

**⚠️ CRITICAL**: T002 완료 후 T003 실행 (라우터 등록 → 서버 재시작 → API 테스트)

- [x] T002 `backend/routes/company.py` 신규 생성 — `GET /api/company/{symbol}?market=` 엔드포인트 구현:
  - 모듈 레벨 캐시 `_cache: dict` + `_CACHE_TTL = 3600` (financials.py 동일 패턴)
  - `_fetch_company(symbol, market)` 내부 함수: CRYPTO → null 즉시 반환 / 티커 포맷(.KS/.KQ/direct) / `yf.Ticker(t).info` 조회 / CompanyInfo + InvestmentMetrics 추출 (소수형 지표 `×100` % 변환, dividendYield 0→None) / `t.revenue_by_product` DataFrame → RevenueSegment 목록(없으면 None) / 전체 try/except → null 반환
  - `@router.get("/company/{symbol}")` async 핸들러: 캐시 확인 → `asyncio.to_thread(_fetch_company)` → 캐시 저장 → 반환
  - 응답 shape: `{"company": {...}|null, "metrics": {...}|null, "revenue_segments": [...]|null, "cached_at": str|null}`

- [x] T003 [P] `frontend/src/api/client.ts`에 `fetchCompanyInfo` 함수 추가:
  ```ts
  export const fetchCompanyInfo = (symbol: string, market: string) =>
    api.get(`/company/${symbol}`, { params: { market } }).then(r => r.data)
  ```
  + TypeScript 타입 인터페이스 추가 (`CompanyInfo`, `InvestmentMetrics`, `RevenueSegment`, `CompanyInfoResponse`)

**Checkpoint**: `curl "http://localhost:8000/api/company/AAPL?market=US"` 응답 확인 후 US3 시작 가능

---

## Phase 3: User Story 1 — 회사 정보 섹션 (Priority: P1) 🎯

**Goal**: 종목 상세에서 회사 로고/아바타·사업 개요·업종·섹터 표시

**Independent Test**: KIS 미설정 환경에서 AAPL 상세 페이지 접속 → 회사 정보 카드가 FinancialChart 아래에 표시되는지 확인. 암호화폐(BTC-USD) 접속 시 섹션 미표시 확인.

- [x] T004 [US1] `frontend/src/components/CompanyInfoPanel.tsx` 신규 생성:
  - Props: `{ symbol: string, market: string }`
  - `market === 'CRYPTO'` → `return null`
  - `useQuery({ queryKey: ['company-info', symbol, market], queryFn: () => fetchCompanyInfo(symbol, market), staleTime: 3600000 })`
  - 로딩 중: 스켈레톤 3줄 (`animate-pulse bg-[var(--border)] rounded`)
  - 데이터 없음(`company === null`) → `return null`
  - **로고**: `<img src={logo_url} onError={() => setLogoError(true)} />` → `logoError || !logo_url` 시 첫 글자 원형 아바타 (`bg-blue-600 rounded-full w-10 h-10 flex items-center justify-center text-white font-bold`)
  - **사업 개요**: `line-clamp-4` 기본, "더 보기" 버튼 클릭 시 `line-clamp-none` 토글 (4줄 초과 시에만 버튼 표시)
  - **업종·섹터 뱃지**: `text-[10px] bg-[var(--bg)] px-2 py-0.5 rounded`
  - **직원 수·웹사이트**: US 종목만 표시 (`isUS && employees`)
  - **모바일 아코디언**: `useState(false)` expanded, `md:hidden` wrapper + `hidden md:block` always-visible PC version
  - 카드 스타일: `bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3 mb-4`

- [x] T005 [US1] `frontend/src/pages/SignalDetail.tsx` 수정 — CompanyInfoPanel import 후 `<FinancialChart ... />` 바로 아래 줄에 `<CompanyInfoPanel symbol={lookupSymbol} market={s.market} />` 삽입

---

## Phase 4: User Story 2 — 확장 투자 지표 (Priority: P1)

**Goal**: PER·PBR·ROE·ROA·EPS·BPS·배당수익률·시가총액·영업이익률·부채비율 10개 지표 카드 표시. KIS 미설정 환경에서도 동작.

**Independent Test**: KIS 미설정 환경에서 AAPL 상세 → 투자 지표 10개 카드가 표시되는지 확인. PER < 10 종목에서 "저평가" 강조 표시 확인. null 지표에서 "-" 표시되고 레이아웃이 깨지지 않는지 확인.

- [x] T006 [P] [US2] `frontend/src/components/InvestmentMetricsPanel.tsx` 신규 생성:
  - Props: `{ symbol: string, market: string }`
  - `market === 'CRYPTO'` → `return null`
  - 동일 queryKey `['company-info', symbol, market]`로 React Query 캐시 공유 (추가 네트워크 요청 없음)
  - `metrics === null` → `return null`
  - **지표 카드 그리드**: `grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-3`
  - **표시 지표 10개**: PER(TTM), PBR, ROE(%), ROA(%), EPS(TTM), BPS, 배당수익률(%), 시가총액, 영업이익률(%), 부채비율
  - **단위**: 배(PER·PBR·부채비율), %(ROE·ROA·배당·영업이익률), 원/$(EPS·BPS), 억/조(시가총액, KRW는 `fmtKRW`, USD는 `fmtUSD`)
  - **강조 표시** (FR-007):
    - PER < 10 → `text-blue-400 bg-blue-500/10` + "저평가" 라벨
    - PER > 30 → `text-red-400 bg-red-500/10` + "고평가" 라벨
    - ROE > 15 → `text-green-400`
    - 배당수익률 > 3 → `text-yellow-400`
  - null 값 → `"-"` (레이아웃 유지)
  - 섹션 헤더: `text-xs text-[var(--muted)] mb-2` + "투자 지표 (TTM)" 라벨
  - 카드 스타일: `bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3 mb-4`

- [x] T007 [US2] `frontend/src/pages/SignalDetail.tsx` 수정 — InvestmentMetricsPanel import 후 `<CompanyInfoPanel ... />` 아래 줄에 `<InvestmentMetricsPanel symbol={lookupSymbol} market={s.market} />` 삽입

---

## Phase 5: User Story 3 — 매출 구성 도넛 차트 (Priority: P2)

**Goal**: 세그먼트별 매출 비중 도넛 차트 표시 (데이터 있는 US 대형주만)

**Independent Test**: AAPL 또는 MSFT 상세 페이지에서 매출 구성 도넛 차트와 범례 표시 확인. 데이터 없는 종목에서 섹션 미표시 확인. 기준 날짜("YYYY.MM 기준") 표시 확인.

- [x] T008 [P] [US3] `frontend/src/components/RevenueSegmentChart.tsx` 신규 생성:
  - Props: `{ symbol: string, market: string }`
  - `market === 'CRYPTO'` → `return null`
  - 동일 queryKey `['company-info', symbol, market]`로 React Query 캐시 공유
  - `!revenue_segments || revenue_segments.length === 0` → `return null`
  - **SVG 도넛 차트**: `viewBox="0 0 100 100"`, 반지름 35, 중앙 (50,50)
    - 각 세그먼트: `<circle cx="50" cy="50" r="35" fill="none" strokeWidth="12" strokeDasharray="..." strokeDashoffset="..." />`
    - 색상 팔레트: `['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4']` (인덱스 순환)
  - **범례**: 세그먼트명 + 비중(%) — `grid grid-cols-2 gap-1 text-[11px]`
  - **기준 날짜**: 차트 하단 `text-[9px] text-[var(--muted)]` — "YYYY.MM 기준"
  - 카드 스타일: `bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3 mb-4`

- [x] T009 [US3] `frontend/src/pages/SignalDetail.tsx` 수정 — RevenueSegmentChart import 후 `<InvestmentMetricsPanel ... />` 아래 줄에 `<RevenueSegmentChart symbol={lookupSymbol} market={s.market} />` 삽입

---

## Phase 6: Polish & 검증

- [x] T010 [P] `backend/routes/company.py` 빌드 검증 — 서버 시작 후 엔드포인트 동작 확인:
  - `AAPL?market=US` — company·metrics·revenue_segments 모두 채워지는지
  - `005930?market=KOSPI` — company·metrics 일부 필드, revenue_segments null
  - `BTC-USD?market=CRYPTO` — 즉시 null 반환
  - 동일 symbol 재요청 → `cached_at` 동일 (캐시 동작 확인)

- [x] T011 [P] `frontend/` pnpm build 실행 후 빌드 에러 없음 확인. TypeScript 타입 오류 수정.

- [ ] T012 모바일(375px) 화면에서 CompanyInfoPanel 아코디언 동작 확인:
  - 기본 접힘 상태 → 헤더 탭 → 펼쳐짐
  - PC(1280px)에서 항상 표시 확인

---

## Dependencies (완료 순서)

```
T001 → T002 → T003 (병렬 가능)
T002, T003 완료 후 → T004, T006, T008 (병렬 가능)
T004 → T005
T006 → T007
T008 → T009
T005, T007, T009 완료 후 → T010, T011, T012
```

---

## Parallel Execution Examples

**Phase 2 병렬 가능**:
- T002 (backend company.py) + T003 (frontend client.ts) — 다른 파일, 독립적

**Phase 3+4+5 병렬 가능** (T002, T003 완료 후):
- T004 (CompanyInfoPanel) + T006 (InvestmentMetricsPanel) + T008 (RevenueSegmentChart) — 각기 다른 파일

**Phase 6 병렬 가능**:
- T010 (backend 검증) + T011 (frontend 빌드) — 독립적

---

## Implementation Strategy

| 단계 | 범위 | 검증 방법 |
|------|------|----------|
| **MVP** | T001→T005 (US1 완료) | AAPL 상세에서 회사 정보 카드 표시 |
| **+ US2** | T006→T007 | 투자 지표 10개 카드 + 저/고평가 강조 |
| **+ US3** | T008→T009 | AAPL 매출 구성 도넛 차트 |
| **완료** | T010→T012 | 빌드 통과 + 모바일 아코디언 |

---

## Task Summary

| Phase | Tasks | Story | Parallel |
|-------|-------|-------|----------|
| Setup | T001 | — | — |
| Foundational | T002, T003 | — | T003 [P] |
| US1 회사 정보 | T004, T005 | US1 | T004 [P] |
| US2 투자 지표 | T006, T007 | US2 | T006 [P] |
| US3 매출 구성 | T008, T009 | US3 | T008 [P] |
| Polish | T010, T011, T012 | — | T010, T011 [P] |
| **합계** | **12** | | |
