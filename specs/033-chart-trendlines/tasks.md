# Tasks: 차트 추세선 채널 및 추세 단계 패널

**Feature**: `033-chart-trendlines`  
**Branch**: `033-chart-trendlines`  
**Spec**: `specs/033-chart-trendlines/spec.md`  
**Plan**: `specs/033-chart-trendlines/plan.md`

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1/US2/US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup

**Purpose**: 기존 재사용 패턴 파악 — 구현 전 필수

- [x] T001 [P] `backend/services/trend_analysis.py` 읽기 — `_find_local_peaks`/`_find_local_troughs` 함수 시그니처, `_cache` 패턴(TTL 60s), `TrendLine` dict 응답 구조(`kind/start/end/style`), `asyncio.run(get_chart_data(...))` 호출 방식 파악
- [x] T002 [P] `backend/services/chart_cache.py` 첫 40줄 + `backend/indicators/volume.py` 전체 읽기 — `get_chart_data(symbol, market, timeframe, limit)` 반환 타입(DataFrame), `calculate_volume_ratio(df)` 윈도우(20) 및 반환값 파악
- [x] T003 [P] `frontend/src/components/charts/IndicatorChart.tsx` 전체 읽기 — `trendLines?: TrendLine[]` prop 처리 로직(useEffect), HistogramSeries per-bar color 구현(`c.close >= c.open ? 'rgba...'`), 현재 Props 인터페이스 전체 파악

**Checkpoint**: 3개 파일 패턴 파악 완료 → Foundational 시작 가능

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 백엔드 API + 프론트엔드 타입·API 함수 — 모든 User Story의 공통 기반

**⚠️ CRITICAL**: 이 Phase가 완료되어야 US1/US2/US3 구현 가능

- [x] T004 `backend/services/trendline_channels.py` 신규 생성 — Part 1: 스윙 포인트 감지 + 채널 빌더. `_find_swing_highs(arr, window=5)`, `_find_swing_lows(arr, window=5)` (trend_analysis.py의 rolling window 패턴 재사용), `_build_downtrend_channel(df, swing_highs)` (최근 2 고점 polyfit + 두 고점 사이 최저 저점으로 평행선), `_build_uptrend_channel(df, swing_lows)` (최근 2 저점 polyfit + 최고 고점으로 평행선). 각 함수는 `start_time/start_price/end_time/end_price/slope/intercept` dict 반환.

- [x] T005 `backend/services/trendline_channels.py` 수정 — Part 2: 5단계 판정 + 거래량 배율. `_detect_phase(df, down_ch, up_ch)` 함수: 전체 캔들 순방향 스캔으로 단계 1~5 완료 여부 판정(판정 기준: research.md 섹션 4), `_volume_ratio_at(df, idx)` (직전 5 거래일 비영 거래량 평균 대비), `PhaseStep` dataclass 반환.

- [x] T006 `backend/services/trendline_channels.py` 수정 — Part 3: 4기간 일괄 계산 진입점 + 60s 캐시. `analyze_all_periods(symbol, market)` async 함수: `get_chart_data(symbol, market, "1d", 260)` 호출 → df를 1m(22봉)/3m(66봉)/6m(130봉)/12m(252봉)으로 슬라이스 → 각 기간별 `_build_downtrend_channel` + `_build_uptrend_channel` + `_detect_phase` 호출 → 4기간 결과 dict 반환. `_cache: dict[tuple, tuple[float, dict]]` TTL=60s 패턴 적용. 응답 구조는 `contracts/trendline-channels.md` 준수.

- [x] T007 `backend/routes/trendline_channels.py` 신규 생성 — `GET /trendline-channels/{symbol}?market=KR` 엔드포인트. `asyncio.to_thread(analyze_all_periods, symbol, market)` 호출. 예외 시 빈 periods 반환(오류 전파 없음). tags=["trendline-channels"].

- [x] T008 `backend/routes/__init__.py` 수정 — `from routes.trendline_channels import router as trendline_channels_router` import 추가 + `api_router.include_router(trendline_channels_router)` 등록.

