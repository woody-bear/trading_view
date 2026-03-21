# Data Model: 차트 사용성 개선

**Date**: 2026-03-21 | **Branch**: `002-fix-chart-usability`

> 이 피처는 기존 DB 스키마 변경 없음. 프론트엔드 상태 모델만 추가/변경.

## 신규 프론트엔드 상태 모델

### Toast (신규)

전역 사용자 피드백 메시지.

| Field | Type | Description |
|-------|------|-------------|
| id | string | 고유 ID (Date.now + random) |
| type | 'success' \| 'error' \| 'info' | 메시지 유형 |
| message | string | 표시할 텍스트 |
| duration | number | 자동 소멸 시간 (ms, default: 3000) |

**상태 전이**: 생성 → 표시 → duration 경과 → 제거

### ConnectionStatus (변경)

현재: `connected: boolean`
변경: `connectionStatus: 'connected' | 'reconnecting' | 'disconnected'`

| 값 | EventSource 상태 | UI 표시 |
|---|---|---|
| connected | OPEN (readyState=1) | 녹색 "실시간" |
| reconnecting | CONNECTING (readyState=0) after error | 황색 "재연결 중..." |
| disconnected | CLOSED (readyState=2) 또는 재연결 실패 | 적색 "연결 끊김" + 재연결 버튼 |

### ChartLoadState (신규)

차트 로딩 상태 세분화.

| Field | Type | Description |
|-------|------|-------------|
| status | 'loading' \| 'success' \| 'empty' \| 'error' \| 'timeout' | 현재 상태 |
| errorMessage | string \| null | 에러/안내 메시지 |
| markerWarning | boolean | 마커 렌더링 실패 여부 |

**상태 전이**:
```
loading → success (데이터 정상)
loading → empty (candles 배열 비어있음)
loading → timeout (10초 초과)
loading → error (네트워크/파싱 오류)
```

## 백엔드 응답 모델 변경

### ChartData 응답 (확장)

기존 필드 유지 + `market_open` 플래그 추가.

| Field | Type | 변경 | Description |
|-------|------|------|-------------|
| candles | array | 유지 | 장중 조회 시 **미완성 당일 캔들이 제거된** 상태로 반환 |
| market_open | boolean | **신규** | 현재 해당 시장이 장중인지 여부. `true`이면 프론트에서 실시간 가격으로 당일 캔들 구성 |
| indicators | object | 유지 | 완성 캔들 기준으로 계산 (미완성 제거 후) |
| 기타 | - | 유지 | squeeze_dots, markers, current 등 |

### 백엔드 유틸리티 모델 (신규)

`backend/utils/market_hours.py`에서 사용:

| Function | Return | Description |
|----------|--------|-------------|
| `is_market_open(market)` | bool | 현재 시각에 해당 시장이 장중인지 |
| `get_last_complete_date(market)` | date | 가장 최근 완성된 일봉의 날짜 |
| `is_candle_complete(candle_date, market)` | bool | 특정 날짜의 캔들이 완성 캔들인지 |

### BuyPoint (신규 — localStorage)

사용자가 기록한 매수지점. localStorage에 종목별 1개 저장.

| Field | Type | Description |
|-------|------|-------------|
| symbol | string | 종목 심볼 (localStorage 키: `buyPoints:{symbol}`) |
| price | number | 매수 기록 가격 |
| date | string | 매수 기록 일자 (ISO date) |
| markerTime | number | 클릭한 BUY 마커의 Unix timestamp |

**상태 전이**: 없음 → BUY 마커 클릭 → 기록됨 → 같은 마커 재클릭 → 삭제 / 다른 BUY 마커 클릭 → 대체

**시각화**: lightweight-charts `createPriceLine()` — 가격 수평선 + "매수 ₩50,000 (+2.5%)" 라벨

### MarkerHoverState (신규 — 메모리 전용)

마커 호버 시 강조 상태. 별도 저장 없음 (렌더링 시 일시적).

| Field | Type | Description |
|-------|------|-------------|
| hoveredMarkerId | string \| null | 현재 호버 중인 마커 ID |
| originalColors | Map<string, string> | 원본 색상 백업 (복원용) |

## 기존 모델 변경 없음

- **Signal**: 변경 없음
- **DB 테이블**: 변경 없음 (chart_cache 스키마 유지, 저장 로직만 변경)
