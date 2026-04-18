# Research: 국내주식 BUY 신호 텔레그램 정기 알림

**Date**: 2026-03-21 | **Branch**: `003-kr-buy-telegram-alert`

## R-001: BUY 신호 종목 조회 방법

**Decision**: `signal_history` 테이블에서 최근 3일(자연일) 이내 BUY/SQZ BUY 상태 전환 이력 조회

**Rationale**:
- `current_signal`은 현재 신호 상태만 가지고 있어 "3일 이내 발생"을 추적 불가
- `signal_history`는 `detected_at` 타임스탬프와 `signal_state` (BUY/SELL/NEUTRAL)를 기록
- `signal_history` + `watchlist` JOIN으로 종목명, 심볼, 시장 정보 획득
- KR(KOSPI/KOSDAQ) 시장 필터 적용

**쿼리 로직**:
```
SELECT sh.*, w.symbol, w.display_name, w.market
FROM signal_history sh
JOIN watchlist w ON sh.watchlist_id = w.watchlist_id
WHERE sh.signal_state IN ('BUY')
  AND sh.detected_at >= now() - 3days
  AND w.market IN ('KR', 'KOSPI', 'KOSDAQ')
ORDER BY sh.confidence DESC
```
- SQZ BUY는 `signal_state='BUY'` + `squeeze_level > 0`으로 구분 가능

**Alternatives Considered**:
- `current_signal` 조회: 현재 BUY 상태인 종목만 가져오므로 "3일 이내 발생 후 NEUTRAL로 전환된 종목"을 놓침
- 별도 테이블 생성: 기존 `signal_history`로 충분, 불필요한 중복

## R-002: APScheduler 크론 작업 등록

**Decision**: 기존 `scheduler.py`의 `setup_scheduler()`에 2개 크론 작업 추가

**Rationale**:
- 기존 `AsyncIOScheduler`에 `add_job(trigger='cron', ...)`으로 등록
- `hour=10, minute=30` / `hour=15, minute=0` (KST는 서버 시간과 동일하다고 가정)
- `day_of_week='mon-fri'`로 주말 제외
- `misfire_grace_time=300`으로 서버 재시작 시 5분 이내면 발송

**Alternatives Considered**:
- OS crontab: 프로세스 외부 의존, 현재 구조와 맞지 않음
- `interval` 트리거: 정확한 시간 지정 불가

## R-003: 텔레그램 메시지 포맷

**Decision**: HTML parse_mode로 구조화된 메시지, 기존 `send_message()` 활용

**메시지 포맷**:
```
📊 국내주식 BUY 신호 (3/21 10:30)

1. 삼성전자 (005930)
   💰 50,000원 (+1.2%)
   🔥 STRONG (85점) | 신호일: 3/21
   📈 상세보기

2. SK하이닉스 (000660)
   💰 185,000원 (-0.5%)
   ⚡ NORMAL (72점) | 신호일: 3/20
   📈 상세보기

총 2종목 | 추세추종 연구소
```
- "상세보기" 링크: `<a href="{BASE_URL}/{symbol}">📈 상세보기</a>`
- BASE_URL은 `.env`의 `APP_URL` 또는 기본값 `http://localhost:3000`

**Alternatives Considered**:
- Markdown 포맷: 텔레그램 Markdown v2는 특수문자 이스케이프가 번거로움
- 인라인 키보드: 과잉 — 링크만으로 충분

## R-004: 알림 이력 저장

**Decision**: 기존 `alert_log` 테이블 확장 사용 — `alert_type` 컬럼 추가로 정기/실시간 구분

**Rationale**:
- 기존 `alert_log`에 `channel`, `message`, `success`, `error_message` 이미 존재
- `alert_type='scheduled_buy'` 추가하여 정기 BUY 알림과 기존 실시간 신호 알림 구분
- `signal_history_id`는 nullable (정기 알림은 여러 종목을 한 메시지에 묶으므로 1:1 매핑 불가)
- `message` 필드에 전송된 전체 메시지 내용 저장

**Alternatives Considered**:
- 별도 `buy_alert_history` 테이블: 구조가 유사하여 중복
- 메모리 캐시만: 서버 재시작 시 유실

## R-005: 알림 이력 API 및 프론트엔드

**Decision**: `GET /api/alerts/history` API + `/alerts` 프론트 페이지

**API 응답**: `{ alerts: [{ id, sent_at, alert_type, success, error_message, message, symbol_count }] }`
**프론트**: 아코디언 목록 — 클릭 시 `message` 내용 펼침
**라우팅**: `/alerts` 경로, 모바일 하단 탭에서는 설정 내 링크로 접근

**Alternatives Considered**:
- 설정 페이지 내 섹션: 페이지가 길어지고 관심사 분리 안 됨
- 별도 탭 추가: 모바일 탭바 공간 부족 (이미 5탭)
