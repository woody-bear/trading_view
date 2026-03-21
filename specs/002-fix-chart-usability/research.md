# Research: 종목 상세화면 차트 사용성 개선

**Date**: 2026-03-21 | **Branch**: `002-fix-chart-usability`

## R-001: 토스트 알림 시스템 선택

**Decision**: 자체 구현 (Zustand 스토어 + Tailwind 애니메이션)

**Rationale**:
- 현재 프로젝트에 toast 라이브러리 없음. 기존 패턴(`addMsg` + `setTimeout`)이 이미 존재
- react-hot-toast/sonner 등 외부 라이브러리 도입보다 기존 패턴을 전역화하는 것이 일관성 유지
- 필요한 기능이 단순 (success/error/info 3종, 3초 자동 소멸)
- Zustand 스토어에 `toasts[]` 배열 + `addToast()` 액션으로 전역 접근 가능

**Alternatives Considered**:
- react-hot-toast: 경량이지만 추가 의존성. 프로젝트 규모 대비 과잉
- sonner: 더 풍부한 UI이나 번들 크기 증가
- 기존 addMsg 패턴 유지: 컴포넌트별 로컬 상태이므로 전역 피드백 불가

## R-002: 차트 에러 바운더리 구현 방식

**Decision**: React ErrorBoundary 클래스 컴포넌트로 차트 영역만 감싸기

**Rationale**:
- lightweight-charts는 Canvas 기반이라 렌더링 오류 시 React 트리 전체 크래시 가능
- ErrorBoundary는 클래스 컴포넌트로만 구현 가능 (React 제한)
- 차트 3개(메인/RSI/MACD)를 하나의 ErrorBoundary로 감싸면 차트 전체가 격리됨
- fallback UI에서 "새로고침" 버튼으로 차트만 재시도 가능

**Alternatives Considered**:
- react-error-boundary 라이브러리: 기능적으로 동일하나 추가 의존성
- try-catch in useEffect: 비동기 에러는 잡지만 렌더링 에러는 못 잡음

## R-003: SSE 연결 상태 관리 방식

**Decision**: useRealtimePrice 훅 확장 — connected/reconnecting/disconnected 3상태 반환

**Rationale**:
- 현재 `useRealtimePrice`가 `{ livePrice, connected }` boolean만 반환
- EventSource의 `onopen`, `onerror`, `readyState` 활용하면 3상태 구분 가능
- EventSource.CONNECTING(0), OPEN(1), CLOSED(2)가 자연스럽게 3상태에 매핑

**Alternatives Considered**:
- 별도 ConnectionStatus 컴포넌트: 상태를 훅에서 관리하는 것이 더 자연스러움
- WebSocket 기반 전환: SSE가 이미 잘 동작하며, 단방향이므로 적합

## R-004: 차트 스켈레톤 UI 구현

**Decision**: Tailwind의 animate-pulse + 차트 영역 크기 고정 placeholder

**Rationale**:
- 차트 컨테이너 높이가 이미 고정(메인 450px, RSI 110px, MACD 110px)
- 같은 크기의 bg-gray-700/800 animate-pulse 블록으로 스켈레톤 표현
- 데이터 도착 시 opacity transition으로 부드러운 전환

**Alternatives Considered**:
- react-loading-skeleton: 추가 의존성, Tailwind로 충분히 구현 가능
- 로딩 스피너: 차트 형태를 미리 보여주는 스켈레톤이 UX 더 우수

## R-005: 시그널 마커 방어적 렌더링

**Decision**: 마커 데이터 유효성 검증 후 try-catch로 격리

**Rationale**:
- 현재 IndicatorChart에서 markers를 그대로 `setMarkers()`에 전달
- lightweight-charts의 setMarkers()는 잘못된 time 값에 예외 발생 가능
- 마커 설정을 try-catch로 감싸고, 실패 시 마커 없이 차트만 표시 + 경고 플래그

