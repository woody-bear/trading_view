# Implementation Plan: 추천종목(TopPicks) 기능 완전 삭제

**Branch**: `021-remove-toppicks` | **Date**: 2026-04-12 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/021-remove-toppicks/spec.md`

## Summary

추천종목(TopPicks) 기능을 프론트엔드 UI, API 클라이언트, 백엔드 라우터/서비스, DB 테이블까지 완전히 제거한다.  
삭제 순서는 ① Frontend UI → ② API Client → ③ Backend Route/Service → ④ DB 순으로 진행하며,  
BUY 종목 / 과열 / MAX SQ / chart_buy 스캔 기능은 독립적으로 유지된다.

## Technical Context

**Language/Version**: Python 3.12 (backend) + TypeScript 5.x / React 18 (frontend)  
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0 async, Alembic (backend) / React 18, React Query, Tailwind CSS v4 (frontend)  
**Storage**: SQLite WAL (aiosqlite) — `daily_top_pick` 테이블 삭제 대상  
**Testing**: ruff (Python lint) + pnpm build (TypeScript 타입 체크)  
**Target Platform**: 로컬 웹 서비스 (단일 포트 8000)  
**Project Type**: Web application (FastAPI + React SPA)  
**Performance Goals**: N/A (삭제 작업)  
**Constraints**: 기존 스캔 기능(BUY/과열/MAX SQ) 회귀 없어야 함  
**Scale/Scope**: 8개 파일 수정/삭제 + Alembic migration 1개 추가

## Constitution Check

> Constitution이 정의되지 않은 프로젝트 — CLAUDE.md의 Critical Rules 기준 적용

| Gate | Status | Notes |
|------|--------|-------|
| 스캔 종목 ↔ 조회 종목 동기화 | PASS | 삭제 작업이므로 종목 추가/수정 없음 |
| 기존 기능 회귀 없음 | MUST VERIFY | BUY/과열/MAX SQ/chart_buy 스캔 동작 확인 필요 |
| 빌드 오류 없음 | MUST VERIFY | `pnpm build` + 백엔드 임포트 체크 |

## Project Structure

### Documentation (this feature)

```text
specs/021-remove-toppicks/
├── plan.md              # This file
├── research.md          # Phase 0 output (사전 분석 완료)
├── data-model.md        # Phase 1 output (삭제 대상 엔티티 명세)
└── tasks.md             # Phase 2 output (/speckit.tasks 명령으로 생성)
```

### Source Code — 수정/삭제 대상 파일

```text
frontend/src/
├── pages/
│   ├── TopPicks.tsx         # [DELETE] 파일 전체 삭제
│   ├── Dashboard.tsx        # [MODIFY] picks 상태/allPicks/렌더링 블록 제거
│   └── Scan.tsx             # [MODIFY] 추천종목 섹션 + picks 상태 제거
└── api/
    └── client.ts            # [MODIFY] fetchLatestPicks(), scanMarket() 삭제

backend/
├── models.py                # [MODIFY] DailyTopPick ORM 클래스 삭제
├── routes/
│   └── market_scan.py       # [MODIFY] /scan/market 엔드포인트 + _save_daily() 삭제
├── services/
│   ├── market_scanner.py    # [DELETE] 파일 전체 삭제
│   └── full_market_scanner.py  # [MODIFY] picks 카테고리 분류 로직 제거
└── alembic/versions/
    └── [new].py             # [CREATE] daily_top_pick 테이블 DROP 마이그레이션
```

**Structure Decision**: Web application (Option 2). 프론트엔드와 백엔드가 분리된 구조.

## Complexity Tracking

> Constitution 위반 없음 — 단순 코드 삭제 작업
