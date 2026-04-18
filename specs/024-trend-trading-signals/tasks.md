# Tasks: 주가 추세 기반 매매 타이밍 섹션 (차트 분석 화면)

**Input**: Design documents from `/specs/024-trend-trading-signals/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/trend-analysis.openapi.yaml, quickstart.md

**Tests**: 스펙(FR-013 격리 검증 + SC-002 분류 정확도)에서 명시 요청 → 단위·통합 테스트 포함.

**Organization**: US1(추세 분류) / US2(매수 후보) / US3(매도 후보) / US4(차트 오버레이) 단위 + Setup · Foundational · Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 파일 다르고 선행 의존 없을 때 병렬
- **[Story]**: US1(추세 분류) / US2(매수 후보) / US3(매도 후보) / US4(차트 오버레이)

## Path Conventions
풀스택 Web — `backend/`, `frontend/src/`. 기존 022·023 위에 얹는다.

---

## Phase 1: Setup

- [X] T001 [P] `backend/services/trend_analysis.py` 빈 모듈 생성 — `TrendType` Enum(uptrend/downtrend/sideways/triangle/unknown/insufficient_data), 상수(`WINDOW_SIZE=120`, `EPSILON=0.05`, `NEAR_PCT=2.0`, `CACHE_TTL=60`), 모듈 레벨 `_cache: dict` 선언
- [X] T002 [P] `backend/routes/trend_analysis.py` 빈 라우터 생성 — `APIRouter(tags=["trend-analysis"])`, `GET /trend-analysis/{symbol}` 스켈레톤(하드코딩 응답), `routes/__init__.py`에 라우터 등록
- [X] T003 [P] scipy `find_peaks` 가용성 확인 — `backend` venv에서 `import scipy.signal` 가능 여부 테스트. 없으면 `trend_analysis.py`에 롤링 윈도우 피크 검출 단순 헬퍼(`_find_local_peaks`) 작성 (research R1·R9)

---

## Phase 2: Foundational (Blocking)

**Purpose**: 모든 스토리가 의존하는 피크 검출 + 선형 회귀 알고리즘.

- [X] T004 `backend/services/trend_analysis.py`에 `_detect_peaks(closes: np.ndarray, window: int = 5) -> tuple[np.ndarray, np.ndarray]` 추가 — 고점 인덱스·저점 인덱스 배열 반환. scipy.find_peaks 사용 또는 T003 헬퍼 사용 (research R1·R3)
- [X] T005 `backend/services/trend_analysis.py`에 `_fit_line(indices: np.ndarray, values: np.ndarray) -> tuple[float, float]` 추가 — `np.polyfit(deg=1)` 래퍼. 기울기(slope)·절편(intercept) 반환
- [X] T006 `backend/services/trend_analysis.py`에 `_classify(closes: np.ndarray, high: np.ndarray, low: np.ndarray) -> dict` 추가 — 피크 검출 → 회귀 → 기울기 비교 → TrendType 분류 + slope_high/slope_low/confidence 포함 dict 반환 (research R1·R2)
- [X] T007 `backend/tests/unit/test_trend_analysis.py` 신설 — 인위적 시계열 fixture 4종으로 `_classify` 검증:
  - `_make_uptrend(n=120)`: 우상향 close → 기대: `uptrend`
  - `_make_downtrend(n=120)`: 우하향 → 기대: `downtrend`
  - `_make_sideways(n=120)`: 일정 범위 횡보 → 기대: `sideways`
  - `_make_triangle(n=120)`: 저점↑ + 고점↓ → 기대: `triangle`
  - `_make_short(n=50)`: 120봉 미만 → 기대: `insufficient_data`
  - `_make_noisy(n=120)`: 명확한 추세 없음 → 기대: `unknown`

**Checkpoint**: 분류 알고리즘 검증 완료. US1 진행 가능.

---

## Phase 3: US1 — 추세 자동 분류 + 시각화 (P1) 🎯 MVP

**Goal**: 차트 분석 탭에서 종목의 추세를 4종(또는 분류 불가)으로 자동 표시.

**Independent Test**: MU·AAPL·005930 등으로 차트 진입 시 "📈 상승추세" / "📉 하락추세" / "↔ 평행" / "▶ 삼각수렴" 라벨 노출.

- [X] T008 [US1] `backend/services/trend_analysis.py`에 `analyze(symbol: str, market: str) -> dict` 추가 — `chart_cache.get_chart_data(symbol, market, '1d', 200)` 호출 → 120봉 슬라이스 → `_classify` → 캐시 저장 → `TrendAnalysisResponse` dict 반환. 120봉 미만이면 `insufficient_data` 즉시 반환 (FR-007)
- [X] T009 [US1] `backend/routes/trend_analysis.py` 엔드포인트 본구현 — `await asyncio.to_thread(trend_analysis.analyze, symbol, market)` 호출, 200 응답. contracts/trend-analysis.openapi.yaml §200 스키마 준수
- [X] T010 [P] [US1] `backend/tests/integration/test_trend_endpoint.py` 신설 — monkeypatch로 `get_chart_data` 고정 → 응답 스키마·분류 type·data_insufficient 경로 3종 검증
- [X] T011 [P] [US1] `frontend/src/api/client.ts`에 `fetchTrendAnalysis(symbol: string, market: string)` + `TrendAnalysisResponse` 타입 추가 (data-model.md §8)
- [X] T012 [P] [US1] `frontend/src/hooks/useTrendAnalysis.ts` 신설 — React Query 래퍼 (`queryKey: ['trend-analysis', market, symbol]`, `staleTime: 5분`)
- [X] T013 [US1] `frontend/src/components/charts/TrendAnalysisCard.tsx` 신설 — 추세 라벨 섹션만 1차 구현:
  - `useTrendAnalysis(symbol, market)` 호출
  - 로딩 스켈레톤
  - 분류 결과에 따라 색·아이콘·라벨 표시 (FR-003 + Q5 색상)
  - `insufficient_data` / `unknown` → 전용 안내 문구 (FR-007·FR-008)
  - 하단에 면책 문구 1줄 (FR-012)
  - **매수·매도 블록은 빈 placeholder** (US2·US3에서 구현)
- [X] T014 [US1] `frontend/src/pages/SignalDetail.tsx` — EmaOnlyChart 직하단에 `<TrendAnalysisCard symbol market />` 마운트 (차트 분석 탭에서만, FR-010)

**Checkpoint US1**: 추세 라벨 MVP 동작 — 매수·매도는 아직 비어있음.

---

## Phase 4: US2 — 매수 후보 구간 표시 (P1)

**Goal**: 분류된 추세에 따라 매수 후보 가격·조건·상태 라벨 표시.

**Independent Test**: 상승추세 종목에서 "📍 매수 후보 구간 X원" 카드 노출, 하락 강추세에서 "🟡 관망".

- [X] T015 [US2] `backend/services/trend_analysis.py`에 `_compute_buy_signals(trend_type, slopes, lines, last_close) -> list[dict]` 추가 — research R4의 매수 매핑 테이블 구현. 하락추세 기울기 깊으면 `watch` 반환 (FR-004)
- [X] T016 [P] [US2] `backend/tests/unit/test_trend_analysis.py`에 `test_buy_signals_*` 4종 추가 — 각 추세별 매수 시그널 kind·price 검증
- [X] T017 [US2] `analyze()` 함수에 `_compute_buy_signals` 결과를 `buy_signals` 필드에 채우기
- [X] T018 [US2] `TrendAnalysisCard.tsx` — 매수 후보 블록 구현:
  - `buy_signals` 배열 순회 → 각 시그널에 대해 라벨(📍/🟡) + 가격 + 조건 텍스트 + 거리(%) 표시
  - `is_near=true`이면 배경 강조 (FR-011)
  - 빈 배열이면 블록 숨김

**Checkpoint US2**: 매수 후보 표시 완성.

---

## Phase 5: US3 — 매도 후보 구간 표시 (P1)

**Goal**: 분류된 추세에 따라 매도 1차·2차 가격·조건 표시.

**Independent Test**: 상승추세에서 "⚠️ 매도 후보 — 저항선 X원" + "⚠️ 강한 매도 후보 — 지지선 Y원 이탈 시" 노출.

- [X] T019 [US3] `backend/services/trend_analysis.py`에 `_compute_sell_signals(trend_type, slopes, lines, last_close) -> list[dict]` 추가 — research R4의 매도 매핑 테이블 구현 (FR-005)
- [X] T020 [P] [US3] `backend/tests/unit/test_trend_analysis.py`에 `test_sell_signals_*` 4종 추가
- [X] T021 [US3] `analyze()` 함수에 `_compute_sell_signals` 결과를 `sell_signals` 필드에 채우기
- [X] T022 [US3] `TrendAnalysisCard.tsx` — 매도 후보 블록 구현:
  - `sell_signals` 배열 순회 → ⚠️ 라벨 + 가격 + 조건 + 거리(%) + is_near 강조
  - 빈 배열이면 블록 숨김

**Checkpoint US3**: 매수 + 매도 양쪽 완성. 카드 UI 완전 동작.

---

## Phase 6: US4 — 차트 위 추세선·기준선 오버레이 (P2)

**Goal**: "추세선 표시" 토글 ON 시 메인 캔들 차트에 추세선 점선 오버레이.

**Independent Test**: 토글 ON → 상승추세 종목에 저점 지지선(초록 점선) + 고점 저항선(초록 점선) 나타남. OFF → 즉시 사라짐.

- [X] T023 [US4] `backend/services/trend_analysis.py`에 `_compute_trend_lines(trend_type, ...) -> list[dict]` 추가 — 피크 2점→LineSeries용 `{kind, start, end, style}` 반환. uptrend/downtrend=점선 초록·빨강, sideways=수평 파랑, triangle=수렴선 노랑 (research R8 스타일)
- [X] T024 [US4] `analyze()` 함수의 `lines` 필드에 채우기 (현재는 빈 배열 → 실제 데이터)
- [X] T025 [P] [US4] `frontend/src/stores/trendOverlayStore.ts` 신설 — Zustand `{ showLines: boolean; toggle: () => void }` (data-model §10, 기본 false, persist 미사용)
- [X] T026 [P] [US4] `frontend/src/components/charts/TrendLinesOverlay.tsx` 신설 — `TrendLine[]`을 받아 lightweight-charts `LineSeries`로 렌더. 배열 비면 아무것도 안 그림
- [X] T027 [US4] `frontend/src/components/charts/IndicatorChart.tsx` — `trendLines?: TrendLine[]` prop 추가. 있으면 `TrendLinesOverlay` 호출 (EMA/BB 추가 이후, BUY 마커 이전)
- [X] T028 [US4] `TrendAnalysisCard.tsx` — 우상단에 "추세선 표시" 토글 버튼 배치. `trendOverlayStore.toggle()` 연결. 토글 ON 시 `data.lines`를 `IndicatorChart`에 prop으로 전달 (SignalDetail.tsx에서 연결)
- [X] T029 [US4] `SignalDetail.tsx` — `trendOverlayStore.showLines` 읽어 `<IndicatorChart trendLines={showLines ? trendData.lines : []} />` 패턴으로 연결

**Checkpoint US4**: 토글 ON/OFF 동작, 추세선 오버레이 시각 확인.

---

## Phase 7: Polish & Cross-Cutting

- [X] T030 [P] 수동 시나리오 4종 (quickstart §6):
  1. MU (US 상승추세 기대) — 라벨 + 매수 + 매도 + 토글 ON/OFF
  2. AAPL (US 혼조/sideways 가능)
  3. 000660 SK하이닉스 (KR)
  4. 069500 KODEX 200 (KR ETF — 분류는 가능하나 가치 탭 미지원과 별개로 추세는 나와도 됨)
- [X] T031 [P] SC-002 육안 검증 — quickstart §8 스크립트로 KR·US 30종목 일괄 분류 결과 출력 후 차트와 비교. 80% 이상 일치
- [X] T032 FR-013 격리 검증 — `rg "(full_market_scanner|chart_buy|ScanSnapshot|rules/chart-buy|rules/chart-sell|buy_signal_alert|telegram)" backend/services/trend_analysis.py backend/routes/trend_analysis.py` → empty 결과 확인. 프론트 trend 파일에도 동일 검증
- [X] T033 회귀 체크 — 기존 차트 BUY/SELL 마커·가치 탭·대시보드 스캔 결과 동작 동일한지 시각 확인
- [X] T034 SR-01~05 준수 — cloudflared 보존 후 uvicorn 재시작 → `pnpm build` → `pnpm dev` → Cmd+Shift+R

---

## Dependencies

```
Setup(T001-T003)           모듈 뼈대 + scipy 확인
        │
