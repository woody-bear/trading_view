# WebSocket 계약: UBB Pro Signal System

**피처**: `001-ubb-pro-signal-system` | **날짜**: 2026-03-16
**엔드포인트**: `ws://localhost:8000/ws`

## 연결

클라이언트가 WebSocket 엔드포인트에 연결하면 서버가 신호 상태 변경, 스캔 완료, 시스템 이벤트를 실시간으로 푸시한다.

```text
클라이언트 ──── WebSocket 연결 ────► 서버 (ws://localhost:8000/ws)
         ◄──── 이벤트 메시지 ────
```

## 서버 → 클라이언트 메시지

모든 메시지는 JSON 형식이며 `type` 필드로 메시지 종류를 구분한다.

### signal_update

신호 상태가 업데이트되면 발송. 전환 여부와 무관하게 스캔 결과마다 발송.

```json
{
  "type": "signal_update",
  "data": {
    "watchlist_id": 1,
    "symbol": "005930",
    "display_name": "삼성전자",
    "market": "KR",
    "signal_state": "BUY",
    "prev_state": "NEUTRAL",
    "is_transition": true,
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
}
```

### scan_complete

한 번의 스캔 주기가 완료되면 발송.

```json
{
  "type": "scan_complete",
  "data": {
    "scanned_count": 15,
    "skipped_count": 2,
    "error_count": 0,
    "transitions": [
      {
        "watchlist_id": 1,
        "symbol": "005930",
        "prev_state": "NEUTRAL",
        "new_state": "BUY"
      }
    ],
    "completed_at": "2026-03-16T10:30:05",
    "next_scan_at": "2026-03-16T10:40:00",
    "duration_seconds": 5.2
  }
}
```

### system_event

시스템 상태 변경(시장 개장/폐장, 에러 등)을 알림.

```json
{
  "type": "system_event",
  "data": {
    "event": "market_open",
    "market": "KR",
    "message": "한국 시장 개장",
    "timestamp": "2026-03-16T09:00:00"
  }
}
```

가능한 event 값:
- `market_open`: 시장 개장
- `market_close`: 시장 폐장
- `scan_error`: 스캔 중 에러 발생
- `telegram_error`: 텔레그램 발송 실패
- `source_fallback`: 데이터 소스 fallback 전환

### alert_sent

텔레그램 알림 발송 결과.

```json
{
  "type": "alert_sent",
  "data": {
    "watchlist_id": 1,
    "symbol": "005930",
    "signal_state": "BUY",
    "success": true,
    "sent_at": "2026-03-16T10:30:05"
  }
}
```

## 클라이언트 → 서버 메시지

### ping

연결 유지용 핑. 서버는 `pong`으로 응답.

```json
{
  "type": "ping"
}
```

**서버 응답**:
```json
{
  "type": "pong",
  "timestamp": "2026-03-16T10:30:00"
}
```

## 연결 관리

- **재연결**: 클라이언트는 연결 끊김 시 지수 백오프(1초, 2초, 4초, 최대 30초)로 자동 재연결
- **하트비트**: 클라이언트가 30초 간격으로 ping 전송, 60초 내 pong 미수신 시 재연결
- **동시 연결**: 단일 사용자 시스템이므로 동시 연결 수 제한 없음 (다중 탭 허용)