- [x] T009 `frontend/src/api/client.ts` 수정 — (1) 신규 타입 4개: `TrendChannelLine`, `TrendPhaseStep`, `TrendPeriodResult`, `TrendlineChannelsResponse` (data-model.md TypeScript 섹션 기준). (2) `fetchTrendlineChannels(symbol: string, market: string): Promise<TrendlineChannelsResponse>` 함수 추가. (3) `fetchQuickChart(symbol, market, timeframe?, limit?)` 시그니처에 선택적 `limit?: number` 파라미터 추가 — `api.get('/chart/quick', { params: { symbol, market, timeframe, limit } })`.

**Checkpoint**: `curl '/api/trendline-channels/005930?market=KR'` 호출 시 4기간 결과 반환 확인

---

## Phase 3: User Story 1 — 차트에 자동 추세선 표시 + 기간 탭 (Priority: P1) 🎯 MVP

**Goal**: 1·3·6·12개월 탭 전환으로 추세선 4선이 즉시 차트에 오버레이 표시

**Independent Test**: 브라우저에서 종목 상세 → 1M/3M/6M/12M 탭 전환 시 DevTools Network에서 추가 API 요청 없음 + 차트에 빨간/초록 채널 4선 표시 확인

### Implementation for User Story 1

- [x] T010 [P] [US1] `frontend/src/hooks/useTrendlineChannels.ts` 신규 생성 — `useTrendlineChannels(symbol: string, market: string)` hook. `useQuery({ queryKey: ['trendline-channels', symbol, market], queryFn: () => fetchTrendlineChannels(symbol, market), staleTime: 60_000, enabled: !!symbol })`. 반환: `{ data, isLoading, isError }`.

- [x] T011 [P] [US1] `frontend/src/components/charts/TrendPeriodTabs.tsx` 신규 생성 — `TrendPeriodTabs({ selected, onChange }: { selected: '1m'|'3m'|'6m'|'12m', onChange: (p: '1m'|'3m'|'6m'|'12m') => void })` 컴포넌트. 1M/3M/6M/12M 버튼 4개. 선택 버튼은 `background: 'var(--accent)'`, 미선택은 `var(--bg-2)`. 기존 프로젝트 버튼 스타일 적용.

- [x] T012 [US1] `frontend/src/components/charts/IndicatorChart.tsx` 수정 — Props에 `highlightedVolumeTimes?: number[]` + `visibleFromTs?: number` 추가. (1) `useEffect([highlightedVolumeTimes])`: volSeries.setData 재호출 시 해당 time의 color를 `'rgba(251,191,36,0.8)'`로 변경 (기존 상승/하락 색상 유지, 하이라이트 시간만 노랑). (2) `useEffect([visibleFromTs])`: `mainChartRef.current?.timeScale().setVisibleRange({ from: visibleFromTs, to: Math.floor(Date.now()/1000) })` 호출.

- [x] T013 [US1] `frontend/src/pages/SignalDetail.tsx` 수정 — (1) `selectedPeriod` state 추가(`useState<'1m'|'3m'|'6m'|'12m'>('3m')`). (2) `useTrendlineChannels(lookupSymbol, normalizedMarket)` hook 호출. (3) `fetchQuickChart(lookupSymbol, normalizedMarket, globalTf, 260)` — limit=260 전달. (4) 차트 컴포넌트 위에 `<TrendPeriodTabs selected={selectedPeriod} onChange={setSelectedPeriod} />` 삽입. (5) 현재 기간 데이터 계산: `const periodData = trendData?.periods[selectedPeriod]`. (6) `<IndicatorChart>` 에 `trendLines={periodData?.lines ?? []}` + `highlightedVolumeTimes={periodData?.phase.inflection_times ?? []}` + `visibleFromTs={periodFromTs(selectedPeriod)}` 전달. (7) `periodFromTs` 헬퍼: `'1m'→Date.now()/1000-30*86400` 등.

**Checkpoint**: 브라우저에서 탭 전환 시 네트워크 요청 없음 + 추세선 4선 즉시 변경 확인

---

## Phase 4: User Story 2 — 추세 단계 패널 표시 (Priority: P1)

**Goal**: 차트 바로 아래 스크롤 섹션에 5단계 진행 상태 + 거래량 배율 표시

