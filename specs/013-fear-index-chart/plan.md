# Implementation Plan: 공포지수 차트 개선

**Branch**: `013-fear-index-chart` | **Date**: 2026-04-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-fear-index-chart/spec.md`

## Summary

Fear & Greed Index 추이 차트를 1개월/3개월/1년 기간 탭 선택과 공포/탐욕 색상 구간 배경으로 개선하고, VIX 미니카드 클릭 시 VIX 전용 차트(20·30 기준선 포함)를 확장 표시한다. 백엔드는 기존 히스토리 API에 `days` 파라미터를 추가하고 VIX 히스토리 엔드포인트를 신규 추가한다. 프론트엔드는 `SentimentPanel.tsx` 내부에 lightweight-charts v5 기반 `FearGreedChart`·`VIXExpandChart` 서브컴포넌트를 추가한다.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18) + Python 3.12
**Primary Dependencies**: lightweight-charts v5 (기존), FastAPI (기존), yfinance (기존), React Query (기존)
**Storage**: 없음 (DB 스키마 변경 없음, 실시간 조회 + 메모리 캐시)
**Testing**: 수동 시나리오 검증 (quickstart.md 체크리스트)
**Target Platform**: 웹 (PC + 모바일 반응형)
**Project Type**: web-service (단일 포트 8000, SPA + FastAPI)
**Performance Goals**: 기간 탭 전환 1초 이내 차트 갱신
**Constraints**: 모바일 터치와 페이지 스크롤 충돌 없음, 5분 갱신 시 UI 상태 유지
**Scale/Scope**: 단일 사용자 시스템, 최대 365개 데이터 포인트

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 새 의존성 추가 없음 | PASS | lightweight-charts v5, yfinance 모두 기존 사용 중 |
| DB 스키마 변경 없음 | PASS | 실시간 조회, chart_cache 사용 안 함 |
| 기존 API 하위 호환 | PASS | `?days` 기본값 30으로 하위 호환 |
| 단일 포트 유지 | PASS | 새 라우터 없이 기존 sentiment 라우터에 추가 |

*Post-design re-check*: 모든 게이트 통과. `_fetch_vix_history()` 함수 재사용으로 코드 중복 최소화.

## Project Structure

### Documentation (this feature)

```text
specs/013-fear-index-chart/
├── plan.md              # This file
├── research.md          # Phase 0 output ✓
├── data-model.md        # Phase 1 output ✓
├── quickstart.md        # Phase 1 output ✓
├── contracts/
│   └── api.md           # Phase 1 output ✓
└── tasks.md             # Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code (변경 파일)

```text
backend/
├── routes/
│   └── sentiment.py          # days 파라미터 추가, /vix-history 엔드포인트 신규
└── services/
    └── sentiment_analyzer.py # get_vix_history_raw() 함수 신규 추출

frontend/src/
├── api/
│   └── client.ts             # fetchSentimentHistory(days) 시그니처 변경, fetchVIXHistory 추가
└── components/
    └── SentimentPanel.tsx    # FearGreedChart + VIXExpandChart 서브컴포넌트 추가, 기간 탭 UI
```

**Structure Decision**: Option 2 (Web application) — 기존 backend/frontend 구조 유지, 최소 파일 수정

## Implementation Notes

### 백엔드 변경 (sentiment.py)

```python
@router.get("/sentiment/history")
async def sentiment_history(days: int = 30):
    # days 쿼리 파라미터로 변경
    return await get_fear_greed_history(days)

@router.get("/sentiment/vix-history")
async def vix_history(days: int = 365):
    return await get_vix_history_raw(days)
```

### 백엔드 변경 (sentiment_analyzer.py)

```python
async def get_vix_history_raw(days: int = 365) -> dict:
    """VIX 히스토리 직접 반환 (Fear&Greed 변환 없이)."""
    df = await asyncio.to_thread(_fetch_vix_history, days)
    # dates + values 딕셔너리로 반환
```

### 프론트엔드 — FearGreedChart 서브컴포넌트

- lightweight-charts `LineSeries`, `createChart`
- priceScale: `minValue: 0, maxValue: 100` 고정
- CSS overlay: 빨강(하단 25%) / 회색(중간 50%) / 초록(상단 25%)
- 기간 탭: `[30, 90, 365]` → `queryKey: ['sentiment-history', selectedDays]`
- crosshairMode: Magnet, 커스텀 툴팁

### 프론트엔드 — VIXExpandChart 서브컴포넌트

- VIX 미니카드 클릭 → `vixExpanded` 토글
- `LineSeries` + `HistogramSeries` (>30 빨간 음영)
- `createPriceLine({ price: 20, lineStyle: 1 })` (점선 오렌지)
- `createPriceLine({ price: 30, lineStyle: 1 })` (점선 빨강)
- 기간 탭 공유 (`selectedDays`)

### 모바일 터치

```css
.chart-container { touch-action: pan-y; }
```

## Complexity Tracking

해당 없음 — 헌법 위반 없음, 신규 의존성 없음.
