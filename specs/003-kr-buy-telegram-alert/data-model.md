# Data Model: 국내주식 BUY 신호 텔레그램 정기 알림

**Date**: 2026-03-21 | **Branch**: `003-kr-buy-telegram-alert`

## 기존 테이블 변경

### alert_log (확장)

기존 필드 유지 + `alert_type` 컬럼 추가.

| Field | Type | 변경 | Description |
|-------|------|------|-------------|
| id | int (PK) | 유지 | |
| signal_history_id | int (FK, nullable) | 유지 | 실시간 알림은 1:1, 정기 알림은 null |
| channel | str | 유지 | "telegram" |
| alert_type | str | **신규** | "realtime" (기존) / "scheduled_buy" (정기 BUY 알림) |
| message | str (nullable) | 유지 | 전송된 메시지 전문 |
| sent_at | datetime | 유지 | 발송 시각 |
| success | bool | 유지 | 성공 여부 |
| error_message | str (nullable) | 유지 | 실패 사유 |
| symbol_count | int | **신규** | 전송된 종목 수 (정기 알림용) |

### signal_history (변경 없음)

기존 그대로 사용. `detected_at` + `signal_state` + `watchlist_id`로 3일 이내 BUY 조회.

### watchlist (변경 없음)

기존 그대로 사용. `market` 필드로 KR/KOSPI/KOSDAQ 필터.

## 신규 모델 없음

정기 알림 스케줄은 APScheduler 크론 설정으로 관리 (DB 저장 불필요).
알림 이력은 기존 `alert_log` 확장으로 충분.