**Independent Test**: 차트 아래 스크롤 시 "추세 전환 단계" 패널이 나타나고, 완료 단계에 ✓ + 거래량 배율, 미완료 단계에 ○ 표시 확인

### Implementation for User Story 2

- [x] T014 [US2] `frontend/src/components/charts/TrendPhasePanel.tsx` 신규 생성 — `TrendPhasePanel({ phase }: { phase: TrendPeriodResult['phase'] | undefined })` 컴포넌트. (1) `phase?.insufficient === true`: "분석 불가 — 데이터 부족" 메시지 카드 표시. (2) 정상 시: 헤더("추세 전환 단계 N/5"), 각 step 항목(stage, label, completed 여부 아이콘, volume_ratio). 완료(`completed=true`): 초록 ✓ 아이콘 + `"거래량 X.X×"` 배지. 현재 진행 단계(`current_stage`): 강조(border-left accent). 미완료: 회색 ○. `current_stage === 5`: "매수급소 완성 🎯" 배너 표시. 모바일: `overflow-x-auto` 스크롤 가능.

- [x] T015 [US2] `frontend/src/pages/SignalDetail.tsx` 수정 — `<TrendAnalysisCard>` 바로 아래에 `<TrendPhasePanel phase={periodData?.phase} />` 삽입.

**Checkpoint**: 단계 패널이 차트 분석 탭 내 차트 아래에 표시되고 5단계 중 현재 단계 강조 확인

---

## Phase 5: User Story 3 — 추세선 기준 가격 수치 표시 (Priority: P2)

**Goal**: 패널 각 단계 항목에 현재 추세선 연장 가격 표시 (예: "하락추세선 72,300원")

**Independent Test**: TrendPhasePanel 각 단계 항목 옆에 추세선 가격 숫자 표시 확인

### Implementation for User Story 3

- [x] T016 [US3] `backend/services/trendline_channels.py` 수정 — `PeriodResult`에 `current_line_prices: dict` 필드 추가. `analyze_all_periods` 내에서 각 채널의 `slope * today_ts + intercept` 계산으로 오늘 기준 가격 산출: `{ "downtrend_main": float|None, "downtrend_parallel": float|None, "uptrend_main": float|None, "uptrend_parallel": float|None }`. channels가 None이면 null.

- [x] T017 [US3] `frontend/src/api/client.ts` 수정 — `TrendPeriodResult` 인터페이스에 `current_line_prices: { downtrend_main: number|null, downtrend_parallel: number|null, uptrend_main: number|null, uptrend_parallel: number|null }` 필드 추가.

- [x] T018 [US3] `frontend/src/components/charts/TrendPhasePanel.tsx` 수정 — Props에 `currentLinePrices?: TrendPeriodResult['current_line_prices']` 추가. 각 단계 항목에 해당 추세선 현재 가격 표시: 단계 1·2·3 → `downtrend_main`/`downtrend_parallel` 가격, 단계 4·5 → `uptrend_main`/`uptrend_parallel` 가격. 시장별 포맷(`fmtPrice` 유틸 재사용). 이미 완료된 단계는 완료 시점 가격(`completed_price`)을 표시.

- [x] T019 [US3] `frontend/src/pages/SignalDetail.tsx` 수정 — `<TrendPhasePanel>` 에 `currentLinePrices={periodData?.current_line_prices}` prop 전달.

