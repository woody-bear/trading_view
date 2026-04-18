# Research: 공포지수 차트 개선 (013-fear-index-chart)

## Decision 1: 차트 라이브러리 선택

**Decision**: lightweight-charts v5 (기존 프로젝트 사용 중)

**Rationale**: 프로젝트 전반에서 이미 사용 중이며 모바일 터치 지원, 툴팁(crosshair), 자동 스케일링을 내장. 새 의존성 불필요.

**Alternatives considered**: Recharts (React-native하지만 모바일 성능 약함), Chart.js (캔버스 기반이지만 경량 차트보다 무거움)

---

## Decision 2: Fear & Greed 색상 구간 (0-25/25-75/75-100) 구현 방식

**Decision**: CSS 절대 위치 overlay — 차트 컨테이너 내부에 `position: absolute` div 3개를 Y축 고정 (0-100) 기준으로 배치

**Rationale**: lightweight-charts v5 커스텀 프리미티브(IPrimitive) API는 복잡하다. Y축을 0~100으로 강제(`minValue: 0, maxValue: 100`)하면 구간 비율이 고정(하단 25% = 빨강, 중간 50% = 회색, 상단 25% = 초록)되므로 CSS height 퍼센테이지만으로 정확히 배치 가능하다.

**Alternatives considered**:
- `PriceScaleLine` 두 개(25·75) + 색상 없음 → 구간 색상 불가
- `HistogramSeries` 컬럼으로 배경 구간 표현 → 데이터 복잡도 상승, 툴팁 충돌
- `ISeriesPrimitivePaneView` fillRect → 정확하지만 lightweight-charts v5 내부 API에 의존

**Implementation detail**:
```
container: position: relative; overflow: hidden
  ├── band red:   position: absolute; bottom: 0; height: 25%; opacity: 0.06
  ├── band gray:  position: absolute; bottom: 25%; height: 50%; opacity: 0.04
  ├── band green: position: absolute; top: 0; height: 25%; opacity: 0.06
  └── chart div (position: relative; z-index: 1)
```
차트 Y축 priceScale: `minValue: 0, maxValue: 100` 고정

---

## Decision 3: 백엔드 히스토리 기간 파라미터 확장

**Decision**: `/api/sentiment/history?days=N` 쿼리 파라미터 추가 (기존 API 하위 호환 유지)

**Rationale**: `get_fear_greed_history(days)` 함수는 이미 `days` 인수를 받는다. 라우터에서 hardcode된 `30`만 쿼리 파라미터로 교체하면 된다. 최소 변경.

**Alternatives considered**: 새 엔드포인트 `/sentiment/history/{period}` → URL 변경으로 기존 호출 코드 수정 필요

**Allowed values**: 30 (1개월), 90 (3개월), 365 (1년). 기본값: 30 (하위 호환)

---

## Decision 4: VIX 히스토리 엔드포인트

**Decision**: 신규 엔드포인트 `/api/sentiment/vix-history?days=N` 추가

**Rationale**: 기존 `_fetch_vix_history(days)` 함수가 이미 yfinance `^VIX`를 조회한다. 이 함수를 직접 라우터에 노출하면 된다. Fear & Greed history와 분리하여 VIX 차트 전용 데이터를 제공.

**Response format**: `{ dates: string[], values: number[], updated_at: string }`

---

## Decision 5: VIX 수평 기준선(20·30) 구현

**Decision**: lightweight-charts `PriceLine` (series.createPriceLine) 사용

**Rationale**: `createPriceLine({ price: 20, color: '#f97316', lineStyle: 1 (dashed) })` — 내장 API로 점선 수평선을 정확히 그릴 수 있다.

---

## Decision 6: VIX >30 구간 강조

**Decision**: `HistogramSeries`를 VIX 라인 아래에 추가, 30 초과 시점만 진한 빨강으로 색상 지정

**Rationale**: `HistogramSeries`는 각 봉에 개별 `color` 지정이 가능하다. VIX 값 > 30인 봉은 `color: 'rgba(239,68,68,0.3)'`, 나머지는 투명으로 처리.

---

## Decision 7: 모바일 터치 — 세로 스크롤 vs 차트 드래그 충돌 방지

**Decision**: 차트 컨테이너에 `touch-action: pan-y none` 적용, 가로 드래그는 lightweight-charts가 처리

**Rationale**: lightweight-charts는 내부적으로 터치 이벤트를 처리한다. 컨테이너의 기본 touch-action을 `none`으로 두면 차트가 세로/가로 모두 캡처하므로 페이지 스크롤과 충돌. `pan-y` 허용 시 수직 스크롤은 브라우저가, 수평 드래그는 차트가 처리한다.

---

## Decision 8: 5분 갱신 시 기간 선택 유지

**Decision**: React `useState`로 `selectedDays` 관리, React Query `queryKey`에 포함시켜 기간별 캐시 분리

**Rationale**: `queryKey: ['sentiment-history', selectedDays]`로 각 기간이 독립 캐시를 가진다. `refetchInterval: 300000`로 자동 갱신되어도 현재 `selectedDays`만 갱신되므로 탭 전환 없이 기간이 유지된다.

---

## Decision 9: 컴포넌트 구조 — SentimentPanel 내부 리팩터링 vs 별도 컴포넌트 분리

**Decision**: `SentimentPanel.tsx` 내부에 `FearGreedChart`, `VIXExpandChart` 서브컴포넌트 추가

**Rationale**: 기능이 SentimentPanel의 확장이고 외부에서 독립적으로 재사용될 일이 없다. 파일 분리는 오버헤드. 단, VIX 차트는 conditional render (클릭 시 확장)이므로 내부 상태로 관리.

---

## Summary of Technical Decisions

| 항목 | 결정 |
|------|------|
| 차트 라이브러리 | lightweight-charts v5 (기존) |
| 색상 구간 | CSS absolute overlay (Y 고정 0-100) |
| 백엔드 기간 | `?days=` 쿼리 파라미터 추가 |
| VIX 엔드포인트 | 신규 `/sentiment/vix-history` |
| VIX 기준선 | `createPriceLine` dashed |
| VIX >30 강조 | `HistogramSeries` 조건부 색상 |
| 모바일 터치 | `touch-action: pan-y` |
| 갱신 시 상태 유지 | React Query queryKey에 days 포함 |
| 컴포넌트 구조 | SentimentPanel 내 서브컴포넌트 |