Foundational(T004-T007)    피크 검출 + 회귀 + 분류 알고리즘 + 단위 테스트
        │
        ├─ US1(T008-T014)  추세 라벨 MVP (엔드포인트 + 프론트 카드)
        │       │
        │       ├─ US2(T015-T018)  매수 후보 (서비스 + 카드 블록)
        │       │       │
        │       │       └─ US3(T019-T022)  매도 후보 (서비스 + 카드 블록)
        │       │
        │       └─ US4(T023-T029)  오버레이 (서비스 lines + 토글 + 차트 주입)
        │              * US4는 US1 직후 병렬 가능 (매수·매도 없이 lines만)
        │
        └─ Polish(T030-T034)
```

스토리 간 독립성:
- **US1 단독으로 MVP** — 추세 라벨만으로도 사용자 가치 성립
- **US2·US3**는 US1 후 순차 (같은 카드 UI에 블록 추가)
- **US4**는 US1 직후 병렬 가능 (백엔드 lines 산출 + 프론트 오버레이는 매수·매도 구현과 독립)

## Parallel Execution Examples

**Setup**: T001 ‖ T002 ‖ T003 (모두 다른 파일)

**US1**: T010 (통합 테스트) ‖ T011 (API 타입) ‖ T012 (훅) — 같은 phase 내 다른 파일

**US2**: T016 (테스트) ‖ T018 (프론트) — 한 쪽 백엔드, 한 쪽 프론트

**US4 프론트**: T025 ‖ T026 (store / overlay 각각 별도 파일)

**Polish**: T030 ‖ T031 ‖ T032

## Implementation Strategy (MVP-first)

1. **1차 릴리즈 (US1)**: Setup + Foundational + Phase3 — 추세 라벨만. **14 tasks**. 사용자 체감 가치 가장 큰 지점.
2. **2차 릴리즈 (US2+US3)**: 매수·매도 후보 카드 추가. **8 tasks**. 카드 완전체.
3. **3차 릴리즈 (US4)**: 차트 오버레이 + 토글. **7 tasks**. UX 완성.
4. **Polish**: 30종목 육안 검증 + 격리 확인 + 회귀 + 재시작. **5 tasks**.
