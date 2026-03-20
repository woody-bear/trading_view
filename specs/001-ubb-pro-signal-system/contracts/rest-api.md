# REST API 계약: UBB Pro Signal System

**피처**: `001-ubb-pro-signal-system` | **날짜**: 2026-03-16
**기본 URL**: `http://localhost:8000/api`

## 워치리스트 API

### GET /api/watchlist

워치리스트 전체 조회.

**응답 200**:
```json
{
  "items": [
    {
      "id": 1,
      "market": "KR",
      "symbol": "005930",
      "display_name": "삼성전자",
      "timeframe": "1h",
      "data_source": "auto",
      "is_active": true,
      "created_at": "2026-03-16T10:00:00"
    }
  ],
  "total": 1
}
```

**쿼리 파라미터**:
- `market` (선택): 시장 필터 — `KR`, `US`, `CRYPTO`
- `is_active` (선택): 활성 상태 필터 — `true`, `false`

---

### POST /api/watchlist

종목 추가. 유효성 검증 후 추가.

**요청 본문**:
```json
{
  "market": "KR",
  "symbol": "005930",
  "timeframe": "1h",
  "data_source": "auto"
}
```

**응답 201**:
```json
{
  "id": 1,
  "market": "KR",
  "symbol": "005930",
  "display_name": "삼성전자",
  "timeframe": "1h",
  "data_source": "auto",
  "is_active": true,
  "created_at": "2026-03-16T10:00:00"
}
```

**응답 400**: 유효성 검증 실패
```json
{
  "detail": "종목 '999999'을(를) 찾을 수 없습니다"
}
```

**응답 409**: 중복 종목
```json
{
  "detail": "이미 등록된 종목입니다: KR/005930"
}
```

---

### PATCH /api/watchlist/{id}

종목 설정 수정 (부분 업데이트).

**요청 본문** (모든 필드 선택):
```json
{
  "timeframe": "4h",
  "is_active": false
}
```

**응답 200**: 수정된 전체 종목 정보
**응답 404**: 종목 없음

---

### DELETE /api/watchlist/{id}

종목 삭제. 관련 신호 이력도 함께 삭제.

**응답 204**: 삭제 완료
**응답 404**: 종목 없음

---

## 신호 API

### GET /api/signals

현재 신호 상태 전체 조회 (current_signal 기반).

**응답 200**:
```json
{
  "signals": [
    {
      "watchlist_id": 1,
      "symbol": "005930",
      "display_name": "삼성전자",
      "market": "KR",
      "signal_state": "BUY",
      "confidence": 85.0,
      "signal_grade": "NORMAL",
      "price": 72500.0,
      "change_pct": 2.1,
      "rsi": 28.5,
      "bb_pct_b": 0.05,
      "bb_width": 0.12,
      "squeeze_level": 1,
      "macd_hist": 0.35,
      "volume_ratio": 1.8,
      "ema_20": 71000.0,
      "ema_50": 70500.0,
      "ema_200": 69000.0,
      "updated_at": "2026-03-16T10:30:00"
    }
  ]
}
```

**쿼리 파라미터**:
- `market` (선택): 시장 필터
- `signal_state` (선택): 신호 상태 필터 — `BUY`, `SELL`, `NEUTRAL`

---

### GET /api/signals/{watchlist_id}

특정 종목의 현재 신호 상세 조회.

**응답 200**: 단일 신호 상세 정보 (위와 동일 구조)
**응답 404**: 종목 없음

---

### GET /api/signals/{watchlist_id}/chart

특정 종목의 차트 데이터 조회. OHLCV + 전체 지표 계산값 + 신호 마커를 포함.

**쿼리 파라미터**:
- `timeframe` (선택): 타임프레임. 기본값은 종목 설정값. `15m`, `30m`, `1h`, `4h`, `1d`
- `limit` (선택): 반환 캔들 수. 기본값 200, 최대 500

**응답 200**:
```json
{
  "symbol": "005930",
  "display_name": "삼성전자",
  "timeframe": "1h",
  "candles": [
    {
      "time": 1710576000,
      "open": 71800.0,
      "high": 72600.0,
      "low": 71500.0,
      "close": 72500.0,
      "volume": 12500000
    }
  ],
  "indicators": {
    "bb_upper": [{"time": 1710576000, "value": 74200.0}],
    "bb_middle": [{"time": 1710576000, "value": 72000.0}],
    "bb_lower": [{"time": 1710576000, "value": 69800.0}],
    "ema_20": [{"time": 1710576000, "value": 71000.0}],
    "ema_50": [{"time": 1710576000, "value": 70500.0}],
    "ema_200": [{"time": 1710576000, "value": 69000.0}],
    "rsi": [{"time": 1710576000, "value": 28.5}],
    "macd_line": [{"time": 1710576000, "value": 150.0}],
    "macd_signal": [{"time": 1710576000, "value": 100.0}],
    "macd_hist": [{"time": 1710576000, "value": 50.0}],
    "volume_avg": [{"time": 1710576000, "value": 8000000}],
    "squeeze": [{"time": 1710576000, "value": 1}]
  },
  "markers": [
    {
      "time": 1710576000,
      "position": "belowBar",
      "color": "#22c55e",
      "shape": "arrowUp",
      "text": "BUY 85"
    }
  ]
}
```

**응답 404**: 종목 없음