**Alternatives Considered**:
- 백엔드에서 마커 검증: 이미 백엔드가 생성하므로 프론트에서 이중 검증이 방어적

## R-006: yfinance 미완성 캔들 문제 (핵심 발견)

**Decision**: 백엔드에서 당일 미완성 캔들을 감지하여 제거 + 프론트에서 실시간 가격으로 당일 캔들 독립 구성

**Root Cause 분석**:

yfinance `auto_adjust=True`로 다운로드하면 장중에도 당일 미완성 캔들이 포함된다:
- Open = 당일 시가, High/Low = 장중 부분 범위, Close = 현재가
- 이 미완성 캔들이 `chart_cache`에 저장되고, 20시간 동안 "fresh"로 판정
- 결과: 전일 종가 대비 급등/급락처럼 보이는 마지막 캔들

**문제 체인**:
1. `chart_cache.py:53` — yfinance가 당일 미완성 캔들 포함하여 반환
2. `chart_cache.py:95` — `timedelta(hours=20)` 캐시 정책이 시간대 무시
3. `chart_cache.py:91-92` — `datetime.utcfromtimestamp()` UTC 기준으로 KR/US 장 마감 구분 불가
4. `IndicatorChart.tsx:229-250` — SSE 가격이 캔들 open을 덮어쓸 가능성

**해결 전략**:

| 단계 | 위치 | 조치 |
|------|------|------|
| 1 | `chart_cache.py` | 시장별 장 마감 시간 인식: KR=15:30 KST, US=16:00 ET, CRYPTO=UTC 00:00 |
| 2 | `chart_cache.py` | yfinance 반환 데이터에서 당일 미완성 캔들 제거 (`_strip_incomplete_candle()`) |
| 3 | `chart_cache.py` | 캐시 freshness를 시장 장 마감 기준으로 판단 (`_is_cache_fresh()`) |
| 4 | `quick_chart.py` | 응답에 `market_open: bool` 플래그 추가 (실시간 가격으로 당일 캔들 구성 필요 여부) |
| 5 | `IndicatorChart.tsx` | `market_open=true`이면 프론트에서 당일 캔들을 실시간 가격으로 생성 (가격 미수신 시 완성 캔들까지만 표시) |

**Rationale**:
- 백엔드에서 미완성 캔들을 제거하면 캐시 데이터 품질이 근본적으로 해결
- 프론트에서 실시간 가격으로 당일 캔들을 구성하면 장중에도 라이브 차트 제공
- `auto_adjust=True`와 실시간 비수정주가 혼합 문제도 함께 해결 (당일분은 실시간만 사용)

**Alternatives Considered**:
- `auto_adjust=False`로 전환: 과거 데이터의 수정주가가 필요한 지표(BB, EMA 등) 계산에 영향
- 프론트에서만 필터링: 근본 원인(캐시 오염)이 해결되지 않음
- 장 마감 후에만 캐시 저장: 장중 차트 조회 불가

## R-007: 시장별 장 마감 시간 로직

**Decision**: 간단한 유틸리티 함수로 시장별 장 마감 여부 판단

**구현**:
```python
# KR: 15:30 KST (UTC+9) → UTC 06:30
# US: 16:00 ET (UTC-5/4) → UTC 21:00/20:00
# CRYPTO: 24h, UTC 00:00 일봉 마감

def is_market_closed(market: str) -> bool:
    """현재 시각에 시장이 마감되었는지 판단."""

def get_last_close_date(market: str) -> date:
    """가장 최근 마감된 영업일 반환 (주말/공휴일 고려)."""
```

**Rationale**:
- 한국 공휴일은 간단 목록 또는 pykrx.stock.get_nearest_business_day로 처리
- 미국은 DST(서머타임) 고려 필요: 3월~11월 UTC-4, 그 외 UTC-5
- 암호화폐는 365일 24시간이므로 항상 "당일 미완성" → UTC 00:00 기준 전일 캔들까지 완성

