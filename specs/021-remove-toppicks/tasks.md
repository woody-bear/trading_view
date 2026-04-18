# Tasks: 추천종목(TopPicks) 기능 완전 삭제

**Input**: Design documents from `/specs/021-remove-toppicks/`  
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅

> ⚠️ **이 파일은 `/speckit.implement` 명령어로만 실행됩니다.**  
> 직접 수동 수정하지 말고, speckit 워크플로우를 통해서만 진행하세요.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 해당 태스크가 속하는 User Story (US1, US2, US3)
- 각 태스크는 정확한 파일 경로를 포함

---

## Phase 1: Frontend UI 제거 (User Story 1 - Priority P1) 🎯 MVP

**Goal**: 대시보드와 스캔 화면에서 추천종목 관련 UI 요소를 완전히 제거한다.

**Independent Test**: 앱 실행 후 대시보드(홈)와 스캔 탭에서 '추천종목' 텍스트, 카드, 섹션이 0개 노출되면 완료.

### Implementation for User Story 1

- [x] T001 [US1] `frontend/src/pages/TopPicks.tsx` 파일 전체 삭제
- [x] T002 [P] [US1] `frontend/src/pages/Dashboard.tsx`에서 `picks` 상태 필드, `allPicks` 배열 생성 로직, picks 관련 렌더링 블록 제거
- [x] T003 [P] [US1] `frontend/src/pages/Scan.tsx`에서 `picks` 상태 필드, `allPicks` 계산 로직, "추천종목" Section 3 전체 렌더링 블록 제거
- [x] T004 [P] [US1] `frontend/src/api/client.ts`에서 `fetchLatestPicks()` 함수와 `scanMarket()` 함수 삭제

**Checkpoint**: T001~T004 완료 후 — 대시보드/스캔 화면에 추천종목 섹션이 사라졌는지 육안 확인

---

## Phase 2: Backend 코드 및 DB 정리 (User Story 3 - Priority P2)

**Goal**: 추천종목 전용 API 엔드포인트, 서비스 파일, DB 테이블을 제거해 코드베이스를 정리한다.

**Independent Test**: 백엔드 서버 기동 오류 0건 + `GET /api/scan/market/latest` 호출 시 404 반환 확인.

> ℹ️ Phase 1과 병렬 진행 가능 (다른 파일 영역)

### Implementation for User Story 3

- [x] T005 [P] [US3] `backend/routes/market_scan.py`에서 `POST /scan/market` 엔드포인트, `GET /scan/market/latest` 엔드포인트, `_save_daily()` 함수 삭제 및 `market_scanner` import 제거
- [x] T006 [P] [US3] `backend/services/market_scanner.py` 파일 전체 삭제 (ScanResult, _check_trend, scan_market 포함)
- [x] T007 [P] [US3] `backend/services/full_market_scanner.py`에서 `picks` 카테고리 분류 로직 3줄 제거 (`if last_sq >= 1 and trend == "BULL": categories.append("picks")`)
- [x] T008 [P] [US3] `backend/models.py`에서 `DailyTopPick` ORM 클래스 전체 삭제 (Index 정의 포함)
- [x] T009 [US3] `backend/alembic/versions/78b47ebbdeb0_drop_daily_top_pick.py` 생성 — `daily_top_pick` 테이블 DROP migration + 로컬 SQLite DROP TABLE 직접 실행

**Checkpoint**: T005~T009 완료 후 — `cd backend && source .venv/bin/activate && python -c "from app import app"` 오류 없이 실행되는지 확인

---

## Phase 3: 회귀 검증 (User Story 2 - Priority P1)

**Goal**: 삭제 작업 후 BUY 종목 스캔, 과열 스캔, MAX SQ, chart_buy 스캔 기능이 정상 동작함을 확인한다.

**Independent Test**: 스캔 화면에서 BUY/과열 섹션 데이터 정상 표시 + 서버 로그에 picks 관련 오류 없음.

