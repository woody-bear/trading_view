# Implementation Plan: 국내주식 BUY 신호 텔레그램 정기 알림

**Branch**: `003-kr-buy-telegram-alert` | **Date**: 2026-03-21 | **Spec**: [spec.md](./spec.md)

## Summary

매일 10:30/15:00 KST에 3일 이내 BUY 신호가 발생한 국내주식(코스피/코스닥) 목록을 텔레그램으로 자동 발송. 기존 APScheduler에 크론 작업 추가, 기존 `signal_history` + `telegram_bot` 인프라 재사용. 알림 이력 페이지로 발송 모니터링.

## Technical Context

**Language/Version**: Python 3.12 + TypeScript 5.x (React 18)
**Primary Dependencies**: APScheduler (기존), telegram Bot API (기존), SQLAlchemy (기존)
**Storage**: SQLite — alert_log 테이블 확장 (alert_type, symbol_count 컬럼 추가)
**Target Platform**: 웹 + 텔레그램
**Project Type**: Web application (SPA + API)
**Constraints**: 추가 의존성 0개, 기존 인프라 최대 재사용

## Constitution Check

Constitution 미정의 (템플릿). CLAUDE.md 규칙 기준:

| Gate | Status |
|------|--------|
| Docker 미사용 | PASS |
| SQLite 단일 DB | PASS — 기존 alert_log 확장, 신규 테이블 없음 |
| 단일 포트 8000 | PASS |
| 추가 의존성 최소화 | PASS — 0개 |

## Project Structure

```text
backend/
├── models.py                    # 수정: AlertLog에 alert_type, symbol_count 추가
├── scheduler.py                 # 수정: 10:30/15:00 크론 작업 추가
├── services/
│   ├── telegram_bot.py          # 수정: send_buy_signal_summary() 추가
│   └── buy_signal_alert.py      # 신규: BUY 신호 조회 + 메시지 생성 + 발송
└── routes/
    └── alerts.py                # 신규: /api/alerts/history, /api/alerts/buy-signal/test

frontend/src/
├── pages/
│   ├── AlertHistory.tsx         # 신규: 알림 이력 페이지
│   └── Settings.tsx             # 수정: BUY 신호 알림 테스트 버튼
├── api/client.ts                # 수정: fetchAlertHistory, testBuyAlert
└── App.tsx                      # 수정: /alerts 라우트 추가
```

## Implementation Approach

### Layer 1: 백엔드 — BUY 신호 조회 + 메시지 생성 + 발송 (US1+US2)
1. **DB 마이그레이션** — alert_log에 `alert_type` (default "realtime"), `symbol_count` 추가
2. **buy_signal_alert.py** — 3일 이내 BUY 신호 조회 → 메시지 생성 → 텔레그램 발송 → alert_log 기록
3. **telegram_bot.py** — `send_buy_signal_summary(text)` 추가 (기존 `send_message` 래핑 + 재시도)

### Layer 2: 백엔드 — 스케줄러 + API (US1+US3+US4)
4. **scheduler.py** — 10:30/15:00 KST 크론 작업 등록 (`day_of_week='mon-fri'`)
5. **routes/alerts.py** — GET /alerts/history + POST /alerts/buy-signal/test

### Layer 3: 프론트엔드 — 이력 페이지 + 테스트 버튼 (US3+US4)
6. **AlertHistory.tsx** — 아코디언 목록, 성공/실패 색상, 메시지 펼치기
7. **Settings.tsx** — "BUY 신호 알림 테스트" 버튼 추가
8. **App.tsx/client.ts** — 라우트 + API 함수 추가

### 의존 관계
```
Layer 1 (순차)
  DB 마이그레이션 → buy_signal_alert.py → telegram_bot.py 확장
                              │
Layer 2 (Layer 1 이후)        │
  scheduler.py ───────────────┤
  routes/alerts.py ───────────┤
                              │
Layer 3 (Layer 2와 병렬 가능)  │
  AlertHistory.tsx ───────────┤
  Settings.tsx 수정 ───────────┤
  App.tsx + client.ts ─────────┘
```
