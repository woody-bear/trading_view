# Implementation Plan: 최근 BUY 신호 종목 대시보드 섹션

**Branch**: `001-ubb-pro-signal-system` | **Date**: 2026-03-17 | **Spec**: `/specs/001-ubb-pro-signal-system/spec.md`

## Summary

대시보드에 "최근 BUY 신호 종목" 섹션을 추가한다. 워치리스트 전체 종목에 대해 UBB Pro Pine Script 기반 차트 신호를 시뮬레이션하고, **가장 최근(차트 우측 끝) 마커가 BUY 또는 SQZ BUY인 종목**만 필터링하여 표시한다. 대시보드 새로고침 시 자동으로 스캔 결과를 갱신한다.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0, React 18, lightweight-charts
**Storage**: SQLite (WAL 모드)
**Testing**: pytest (backend), vitest (frontend)
**Target Platform**: macOS 로컬 서버
**Project Type**: web-service (FastAPI + React SPA)
**Performance Goals**: 워치리스트 전체 스캔 < 10초
**Constraints**: 단일 프로세스, yfinance API rate limit 고려

## Architecture Decision

### 핵심 문제
- `current_signal.signal_state`(10분 스캔 기반)와 차트 마커(`_simulate_signals` Pine Script 기반)는 **다른 로직**
- 사용자가 원하는 것은 차트 마커 기반 "마지막 신호가 BUY"인 종목
- 매 대시보드 로딩마다 전체 종목 OHLCV fetch + 신호 시뮬레이션은 너무 느림

### 선택한 접근법: 백엔드 캐시 + 비동기 스캔

1. **백엔드 API** (`GET /api/signals/latest-buy`) — 캐시된 결과 즉시 반환
2. **백그라운드 스캔** — 10분 스케줄러 실행 시 또는 수동 트리거 시 전체 종목의 차트 마커를 시뮬레이션하고 "마지막 신호" 결과를 DB/메모리에 캐시
3. **프론트엔드 섹션** — 대시보드에 "최근 BUY 신호" 카드 그리드 표시

## Project Structure

### Source Code (변경/추가 파일)

```text
backend/
├── routes/signals.py          # GET /api/signals/latest-buy 엔드포인트 추가
├── services/chart_scanner.py  # 신규: 전체 종목 차트 마커 스캔 + 캐시
└── scheduler.py               # 스캔 후 chart_scanner 호출 추가

frontend/src/
├── api/client.ts              # fetchLatestBuy() API 함수 추가
└── pages/Dashboard.tsx        # "최근 BUY 신호" 섹션 추가
```

## Implementation Tasks

### Task 1: 백엔드 — chart_scanner 서비스 (핵심)

**파일**: `backend/services/chart_scanner.py` (신규)

```python
# 핵심 로직:
# 1. 활성 워치리스트 전체 조회
# 2. 각 종목별 OHLCV fetch (캐시 우선) + _simulate_signals 호출
# 3. 마지막 마커가 BUY/SQZ BUY인 종목만 필터링
# 4. 결과를 메모리 캐시에 저장 (dict)

async def scan_latest_buy(timeframe: str = "1w") -> list[dict]:
    """전체 워치리스트에서 차트 마지막 신호가 BUY인 종목 반환."""
    # - fetcher.fetch_ohlcv → _simulate_signals → markers[-1] 확인
    # - 결과: [{watchlist_id, symbol, display_name, market, last_signal,
    #           last_signal_date, price, change_pct, rsi, squeeze_level}]
```

**주의사항**:
- `_simulate_signals`는 charts.py에서 import하여 재사용
- OHLCV 캐시(OHLCVCache 테이블)가 있으면 우선 사용, 없으면 fetcher 호출
- 종목당 처리 시간 ~1-2초 × 7종목 = ~10초 내 완료
- 결과는 모듈 레벨 변수에 캐시 (DB 저장 불필요, 재시작 시 재스캔)

### Task 2: 백엔드 — API 엔드포인트

**파일**: `backend/routes/signals.py` (수정)

```python
@router.get("/signals/latest-buy")
async def get_latest_buy():
    """차트 마지막 신호가 BUY/SQZ BUY인 종목 목록."""
    # chart_scanner의 캐시된 결과 반환
    # 캐시가 비어있으면 즉시 스캔 트리거
```

**파일**: `backend/routes/signals.py` (수정)

```python
@router.post("/signals/latest-buy/refresh")
async def refresh_latest_buy():
    """수동 재스캔 트리거."""
```

### Task 3: 백엔드 — 스케줄러 통합

**파일**: `backend/scheduler.py` (수정)

- `_scheduled_scan()` 완료 후 `chart_scanner.scan_latest_buy()` 호출
- 10분마다 자동으로 최신 BUY 종목 캐시 갱신

### Task 4: 프론트엔드 — API 클라이언트

**파일**: `frontend/src/api/client.ts` (수정)

```typescript
export const fetchLatestBuy = () => api.get('/signals/latest-buy').then(r => r.data)
export const refreshLatestBuy = () => api.post('/signals/latest-buy/refresh').then(r => r.data)
```

### Task 5: 프론트엔드 — 대시보드 섹션

**파일**: `frontend/src/pages/Dashboard.tsx` (수정)

- 기존 "진격 종목" 섹션 아래 또는 대체하여 **"차트 BUY 신호 종목"** 섹션 추가
- `useQuery(['latest-buy'], fetchLatestBuy)` 으로 데이터 로드
- 각 종목 카드: 종목명, 현재가, 마지막 신호 유형(BUY/SQZ BUY), 신호 발생일, RSI, 스퀴즈 레벨
- 카드 클릭 → `/<symbol>` 종목 상세로 이동
- "새로고침" 버튼 → `refreshLatestBuy()` 호출 후 데이터 갱신

## Data Flow

```
대시보드 로딩
  → GET /api/signals/latest-buy (캐시 즉시 반환, <100ms)
  → 카드 그리드 렌더링

10분 스케줄러 / 수동 새로고침
  → scan_latest_buy()
    → 워치리스트 순회
      → OHLCV fetch (캐시 우선)
      → _simulate_signals(df, timestamps, indicators, "1w")
      → markers[-1].text in ("BUY", "SQZ BUY") → 결과에 포함
  → 캐시 업데이트
  → WebSocket broadcast (optional)
```

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| 전체 스캔이 느림 (종목 많을 때) | OHLCV 캐시 우선, 병렬 처리 가능 |
| yfinance rate limit | 스캔 간격 10분, 종목간 0.5초 딜레이 |
| 주봉 데이터 부족으로 마커 없음 | 마커 없는 종목은 "분석 중" 표시 |
