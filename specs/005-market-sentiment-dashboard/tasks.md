# Tasks: 시장 방향성 대시보드 (Fear & Greed Index)

**Input**: Design documents from `/specs/005-market-sentiment-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested — test tasks are excluded.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Path Conventions

- **Backend**: `backend/` (Python 3.12, FastAPI)
- **Frontend**: `frontend/src/` (React 18, TypeScript, Tailwind CSS)

---

## Phase 1: Setup

**Purpose**: 라우터 등록 준비

- [x] T001 Register sentiment router in `backend/routes/__init__.py` — import and include `sentiment_router` with `api_router.include_router(sentiment_router)`

---

## Phase 2: User Story 1+2 — Fear & Greed 게이지 + 종합 지표 대시보드 (Priority: P1) 🎯 MVP

**Goal**: 메인화면에 합성 공포/탐욕 게이지(0~100) + VIX/코스피/S&P500/나스닥/환율 미니카드 + 시장 분위기 요약 표시

**Independent Test**: 메인화면에서 Fear & Greed 게이지와 5개 시장 지표가 정상 표시되는지 확인

### Implementation

- [x] T002 [US1] Create `backend/services/sentiment_analyzer.py` — implement `fetch_market_indices()` that fetches VIX(^VIX), KOSPI(^KS11), S&P500(^GSPC), NASDAQ(^IXIC), USD/KRW(USDKRW=X) via yfinance using `asyncio.to_thread()` pattern (same as forex_analyzer.py). Return dict with each index's current value, previous close, change, change_pct, direction
- [x] T003 [US1] Add `calculate_fear_greed(vix_value, sp500_change_pct, kospi_change_pct)` function in `backend/services/sentiment_analyzer.py` — VIX level to 0~100 score mapping (VIX>=35→5, 25~35→20, 18~25→40, 12~18→65, <=12→85) with S&P500 20-day return bonus (±10) and KOSPI bonus (±5), clamp to 0~100. Return `(score, label)` where label is "Extreme Fear"/"Fear"/"Neutral"/"Greed"/"Extreme Greed" (per research.md R-001)
- [x] T004 [US2] Add `determine_sentiment(fear_greed, sp500_pct, kospi_pct)` function in `backend/services/sentiment_analyzer.py` — return summary label: "위험 회피 분위기" if score<25 and any index<-1%, "낙관적 분위기" if score>60 and any index>0.5%, else "혼조세" (per research.md R-004)
- [x] T005 [US1] Add `get_sentiment_overview()` async function in `backend/services/sentiment_analyzer.py` — orchestrates fetch_market_indices + calculate_fear_greed + determine_sentiment, returns SentimentOverview dict matching contracts/sentiment-api.md response format
- [x] T006 [US1] Create `backend/routes/sentiment.py` — add `GET /api/sentiment/overview` endpoint calling `get_sentiment_overview()`, with try/except returning error response on failure (per contracts/sentiment-api.md)
- [x] T007 [P] [US1] Add `fetchSentiment` and `fetchSentimentHistory` API functions in `frontend/src/api/client.ts` — `GET /api/sentiment/overview` and `GET /api/sentiment/history`
- [x] T008 [US1] Create `frontend/src/components/SentimentPanel.tsx` — main component with: (1) Fear & Greed half-circle gauge (0~100, colored by label: red=fear, green=greed, gray=neutral) with numeric score and label text centered, (2) sentiment summary label below gauge ("낙관적 분위기" etc with color), (3) five mini cards in a row below for VIX/코스피/S&P500/나스닥/USD·KRW — each card shows name, value, change_pct with color+arrow (green up / red down), (4) "마지막 갱신: N분 전" timestamp at bottom right. Use `useQuery(['sentiment'], fetchSentiment)`. Mobile: 2-column grid for mini cards. (per spec FR-001~006, FR-012~014)
- [x] T009 [US1] Embed `<SentimentPanel />` in `frontend/src/pages/Dashboard.tsx` — place after search box, before watchlist section (per research.md R-003)

**Checkpoint**: 메인화면에 Fear & Greed 게이지 + 5개 지표 미니카드 + 분위기 요약 표시

---

## Phase 3: User Story 3 — Fear & Greed 30일 추이 차트 (Priority: P2)

**Goal**: Fear & Greed 게이지 아래에 30일 미니 라인차트 표시

**Independent Test**: 게이지 아래에 30일 추이 라인차트가 표시되는지 확인

### Implementation

- [x] T010 [US3] Add `get_fear_greed_history(days=30)` async function in `backend/services/sentiment_analyzer.py` — fetch VIX 30-day history via yfinance, calculate daily fear_greed score for each day, return `{ dates: [...], values: [...] }`
- [x] T011 [US3] Add `GET /api/sentiment/history` endpoint in `backend/routes/sentiment.py` — calls `get_fear_greed_history()`, returns dates + values arrays (per contracts/sentiment-api.md)
- [x] T012 [US3] Add mini line chart to SentimentPanel — below the gauge, render 30-day fear_greed trend using a simple SVG polyline or lightweight-charts mini chart (height ~60px). Highlight zones: red below 25, green above 75. Use `useQuery(['sentiment-history'], fetchSentimentHistory)` in `frontend/src/components/SentimentPanel.tsx`

**Checkpoint**: 게이지 아래 30일 추이 차트 표시

---

## Phase 4: User Story 4 — 데이터 자동 갱신 (Priority: P2)

**Goal**: 5분 간격 자동 갱신 + "마지막 갱신" 타임스탬프

**Independent Test**: 5분 후 지표 수치가 자동 갱신되는지 확인

### Implementation

- [x] T013 [US4] Add `refetchInterval: 300000` (5분) to sentiment useQuery in `frontend/src/components/SentimentPanel.tsx` — both overview and history queries. Show "마지막 갱신: N분 전" using `updated_at` field from API response, update every minute via setInterval

**Checkpoint**: 5분 간격 자동 갱신 + 타임스탬프 표시

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 에러 처리, 로딩 상태, 반응형 검증

- [x] T014 Add loading skeleton to SentimentPanel — show animated placeholder while data loads (gauge placeholder + 5 card placeholders) in `frontend/src/components/SentimentPanel.tsx`
- [x] T015 Add error state to SentimentPanel — on fetch failure show "시장 심리 데이터를 불러올 수 없습니다" message, retain last successful data if available in `frontend/src/components/SentimentPanel.tsx`
- [x] T016 Verify mobile responsive layout — mini cards should be 2-column grid on mobile, test at 375px width in `frontend/src/components/SentimentPanel.tsx`
- [x] T017 Run all quickstart.md test scenarios (7 items) — verify each passes manually

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Router registration — quick
- **US1+US2 (Phase 2)**: Backend + Frontend MVP — core feature
- **US3 (Phase 3)**: Depends on US1 (sentiment_analyzer exists)
- **US4 (Phase 4)**: Depends on US1 (SentimentPanel exists)
- **Polish (Phase 5)**: After all stories

### User Story Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (US1+US2: 게이지 + 지표 + 분위기) ← MVP
    ↓
Phase 3 (US3: 추이 차트)  ←→  Phase 4 (US4: 자동 갱신) [병렬 가능]
    ↓
Phase 5 (Polish)
```

### Parallel Opportunities

- **T007**: client.ts API 함수는 백엔드 완성 전에 미리 작성 가능
- **US3 + US4**: 서로 독립, 병렬 가능

---

## Implementation Strategy

### MVP First (US1+US2)

1. Phase 1: 라우터 등록
2. Phase 2: 백엔드 지표 조회 + 공포지수 계산 + API + 프론트 게이지/카드
3. **STOP and VALIDATE**: 메인화면에서 게이지 + 5개 카드 표시 확인

### Incremental Delivery

1. Setup + US1+US2 → 게이지 + 지표 카드 (MVP)
2. US3 → 30일 추이 차트
3. US4 → 5분 자동 갱신
4. Polish → 스켈레톤, 에러 처리, 반응형

---

## Notes

- US1(게이지)과 US2(종합 지표)는 같은 API/컴포넌트에서 구현되므로 하나의 Phase로 통합
- VIX 데이터는 미국 장 시간에만 갱신됨 — 한국 아침에는 전일 종가 표시
- 합성 공포지수는 "시장 변동성 지수"로 라벨링 (CNN F&G가 아님을 명확히)
- 추가 npm/pip 패키지 0개 — 기존 스택만 사용
