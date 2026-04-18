# Tasks: 국내주식 BUY 신호 텔레그램 정기 알림

**Input**: Design documents from `/specs/003-kr-buy-telegram-alert/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested — test tasks are excluded.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Path Conventions

- **Backend**: `backend/` (Python 3.12, FastAPI)
- **Frontend**: `frontend/src/` (React 18, TypeScript, Tailwind CSS)

---

## Phase 1: Setup

**Purpose**: DB 스키마 확장 및 신규 파일 준비

- [x] T001 Add `alert_type` (str, default "realtime") and `symbol_count` (int, nullable) columns to `AlertLog` model in `backend/models.py`
- [x] T002 Create Alembic migration for alert_log schema change — run `alembic revision --autogenerate -m "add alert_type and symbol_count to alert_log"` then `alembic upgrade head` in `backend/`

**Checkpoint**: DB 스키마 준비 완료

---

## Phase 2: User Story 1+2 — BUY 신호 정기 알림 + 메시지 포맷 (Priority: P1) 🎯 MVP

**Goal**: 매일 10:30/15:00 KST에 3일 이내 BUY 신호 국내종목 목록을 텔레그램으로 자동 전송

**Independent Test**: 수동으로 알림 함수를 호출하여 BUY 신호 종목 메시지가 텔레그램에 도착하는지 확인

### Implementation

- [x] T003 [US1] Create `backend/services/buy_signal_alert.py` — implement `get_recent_buy_signals(days=3)` function that queries `signal_history` JOIN `watchlist` for BUY state signals within last 3 natural days, filtered to KR/KOSPI/KOSDAQ markets, deduplicated by symbol (latest signal kept), sorted by confidence DESC, limited to 20 (per research.md R-001)
- [x] T004 [US2] Add `format_buy_signal_message(signals, timestamp)` function in `backend/services/buy_signal_alert.py` — generates HTML-formatted telegram message with: header (📊 국내주식 BUY 신호 + date/time), numbered list per signal (종목명 with link, 현재가, 등락률, 신호강도+신뢰도, 신호일), footer (총 N종목), "외 N개" truncation for >20 signals. Link format: `<a href="{APP_URL}/{symbol}">📈 상세보기</a>`. Empty state: "현재 BUY 신호 종목이 없습니다" (per contracts/alert-api.md)
- [x] T005 [US1] Add `send_buy_signal_summary(text)` method to `backend/services/telegram_bot.py` — wraps `send_message()` with retry logic (max 3 attempts, 10-second delay between retries), returns `(success: bool, error_message: str|None)` (per spec FR-011)
- [x] T006 [US1] Add `send_scheduled_buy_alert()` async function in `backend/services/buy_signal_alert.py` — orchestrates: check telegram configured (skip + log warning if not), call `get_recent_buy_signals()`, call `format_buy_signal_message()`, call `send_buy_signal_summary()`, save result to `alert_log` with `alert_type="scheduled_buy"` and `symbol_count` (per spec FR-001, FR-007, FR-008, FR-015)
- [x] T007 [US1] Register two cron jobs in `backend/scheduler.py` — add `send_scheduled_buy_alert` at `hour=10, minute=30` and `hour=15, minute=0` with `day_of_week='mon-fri'`, `misfire_grace_time=300`, `coalesce=True`, `max_instances=1` (per spec FR-001, FR-009, research.md R-002)

**Checkpoint**: 영업일 10:30/15:00에 BUY 신호 종목이 텔레그램으로 자동 발송됨

---

## Phase 3: User Story 3 — 수동 알림 전송 (Priority: P2)

**Goal**: 설정 화면에서 BUY 신호 알림을 즉시 수동 전송

**Independent Test**: 설정 > "BUY 신호 알림 테스트" 버튼 클릭 → 텔레그램 메시지 도착

### Implementation

- [x] T008 [P] [US3] Create `backend/routes/alerts.py` — add router with `POST /api/alerts/buy-signal/test` endpoint that calls `send_scheduled_buy_alert()` and returns `{ status, symbol_count, message }`. If telegram not configured, return `{ status: "error", message: "텔레그램 설정을 먼저 완료해주세요" }`. Register router in `backend/app.py` (per contracts/alert-api.md)
- [x] T009 [P] [US3] Add `testBuyAlert` API function in `frontend/src/api/client.ts` — `POST /api/alerts/buy-signal/test` returning response data
- [x] T010 [US3] Add "BUY 신호 알림 테스트" button to telegram section in `frontend/src/pages/Settings.tsx` — on click call `testBuyAlert()`, show success toast with symbol count or error toast, disable button while loading (per spec US3 scenarios)

**Checkpoint**: 설정 화면에서 수동 전송 + 성공/실패 토스트 확인

---

## Phase 4: User Story 4 — 알림 발송 이력 조회 (Priority: P2)

**Goal**: 별도 "알림 이력" 페이지에서 발송 내역 + 메시지 내용 조회

**Independent Test**: /alerts 페이지에서 발송 이력 목록 표시, 개별 항목 펼치면 메시지 내용 확인

### Implementation

- [x] T011 [US4] Add `GET /api/alerts/history` endpoint in `backend/routes/alerts.py` — query `alert_log` filtered by `alert_type="scheduled_buy"`, ordered by `sent_at DESC`, limit 20. Return `{ alerts: [{ id, sent_at, alert_type, success, error_message, message, symbol_count }] }` (per contracts/alert-api.md)
- [x] T012 [P] [US4] Add `fetchAlertHistory` API function in `frontend/src/api/client.ts` — `GET /api/alerts/history` returning alerts array
- [x] T013 [US4] Create `frontend/src/pages/AlertHistory.tsx` — page with accordion list of alert history items. Each item shows: sent_at (formatted), success/failure badge (green/red), symbol_count. Click to expand shows full `message` content. Empty state: "아직 발송된 알림이 없습니다". Failed items show `error_message` in red (per spec US4 scenarios)
- [x] T014 [US4] Add `/alerts` route in `frontend/src/App.tsx` — import AlertHistory page and add Route. Add link to alerts page from Settings page ("알림 이력 보기" link)

**Checkpoint**: /alerts 페이지에서 발송 이력 + 메시지 내용 + 실패 사유 확인 가능

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 통합 검증 및 정리

- [x] T015 Verify weekend skip — check that cron jobs have `day_of_week='mon-fri'` and do not fire on Saturday/Sunday by inspecting scheduler job list in `backend/scheduler.py`
- [x] T016 Verify server restart handling — confirm `misfire_grace_time=300` allows catch-up within 5 minutes, and that past-due jobs are coalesced (not duplicated) in `backend/scheduler.py`
- [x] T017 Run all quickstart.md test scenarios (6 items) — verify each passes manually
- [x] T018 Code cleanup — verify imports, remove unused code, ensure consistent logging in `backend/services/buy_signal_alert.py`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — DB migration first
- **US1+US2 (Phase 2)**: Depends on Setup — core alert logic
- **US3 (Phase 3)**: Depends on US1+US2 (reuses `send_scheduled_buy_alert`)
- **US4 (Phase 4)**: Depends on Setup (alert_log schema), can parallel with US3
- **Polish (Phase 5)**: After all stories complete

### User Story Dependencies

```
Phase 1 (Setup: DB migration)
        ↓
