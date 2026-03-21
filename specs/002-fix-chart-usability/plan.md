# Implementation Plan: 종목 상세화면 차트 사용성 개선

**Branch**: `002-fix-chart-usability` | **Date**: 2026-03-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-fix-chart-usability/spec.md`

## Summary

종목 상세화면(SignalDetail)의 차트 오류를 없애고 사용성을 높이는 프론트+백엔드 개선. **핵심 버그**: yfinance 미완성 당일 캔들이 캐시되면서 마지막 일봉이 급락/급등하는 문제 해결. 추가로 빈 차트 안내, 스켈레톤 로딩, 토스트 피드백, 연결 상태 3단계 표시, 마커 방어 렌더링, 에러 바운더리 격리, 마커 호버 색상 강조, BUY 마커 클릭 매수지점 기록을 구현한다.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18) + Python 3.12
**Primary Dependencies**: React 18, lightweight-charts v5, Zustand, React Query, Tailwind CSS / FastAPI, pandas, yfinance
**Storage**: SQLite chart_cache (스키마 변경 없음, 로직만 변경) + localStorage (매수지점)
**Testing**: Vitest + React Testing Library (프론트엔드) / pytest (백엔드)
**Target Platform**: 웹 브라우저 (모바일 + PC 반응형)
**Project Type**: Web application (SPA + API)
**Performance Goals**: 종목 정보 1초 이내 표시, 모바일 60fps 유지, 연결 상태 변경 3초 이내 반영
**Constraints**: 추가 의존성 최소화, 모바일 throttle 200ms, 시장별 시간대 인식
**Scale/Scope**: 프론트엔드 7개 신규 + 4개 수정 / 백엔드 2개 수정 + 1개 신규

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution은 프로젝트별 원칙이 아직 정의되지 않은 템플릿 상태. CLAUDE.md의 프로젝트 규칙을 기준으로 검증:

| Gate | Status | Notes |
|------|--------|-------|
| Docker 미사용 | PASS | 프론트엔드+백엔드 로직 변경, Docker 불필요 |
| SQLite 단일 DB | PASS | DB 스키마 변경 없음, 매수지점은 localStorage |
| 단일 포트 8000 | PASS | API/라우팅 변경 없음 |
| pandas-ta (not ta-lib) | PASS | 백엔드 지표 계산 변경 없음 |
| 추가 의존성 최소화 | PASS | npm/pip 신규 패키지 0개, Python 표준 zoneinfo 사용 |

**Post-Phase 1 Re-check**: 모든 게이트 PASS 유지.

## Project Structure

### Documentation (this feature)

```text
specs/002-fix-chart-usability/
├── plan.md              # This file
├── spec.md              # Feature specification (10 user stories)
├── research.md          # Phase 0: 기술 결정 사항 (R-001~R-010)
├── data-model.md        # Phase 1: 데이터 모델
├── quickstart.md        # Phase 1: 개발 가이드
├── contracts/           # Phase 1: 인터페이스 계약
│   ├── toast-api.md
│   ├── connection-indicator.md
│   ├── chart-error-boundary.md
│   └── chart-data-integrity.md
└── tasks.md             # Phase 2: 작업 목록 (speckit.tasks에서 생성)
```

### Source Code (repository root)

```text
backend/
├── utils/
│   └── market_hours.py         # 신규: 시장별 장 마감 시간/영업일 판단
├── services/
│   └── chart_cache.py          # 수정: 미완성 캔들 제거 + 시간대 인식 freshness
└── routes/
    └── quick_chart.py          # 수정: market_open 플래그 추가

