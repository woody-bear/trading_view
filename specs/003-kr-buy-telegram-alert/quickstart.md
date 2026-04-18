# Quickstart: 국내주식 BUY 신호 텔레그램 정기 알림

**Branch**: `003-kr-buy-telegram-alert`

## 변경 대상 파일

### 백엔드 수정
- `backend/models.py` — AlertLog에 `alert_type`, `symbol_count` 컬럼 추가
- `backend/scheduler.py` — 10:30/15:00 크론 작업 추가
- `backend/services/telegram_bot.py` — `send_buy_signal_summary()` 메서드 추가

### 백엔드 신규
- `backend/services/buy_signal_alert.py` — BUY 신호 조회 + 메시지 생성 + 발송 + 이력 저장
- `backend/routes/alerts.py` — `/api/alerts/history`, `/api/alerts/buy-signal/test`

### 프론트엔드 신규
- `frontend/src/pages/AlertHistory.tsx` — 알림 이력 페이지
- `frontend/src/api/client.ts` — fetchAlertHistory, testBuyAlert 추가

### 프론트엔드 수정
- `frontend/src/pages/Settings.tsx` — "BUY 신호 알림 테스트" 버튼 추가
- `frontend/src/App.tsx` — `/alerts` 라우트 추가

### DB 마이그레이션
- Alembic migration — alert_log에 alert_type, symbol_count 컬럼 추가

## 테스트 시나리오

1. **정기 알림**: 서버 시작 후 예정 시간(10:30/15:00)에 텔레그램 메시지 수신 확인
2. **수동 전송**: 설정 > "BUY 신호 알림 테스트" 클릭 → 텔레그램 메시지 수신
3. **신호 없음**: BUY 신호 종목이 없을 때 "신호 없음" 메시지 수신 확인
4. **이력 조회**: /alerts 페이지에서 발송 이력 목록 + 메시지 내용 펼치기
5. **주말 건너뜀**: 주말에 서버 실행 시 알림 미발송 확인 (로그)
6. **텔레그램 미설정**: 봇 토큰 없이 알림 시간 도래 → 로그에 경고, 발송 안 함