Phase 2 (US1+US2: 정기 알림 + 메시지 포맷) ← MVP
        ↓
Phase 3 (US3: 수동 전송)  ←→  Phase 4 (US4: 이력 페이지) [병렬 가능]
        ↓
Phase 5 (Polish)
```

### Parallel Opportunities

- **Phase 3+4**: US3(수동 전송)와 US4(이력 페이지)는 다른 파일을 수정하므로 병렬 가능
- **T008+T012**: routes/alerts.py의 두 엔드포인트를 한 파일에 구현하므로 T011은 T008 이후
- **T009+T012**: client.ts API 함수 2개는 같은 파일이지만 독립적 추가

---

## Implementation Strategy

### MVP First (US1+US2)

1. Phase 1: DB 마이그레이션
2. Phase 2: BUY 신호 조회 + 메시지 생성 + 텔레그램 발송 + 스케줄러 등록
3. **STOP and VALIDATE**: 수동으로 `send_scheduled_buy_alert()` 호출하여 텔레그램 수신 확인

### Incremental Delivery

1. Setup + US1+US2 → 정기 알림 동작 (MVP)
2. US3 → 수동 전송 버튼 (편의)
3. US4 → 이력 페이지 (모니터링)
4. Polish → 검증

---

## Notes

- US1과 US2는 같은 서비스 파일(`buy_signal_alert.py`)에서 구현되므로 하나의 Phase로 통합
- 기존 `telegram_bot.py`의 `send_message()` 재사용, retry 로직만 래핑 추가
- `signal_history` 테이블은 변경 없음 — 기존 데이터 조회만
- APP_URL은 `.env`에서 읽되, 미설정 시 기본값 `http://localhost:3000` 사용