frontend/src/
├── stores/
│   ├── signalStore.ts          # 기존 (변경 없음)
│   └── toastStore.ts           # 신규: 전역 토스트 상태
├── components/
│   ├── ui/
│   │   ├── Toast.tsx               # 신규: 토스트 렌더링
│   │   └── ConnectionIndicator.tsx # 신규: 연결 상태 표시
│   └── charts/
│       ├── IndicatorChart.tsx      # 수정: open 보존, 마커 방어/호버/클릭, throttle, 당일 캔들, 매수지점
│       ├── ChartErrorBoundary.tsx  # 신규: 에러 격리
│       ├── ChartSkeleton.tsx       # 신규: 스켈레톤 UI
│       └── ChartEmptyState.tsx     # 신규: 빈 데이터 안내
├── hooks/
│   ├── useRealtimePrice.ts     # 수정: 3상태 연결
│   └── useBuyPoint.ts          # 신규: 매수지점 localStorage CRUD
├── pages/
│   └── SignalDetail.tsx         # 수정: 통합 (스켈레톤, 토스트, 에러, 매수지점)
└── App.tsx                      # 수정: Toast 컨테이너
```

**Structure Decision**: 기존 Web application 구조 유지. 백엔드에 `utils/market_hours.py` 신규 추가. 프론트엔드는 기존 디렉토리 패턴에 배치. 매수지점은 `useBuyPoint` 훅 + IndicatorChart 내 `createPriceLine()` 호출로 구현 (별도 컴포넌트 불필요).

## Implementation Approach

### Layer 0: 백엔드 — 차트 데이터 정확성 (최우선, US7+US8)
1. **시장 시간대 유틸리티** — `backend/utils/market_hours.py` 신규: 시장별 장 마감 판단, 마지막 영업일 계산
2. **미완성 캔들 제거** — `chart_cache.py` 수정: yfinance 반환 데이터에서 당일 미완성 캔들 strip
3. **캐시 신선도 개선** — `chart_cache.py` 수정: UTC 20시간 → 시장별 장 마감 기준 freshness
4. **quick_chart 응답 확장** — `quick_chart.py` 수정: `market_open: bool` 플래그 추가

### Layer 1: 프론트엔드 — 기반 인프라 (독립, US1+US2+US3+US6)
5. **Toast 시스템** — `toastStore.ts` + `Toast.tsx` → `App.tsx`에 마운트
6. **ChartErrorBoundary** — 독립 컴포넌트
7. **ChartSkeleton** — 독립 컴포넌트
8. **ChartEmptyState** — 독립 컴포넌트

### Layer 2: 프론트엔드 — 훅 확장 (US4)
9. **useRealtimePrice 3상태 확장** — connected boolean 하위 호환 유지하며 connectionStatus 추가
10. **ConnectionIndicator** — useRealtimePrice의 새 반환값 활용

### Layer 3: 프론트엔드 — 차트 상호작용 (US5+US9+US10)
11. **IndicatorChart 마커 방어** — setMarkers try-catch + markerWarning 플래그
12. **마커 호버 색상 강조** — subscribeCrosshairMove + id 매칭 + setMarkers 재호출
13. **매수지점 훅** — `useBuyPoint.ts` localStorage CRUD
14. **매수지점 시각화** — subscribeClick + createPriceLine + 수익률 라벨

### Layer 4: 프론트엔드 — 통합 (전체 US)
15. **IndicatorChart 실시간 수정** — open 보존, throttle, market_open 당일 캔들
16. **SignalDetail 통합** — 스켈레톤, 빈 상태, 에러 바운더리, 토스트, 연결 상태, 매수지점

### 의존 관계
```
Layer 0 (백엔드, 병렬 가능)           Layer 1 (프론트 기반, 병렬 가능)
  market_hours.py ──┐                  Toast ──────────────────┐
  chart_cache.py ───┤                  ChartErrorBoundary ─────┤
  quick_chart.py ───┘                  ChartSkeleton ──────────┤
                                       ChartEmptyState ────────┤
        │                                        │             │
        ▼                              Layer 2 (병렬 가능)     │
Layer 3 (Layer 0+1 이후)                useRealtimePrice ──────┤
  마커 방어 ─────────────┐              ConnectionIndicator ───┤
  마커 호버 ─────────────┤                        │             │
  useBuyPoint ───────────┤                        ▼             │
  매수지점 시각화 ────────┤             Layer 4 (모두 필요)     │
                         ▼               IndicatorChart 수정 ──┤
                    SignalDetail 통합 ◀────────────────────────┘
```

## User Story → File Mapping

| US | Priority | 주요 변경 파일 |
|----|----------|---------------|
| US1 | P1 | ChartEmptyState.tsx, SignalDetail.tsx |
| US2 | P1 | ChartSkeleton.tsx, SignalDetail.tsx |
| US3 | P2 | toastStore.ts, Toast.tsx, App.tsx, SignalDetail.tsx |
| US4 | P2 | useRealtimePrice.ts, ConnectionIndicator.tsx, SignalDetail.tsx |
| US5 | P2 | IndicatorChart.tsx (try-catch) |
| US6 | P3 | ChartErrorBoundary.tsx, SignalDetail.tsx |
| US7 | P1 | market_hours.py, chart_cache.py, quick_chart.py, IndicatorChart.tsx |
| US8 | P2 | market_hours.py, chart_cache.py |
| US9 | P3 | IndicatorChart.tsx (subscribeCrosshairMove) |
| US10 | P3 | useBuyPoint.ts, BuyPointLine.tsx, IndicatorChart.tsx (subscribeClick) |

## Complexity Tracking

| 항목 | 결정 | 근거 |
|------|------|------|
| 외부 라이브러리 0개 | Zustand + Tailwind + zoneinfo로 충분 | react-hot-toast, exchange_calendars 등 불필요 |
| DB 스키마 변경 0건 | chart_cache 테이블 구조 유지, 매수지점은 localStorage | API 추가 불필요 |
| 시간대 처리 | Python 표준 zoneinfo 사용 | pytz 불필요 (Python 3.9+) |
| 매수지점 저장 | localStorage (종목당 1개) | 1인 시스템, 백엔드 변경 불필요 |
| 마커 호버 | crosshairMove 시간 매칭 | Custom primitive hitTest 대비 단순 |