**Checkpoint**: 패널 각 단계에 추세선 가격 수치 표시 + 차트 시각 위치와 육안 대조 가능 확인

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T020 `frontend/` 디렉토리에서 `pnpm build` 실행 — TypeScript 컴파일 오류 없음 확인
- [ ] T021 quickstart.md 7개 시나리오 수동 브라우저 검증: (1) 추세선 4선 표시 (2) 기간 탭 전환 네트워크 요청 없음 (3) 단계 패널 5단계 표시 (4) 볼륨 하이라이트 노란 바 (5) 추세선 가격 수치 (6) 데이터 부족 메시지 (7) 모바일 레이아웃
- [x] T022 회귀 확인: 기존 차트 BUY/SELL 마커 정상 표시, TrendAnalysisCard(024) 정상, 스캔 페이지 정상 작동

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작 — T001·T002·T003 병렬 실행 가능
- **Foundational (Phase 2)**: Phase 1 완료 후 시작 — T004→T005→T006(순차, 같은 파일), T007·T008(T006 후 병렬 가능), T009(T007·T008 완료 후)
- **User Story 1 (Phase 3)**: T009 완료 후 시작 — T010·T011 병렬, T012 독립, T013은 T010·T011·T012 완료 후
- **User Story 2 (Phase 4)**: T009 완료 후 시작 가능 (US1과 병렬 불가 — SignalDetail.tsx 공유)
- **User Story 3 (Phase 5)**: US2(T014·T015) 완료 후 시작
- **Polish (Phase 6)**: 원하는 스토리 완료 후

### Within Foundational

```
T004 → T005 → T006 (순차, 같은 파일)
              T006 완료 후 → T007 [P], T008 [P]
              T007 + T008 완료 후 → T009
```

### Within User Story 1

```
T009 완료
  ├── T010 [P] (useTrendlineChannels hook)
  ├── T011 [P] (TrendPeriodTabs 컴포넌트)
  └── T012   (IndicatorChart 수정)
T010 + T011 + T012 완료 → T013 (SignalDetail.tsx 통합)
```

### Parallel Opportunities

- T001, T002, T003: 서로 다른 파일 읽기 → 병렬 실행 가능
- T007, T008: 서로 다른 파일(route vs __init__) → 병렬 실행 가능
- T010, T011, T012: 서로 다른 파일 → 병렬 실행 가능

---

## Parallel Example: Setup Phase

```bash
# T001, T002, T003은 병렬로 읽기 가능:
Task: "backend/services/trend_analysis.py 스윙 포인트 패턴 파악"
Task: "chart_cache.py + volume.py 재사용 패턴 파악"
Task: "IndicatorChart.tsx trendLines prop + HistogramSeries 파악"
```

---

## Implementation Strategy

### MVP (US1 단독 — 추세선 표시)

1. Phase 1: T001·T002·T003 병렬 실행
2. Phase 2: T004→T005→T006→T007/T008(병렬)→T009
3. Phase 3: T010/T011/T012(병렬)→T013
4. **STOP & VALIDATE**: 탭 전환 + 추세선 표시 확인
5. 이후 US2(패널), US3(가격) 순서로 추가

### 파일 변경 범위

| 파일 | 변경 유형 |
|------|----------|
| `backend/services/trendline_channels.py` | 신규 |
| `backend/routes/trendline_channels.py` | 신규 |
| `backend/routes/__init__.py` | 수정 (라우터 등록) |
| `frontend/src/api/client.ts` | 수정 (타입 + 함수) |
| `frontend/src/hooks/useTrendlineChannels.ts` | 신규 |
| `frontend/src/components/charts/TrendPeriodTabs.tsx` | 신규 |
| `frontend/src/components/charts/TrendPhasePanel.tsx` | 신규 |
| `frontend/src/components/charts/IndicatorChart.tsx` | 수정 (프롭 2개 추가) |
| `frontend/src/pages/SignalDetail.tsx` | 수정 (통합) |

**읽기 전용 재사용 (변경 없음)**:
- `frontend/src/components/charts/TrendLinesOverlay.tsx`
- `backend/services/trend_analysis.py`
- `backend/indicators/volume.py`

---

## Notes

- `backend/services/trendline_channels.py`는 `backend/services/trend_analysis.py`와 완전 독립 — 상호 import 없음
- `TrendLinesOverlay.tsx`는 기존 `TrendLine` 타입을 그대로 수신 → `TrendChannelLine`을 `TrendLine` 포맷으로 변환은 `TrendPeriodResult.lines`가 이미 처리
- `IndicatorChart.tsx`의 기존 `trendLines` prop은 현재 `TrendAnalysisCard`(024)에서 주입 — 033은 별도 채널 라인을 추가 prop으로 전달 (충돌 없음)
- `pnpm build` 전 브라우저에서 `pnpm dev`로 먼저 확인 권장
