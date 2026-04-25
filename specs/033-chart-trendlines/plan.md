# Implementation Plan: 차트 추세선 및 추세 단계 패널

**Branch**: `033-chart-trendlines` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)

---

## Summary

일봉 차트에 하락채널(하락추세선+평행선)·상승채널(상승추세선+평행선) 총 4선을 자동 계산·오버레이하고, 1·3·6·12개월 기간 탭으로 즉시 전환(재요청 없음), 추세 5단계 전환 패널(단계별 거래량 배율)을 차트 하단에 표시한다. 기존 024-trend-trading-signals와 완전 격리된 새 백엔드 서비스로 구현한다.

---

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5 / React 18 (frontend)  
**Primary Dependencies**: FastAPI, numpy, pandas (backend) · lightweight-charts, React Query, Zustand (frontend)  
**Storage**: 신규 DB 테이블 없음. 서버 in-memory 캐시 60s TTL + React Query staleTime 60s  
**Testing**: 수동 브라우저 검증 (기존 프로젝트 패턴)  
**Target Platform**: Web (PC + Mobile)  
**Project Type**: Web application (기존 FastAPI + React 풀스택)  
**Performance Goals**: 차트 로드 후 추세선 3초 이내 표시, 탭 전환 1초 이내  
**Constraints**: 기존 스캔·BUY 신호·rules/ 파일 변경 금지 (완전 격리)  
**Scale/Scope**: 단일 종목 상세 화면 on-demand 계산

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| R-01 한 번에 하나의 관심사 | ✅ | 추세선 채널 계산만 — 스캔·신호 로직 미접촉 |
| R-06 기존 유틸리티 재사용 | ✅ | `_find_local_peaks` 패턴, `get_chart_data`, `TrendLine` 타입, `TrendLinesOverlay` 컴포넌트 재사용 |
| R-08 타입 힌트/정의 | ✅ | Python 타입 힌트, TypeScript 인터페이스 모두 적용 |
| FE-01 단일 책임 | ✅ | TrendPeriodTabs / TrendPhasePanel 분리 |
| FE-02 서버 상태 → React Query | ✅ | useTrendlineChannels hook |
| FE-03 API 호출 client.ts 집중 | ✅ | fetchTrendlineChannels → client.ts |
| DB-01 신규 테이블 없음 | ✅ | in-memory cache만 사용 |
| rules/ 파일 미접촉 | ✅ | scan-symbols.md / chart-buy-label.md 완전 격리 |

---

## Project Structure

### Documentation (this feature)

```text
specs/033-chart-trendlines/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   └── trendline-channels.md
└── tasks.md             ← /speckit.tasks output
```

### Source Code

```text
backend/
├── routes/
│   ├── __init__.py              (수정: trendline_channels_router 등록)
│   └── trendline_channels.py    (신규)
├── services/
│   └── trendline_channels.py    (신규)
└── indicators/
    └── volume.py                (읽기전용 재사용: calculate_volume_ratio)

frontend/src/
├── api/
│   └── client.ts                (수정: 새 타입 + fetchTrendlineChannels + fetchQuickChart limit 파라미터)
├── hooks/
│   └── useTrendlineChannels.ts  (신규)
├── components/charts/
│   ├── IndicatorChart.tsx       (수정: highlightedVolumeTimes + visibleRange 프롭 추가)
│   ├── TrendPeriodTabs.tsx      (신규)
│   ├── TrendPhasePanel.tsx      (신규)
│   └── TrendLinesOverlay.tsx    (읽기전용 재사용: 변경 없음)
└── pages/
    └── SignalDetail.tsx         (수정: period state + hooks + 컴포넌트 조합)
```

---

## Architecture Decisions

### 1. 백엔드 격리 전략 (024 패턴 준수)

- 신규 서비스 파일 `services/trendline_channels.py` 독립 생성
- 기존 `services/trend_analysis.py` 변경 없음
- 신규 라우터 `routes/trendline_channels.py` → `__init__.py`에만 등록

### 2. 4기간 일괄 반환 전략

- 단일 API 호출로 1m·3m·6m·12m 전부 반환
- 서버에서 260봉 df를 period별로 슬라이스하여 각 기간의 채널·단계 계산
- 프론트엔드: 응답 캐시 후 탭 전환 시 메모리에서 참조 → 네트워크 요청 0건

### 3. 채널 계산 알고리즘

```
하락채널:
  swing_highs = _find_local_peaks(df.high, window=5)
  최근 2개 고점 → numpy polyfit(degree=1) → 기울기/절편
  평행선 = 두 고점 사이 구간의 최저 저점을 평행 이동
  현재 날짜까지 선형 연장

상승채널:
  swing_lows = _find_local_troughs(df.low, window=5)
  최근 2개 저점 → numpy polyfit → 기울기/절편
  평행선 = 두 저점 사이 구간의 최고 고점을 평행 이동
  현재 날짜까지 선형 연장
```

### 4. 5단계 판정 로직

```python
# 단계 완료 판정 (히스토리 스캔)
stage_1: any(close > downtrend_main_line_value(t) for t in last_N_candles)
stage_2: any(abs(low - downtrend_parallel_value(t)) / downtrend_parallel_value(t) <= 0.02
            and close > low for t in after_stage_1)
stage_3: any(close > downtrend_parallel_value(t) for t in after_stage_2)
stage_4: any(abs(low - uptrend_main_value(t)) / uptrend_main_value(t) <= 0.02
            and close > low for t in after_stage_3)
stage_5: any(close > uptrend_parallel_value(t) for t in after_stage_4)
```

### 5. 볼륨 하이라이트

- 각 단계 완료 캔들의 timestamp 목록을 API 응답에 포함
- `IndicatorChart.tsx` 볼륨 히스토그램: 해당 시간의 바에 `color: 'rgba(251,191,36,0.8)'`(노랑) 적용
- 기존 per-bar color 패턴 그대로 활용

### 6. 차트 기간 전환

- `IndicatorChart.tsx` 신규 프롭: `visibleFromTs?: number` (UTC timestamp)
- `useEffect([visibleFromTs])` → `mainChartRef.current.timeScale().setVisibleRange({ from: visibleFromTs, to: todayTs })`
- RSI/MACD 서브차트는 기존 `subscribeVisibleLogicalRangeChange` 자동 동기화

### 7. fetchQuickChart limit 확장

- `fetchQuickChart(symbol, market, timeframe?, limit?)` — limit 파라미터 추가
- SignalDetail.tsx에서 `limit=260` 전달 (12개월 ≈ 252 거래일 + 여유)
- 백엔드 `quick_chart.py`는 이미 `limit: int = 200` 지원, max cap 500 → 변경 없음

---

## Complexity Tracking

해당 없음 — Constitution 위반 없음.