**비고**: `indicators` 배열의 각 항목은 Lightweight Charts의 `LineSeries`/`HistogramSeries` 데이터 형식과 호환. `markers`는 `ISeriesApi.setMarkers()` 형식과 호환.

---

### GET /api/signals/{watchlist_id}/history

특정 종목의 신호 전환 이력 조회.

**응답 200**:
```json
{
  "items": [
    {
      "id": 1,
      "signal_state": "BUY",
      "prev_state": "NEUTRAL",
      "confidence": 85.0,
      "timeframe": "1h",
      "price": 72500.0,
      "rsi": 28.5,
      "detected_at": "2026-03-16T10:30:00"
    }
  ],
  "total": 10,
  "page": 1,
  "per_page": 20
}
```

**쿼리 파라미터**:
- `page` (선택): 페이지 번호. 기본값 1
- `per_page` (선택): 페이지당 개수. 기본값 20, 최대 100
- `signal_state` (선택): 상태 필터

---

## 알림 API

### GET /api/alerts

알림 발송 이력 조회.

**응답 200**:
```json
{
  "items": [
    {
      "id": 1,
      "signal_history_id": 1,
      "symbol": "005930",
      "display_name": "삼성전자",
      "channel": "telegram",
      "sent_at": "2026-03-16T10:30:05",
      "success": true,
      "error_message": null
    }
  ],
  "total": 5,
  "page": 1,
  "per_page": 20
}
```

**쿼리 파라미터**:
- `page`, `per_page`: 페이지네이션
- `success` (선택): 성공/실패 필터

---

## 시스템 API

### GET /api/system/health

시스템 헬스 상태 조회.

**응답 200**:
```json
{
  "status": "healthy",
  "last_scan_at": "2026-03-16T10:30:00",
  "next_scan_at": "2026-03-16T10:40:00",
  "active_symbols": 15,
  "markets": {
    "KR": { "status": "open", "next_change": "15:30 KST" },
    "US": { "status": "closed", "next_change": "23:30 KST" },
    "CRYPTO": { "status": "open", "next_change": null }
  },
  "errors_last_hour": 0,
  "telegram_configured": true,
  "uptime_seconds": 3600
}
```

---

### GET /api/system/logs

시스템 로그 조회.

**응답 200**:
```json
{
  "items": [
    {
      "id": 1,
      "level": "ERROR",
      "source": "fetcher",
      "message": "yfinance 005930.KS 데이터 수집 실패",
      "details": "{\"error\": \"ConnectionTimeout\", \"retry\": 3}",
      "created_at": "2026-03-16T10:25:00"
    }
  ],
  "total": 50,
  "page": 1,
  "per_page": 50
}
```

**쿼리 파라미터**:
- `level` (선택): 로그 레벨 필터 — `INFO`, `WARN`, `ERROR`
- `source` (선택): 소스 필터
- `page`, `per_page`: 페이지네이션

---

## 설정 API

### GET /api/settings

현재 시스템 설정 조회.

**응답 200**:
```json
{
  "alert_cooldown_minutes": 30,
  "min_signal_grade": "WEAK",
  "system_error_alert": true,
  "neutral_alert": false,
  "telegram_configured": true
}
```

---

### PATCH /api/settings

시스템 설정 수정 (부분 업데이트).

**요청 본문** (모든 필드 선택):
```json
{
  "alert_cooldown_minutes": 60,
  "min_signal_grade": "NORMAL"
}
```

**응답 200**: 수정된 전체 설정 정보

---

## 웹훅 API

### POST /api/webhook/tradingview

TradingView Alert 웹훅 수신.

**헤더**:
- `X-TV-Webhook-Secret`: 웹훅 시크릿 (필수)

**요청 본문** (TradingView Alert 페이로드):
```json
{
  "symbol": "005930",
  "market": "KR",
  "signal": "BUY",
  "price": 72500,
  "timeframe": "1h",
  "indicators": {
    "rsi": 28.5,
    "macd_hist": 0.35,
    "bb_pct_b": 0.05,
    "volume_ratio": 1.8
  }
}
```

**응답 200**: 처리 완료
```json
{
  "status": "processed",
  "signal_state": "BUY",
  "confidence": 85.0
}
```

**응답 401**: 시크릿 검증 실패
```json
{
  "detail": "유효하지 않은 웹훅 시크릿"
}
```

**응답 422**: 페이로드 형식 오류

---

## 수동 스캔 API

### POST /api/scan/trigger

수동으로 즉시 스캔 실행 (디버깅/테스트용).

**요청 본문** (선택):
```json
{
  "watchlist_ids": [1, 2, 3]
}
```
- `watchlist_ids` 미지정 시 활성 전체 종목 스캔

**응답 202**: 스캔 시작됨
```json
{
  "status": "scan_started",
  "target_count": 3
}
```

**응답 409**: 이미 스캔 진행 중
```json
{
  "detail": "스캔이 이미 진행 중입니다"
}
```

---

## 공통 에러 응답

모든 엔드포인트에 공통 적용되는 에러 형식:

```json
{
  "detail": "에러 메시지"
}
```

| 상태 코드 | 의미 |
|-----------|------|
| 400 | 잘못된 요청 (유효성 검증 실패) |
| 401 | 인증 실패 (웹훅 시크릿) |
| 404 | 리소스 없음 |
| 409 | 충돌 (중복 등록, 스캔 진행 중) |
| 422 | 처리 불가 (형식 오류) |
| 500 | 서버 내부 오류 |