> ⚠️ Phase 1과 Phase 2가 모두 완료된 후 진행

### Implementation for User Story 2

- [x] T010 [US2] `cd frontend && pnpm build` 실행 — TypeScript 빌드 오류 0건 확인 ✅
- [x] T011 [US2] 로컬 SQLite `daily_top_pick` 테이블 직접 DROP 완료 (Alembic 마이그레이션 파일 생성됨 — PostgreSQL 적용은 Supabase 콘솔에서 진행)
- [x] T012 [US2] 백엔드 `from app import app` 임포트 오류 없이 성공 ✅
- [x] T013 [US2] `fetchLatestPicks`, `DailyTopPick`, `market_scanner`, `scanMarket` 참조 0건 확인 ✅
- [ ] T014 [US2] 스캔 화면에서 BUY 종목, 과열 종목 섹션이 정상 데이터를 표시하는지 육안 확인

**Checkpoint**: 모든 검증 통과 → 삭제 완료 확정

---

## Phase 4: 마무리

**Purpose**: 코드 정리 최종 확인

- [x] T015 `backend/routes/market_scan.py`에서 picks 관련 불필요한 import 문 정리 완료 ✅
- [x] T016 `ruff check backend/` 실행 — Python lint 오류 0건 확인 ✅

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: 즉시 시작 가능
- **Phase 2 (US3)**: Phase 1과 동시에 병렬 진행 가능 (다른 파일 영역)
- **Phase 3 (US2 검증)**: Phase 1 + Phase 2 모두 완료 후 진행
- **Phase 4 (마무리)**: Phase 3 완료 후 진행

### User Story Dependencies

- **US1 (P1)**: 독립 실행 가능 — Frontend 파일만 수정
- **US3 (P2)**: US1과 독립 병렬 실행 가능 — Backend/DB 파일만 수정
- **US2 (P1 검증)**: US1 + US3 완료 후 실행 (검증 단계)

### Within Each Phase

- T002, T003, T004는 서로 다른 파일 → 병렬 실행 가능
- T005, T006, T007, T008은 서로 다른 파일 → 병렬 실행 가능
- T009 (Alembic migration)는 T008 (models.py DailyTopPick 삭제) 완료 후 진행 권장

---

## Parallel Example

```bash
# Phase 1 + Phase 2 동시 진행 가능:

# [터미널 A - Frontend]
Task: "T001 TopPicks.tsx 삭제"
Task: "T002 Dashboard.tsx picks 제거"
Task: "T003 Scan.tsx 추천종목 섹션 제거"
Task: "T004 client.ts 함수 삭제"

# [터미널 B - Backend]
Task: "T005 market_scan.py 엔드포인트 삭제"
Task: "T006 market_scanner.py 파일 삭제"
Task: "T007 full_market_scanner.py picks 로직 제거"
Task: "T008 models.py DailyTopPick 삭제"
Task: "T009 Alembic migration 생성"
```

---

## Implementation Strategy

### MVP First (Phase 1 Only)

1. Phase 1 완료 (T001~T004) → 화면에서 추천종목 즉시 제거
2. **STOP and VALIDATE**: 대시보드/스캔 화면 육안 확인
3. Phase 2, 3, 4로 순차 진행

### 전체 삭제 완료 순서

1. Phase 1 + Phase 2 병렬 진행
2. Phase 3 검증 (빌드 + 서버 기동 + grep 참조 확인)
3. Phase 4 마무리 (lint 정리)
4. 커밋

---

## Notes

- [P] 태스크 = 다른 파일, 의존성 없음 → 병렬 실행 가능
- 각 Phase의 Checkpoint에서 중간 검증 필수
- `market_scanner.py` 삭제 전 `market_scan.py`의 import 제거 선행 권장
- Alembic migration downgrade 함수에 `daily_top_pick` 테이블 재생성 코드 포함 (롤백 대비)