**Alternatives Considered**:
- exchange_calendars 라이브러리: 정확하지만 추가 의존성이 큼
- 고정 UTC 오프셋: DST 미고려 시 연 2회(3월/11월) 오류 발생

## R-008: BUY/SELL 마커 호버 색상 변경 (US9)

**Decision**: `subscribeCrosshairMove()` + 마커 `id` + `setMarkers()` 재호출로 구현

**Rationale**:
- lightweight-charts v5에는 마커 전용 hover 이벤트가 없음
- `subscribeCrosshairMove(param)`의 `param.time`을 마커 시간과 비교하여 매칭
- 호버 감지 시 해당 마커의 color를 강조색으로 변경한 배열로 `setMarkers()` 재호출
- 마커 `id` 필드(기존 미사용)를 추가하여 개별 마커 식별

**구현**:
```typescript
// 마커에 id 추가
const markersPlugin = createSeriesMarkers(candleSeries, markers.map(m => ({ ...m, id: `${m.position}-${m.time}` })))

// 크로스헤어 이동 시 마커 색상 변경
mainChart.subscribeCrosshairMove((param) => {
  if (!param.time) { restoreOriginalColors(); return }
  const hovered = markers.find(m => m.time === param.time)
  if (hovered) highlightMarker(hovered.id)
  else restoreOriginalColors()
})
```

**강조색**: BUY `#22c55e` → `#4ade80` (밝은 녹색), SELL `#ef4444` → `#f87171` (밝은 적색)
**모바일**: `window.matchMedia('(hover: hover)')` 체크로 터치 전용 기기에서 비활성화

**Alternatives Considered**:
- Custom primitive + hitTest: 픽셀 정밀도 높지만 구현 복잡도 과잉
- CSS hover: Canvas 기반이라 CSS hover 불가

## R-009: BUY 마커 클릭 매수지점 기록 (US10)

**Decision**: `subscribeClick()` + localStorage + lightweight-charts priceLine으로 수평선 시각화

**Rationale**:
- `chart.subscribeClick(param)`으로 클릭 시간을 감지하고 BUY 마커 매칭
- 매수지점 데이터를 localStorage `buyPoints:{symbol}` 키에 JSON 저장
- lightweight-charts의 `createPriceLine()`으로 매수 가격 수평선 + 라벨 표시
- 수익률은 실시간 가격 변경 시 라벨 텍스트 업데이트

**localStorage 구조**:
```json
{
  "buyPoints:005930": { "price": 50000, "date": "2026-03-21", "markerTime": 1742515200 },
  "buyPoints:AAPL": { "price": 175.50, "date": "2026-03-20", "markerTime": 1742428800 }
}
```

**시각화**: `candleSeries.createPriceLine({ price, color: '#22c55e', lineWidth: 1, lineStyle: 2, title: '매수 ₩50,000 (+2.5%)' })`
**토글**: 같은 BUY 마커 재클릭 시 localStorage에서 삭제 + priceLine 제거
**대체**: 다른 BUY 마커 클릭 시 기존 priceLine 제거 + 새 지점으로 대체

**Alternatives Considered**:
- DB 저장: 백엔드 API 추가 필요, 1인 시스템에서 과잉
- addSeries(LineSeries): priceLine이 더 간결하고 가격축에 자동 라벨 표시

## R-010: 모바일 실시간 업데이트 스로틀링

**Decision**: requestAnimationFrame + 200ms throttle

**Rationale**:
- 스펙에서 200ms 간격(초당 5회) 명시
- SSE는 1초 간격이므로 SSE 자체는 문제 없음
- WebSocket price_update는 더 빈번할 수 있으므로 candleSeries.update() 호출을 throttle
- requestAnimationFrame으로 브라우저 렌더링 주기에 맞춤

**Alternatives Considered**:
- lodash.throttle: 추가 의존성. 간단한 throttle은 직접 구현 가능
- debounce: 마지막 값만 반영하므로 차트에 빈 구간 발생 가능
