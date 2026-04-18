# Tasks: BUY 차트 라벨 클릭 — 사례 스크랩 추가

**Input**: Design documents from `/specs/010-chart-buy-scrap/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

**Purpose**: 기존 프로젝트 구조 확인 — 신규 파일/의존성 불필요, 변경은 Phase 2부터

- [X] T001 기존 코드베이스 파악 확인 — backend/models.py PatternCase, backend/routes/pattern_cases.py, frontend/src/pages/Scrap.tsx, frontend/src/components/charts/IndicatorChart.tsx 구조 확인 (읽기 전용 검토)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 의존하는 DB 스키마 + 백엔드 API + 프론트 API 클라이언트. 이 Phase 완료 전까지 어떤 User Story도 시작 불가.

**⚠️ CRITICAL**: US1, US2, US3 모두 이 Phase에 의존

- [X] T002 Alembic 마이그레이션 `016_add_source_user_id_pattern_case.py` 생성 — `pattern_case` 테이블에 `source VARCHAR(20) DEFAULT 'manual'` + `user_id UUID nullable` 컬럼 추가, UNIQUE constraint `(user_id, symbol, signal_date)`, INDEX `idx_pattern_case_user` 추가. 파일: `backend/alembic/versions/016_add_source_user_id_pattern_case.py`

- [X] T003 `backend/models.py` PatternCase 클래스에 `source: Mapped[str]` (default `'manual'`) + `user_id: Mapped[Optional[uuid.UUID]]` 필드 추가

- [X] T004 `backend/routes/pattern_cases.py` 업데이트 — (1) `PatternCaseCreate` 스키마에 `source: str = 'manual'` 추가, (2) `GET /pattern-cases`에 `user_id` 쿼리 필터 추가, (3) `POST /pattern-cases`에 중복 체크 로직 추가 (동일 user_id+symbol+signal_date 존재 시 409 반환), (4) `GET /pattern-cases/check?symbol=&signal_date=` 신규 엔드포인트 추가 (`{"exists": bool, "id": int|null}` 반환), (5) `_to_dict()`에 `source`, `user_id` 필드 포함

- [X] T005 `backend/routes/quick_chart.py`에 `GET /api/chart/indicators-at?symbol=&market=&date=` 엔드포인트 추가 — `get_chart_data(symbol, market, "1d", 300)` 호출 후 date에 해당하는 행 찾아 rsi/bb_pct_b/bb_width/macd_hist/volume_ratio/ema_alignment/squeeze_level/conditions_met/close 반환. 해당 날짜 없으면 404

- [X] T006 `frontend/src/api/client.ts`에 신규 함수 2개 추가 — `checkPatternCaseDuplicate(symbol: string, signalDate: string)` → `GET /pattern-cases/check`, `fetchIndicatorsAt(symbol: string, market: string, date: string)` → `GET /chart/indicators-at`

**Checkpoint**: DB 마이그레이션 실행 후 `/api/pattern-cases/check`, `/api/chart/indicators-at` API 호출 가능

---

## Phase 3: User Story 1 — BUY 라벨 호버 → 스크랩 저장 (Priority: P1) 🎯 MVP

**Goal**: 차트 BUY 마커 위에 마우스를 올리면 저장 버튼 오버레이가 표시되고, 클릭 시 지표값과 함께 PatternCase로 저장된다

**Independent Test**: SignalDetail 차트에서 BUY 마커 위로 마우스 이동 → 오버레이 버튼 표시 확인 → 버튼 클릭 → Scrap 페이지에서 해당 종목/날짜 항목 확인

### Implementation for User Story 1

- [X] T007 [US1] `frontend/src/components/charts/IndicatorChart.tsx` Props 확장 — `scrapedDates?: Set<string>` (스크랩된 YYYY-MM-DD 집합) + `onScrapSave?: (markerTime: number, date: string) => void` Props 추가. BUY 마커(`text === 'BUY' || 'SQZ BUY'`)가 scrapedDates에 포함된 날짜이면 마커 색상을 골드(`#f59e0b`)로 렌더링 (기존 `originalColors` 맵에서 조건 분기)

- [X] T008 [US1] `frontend/src/components/charts/IndicatorChart.tsx` 호버 오버레이 추가 — (1) 차트 컨테이너 div에 `position: relative` 적용, (2) `subscribeCrosshairMove` 핸들러 내에서 `param.time`이 BUY 마커 time과 일치하면 `mainChart.timeScale().timeToCoordinate(param.time)` + `candleSeries.priceToCoordinate(candle.close)` 로 x/y 픽셀 계산, (3) 오버레이 상태 `overlayState: { visible, x, y, markerTime, date, isScraped }` 를 `useRef`로 DOM 직접 조작하거나 `useState`로 관리, (4) 오버레이 div를 차트 컨테이너 위에 `position: absolute`로 렌더링 — 미스크랩: "이 BUY 사례 저장" 버튼(초록), 스크랩됨: "저장됨 ✓" 텍스트(골드). (5) 가장자리 보정: x < 80이면 오른쪽 정렬, x > chartWidth-80이면 왼쪽 정렬. (6) `hasHover` 체크 — 모바일에서는 `subscribeClick`으로 동일 오버레이 표시 (2초 후 자동 숨김)

- [X] T009 [US1] `frontend/src/pages/SignalDetail.tsx` scrapedDates 연동 — (1) 현재 symbol에 대한 PatternCase 목록 조회 (`fetchPatternCases({})` → symbol 필터) 후 `signal_date` Set 생성, (2) IndicatorChart에 `scrapedDates` prop 전달, (3) `onScrapSave` 핸들러 구현: `checkPatternCaseDuplicate` 호출 → 중복이면 토스트 경고, 아니면 `fetchIndicatorsAt` 호출 → `createPatternCase`로 저장 (`source: 'chart'`, `pattern_type` 자동 추정: squeeze_level >= 1이면 'squeeze_breakout', rsi < 40이면 'oversold_bounce', 나머지 'custom', `title` 자동생성: `${stock_name} ${signal_date} BUY`) → 저장 성공 시 scrapedDates 업데이트 + 성공 토스트

**Checkpoint**: US1 완료 — 차트에서 BUY 마커 호버 후 저장 버튼 클릭 → Scrap 목록에 사례 추가됨

---

## Phase 4: User Story 2 — 스크랩 목록 조회 및 삭제 (Priority: P2)

**Goal**: 스크랩된 BUY 사례 목록에서 지표값 확인, 차트로 이동, 사례 삭제 (인라인 확인 UI)

**Independent Test**: Scrap 페이지 진입 → 사례 아코디언 열기 → 출처 뱃지 확인 → "차트 보기" 버튼 클릭 → 해당 종목 차트 이동 확인 → 삭제 버튼 → 인라인 "확인/취소" 표시 → 확인 클릭 → 목록에서 제거 확인

### Implementation for User Story 2

- [X] T010 [US2] `frontend/src/pages/Scrap.tsx` PatternCase 타입에 `source: string` 필드 추가 및 PATTERN_TYPES 필터 탭에 `'chart'` 타입 추가 (`label: '차트 BUY'`, `color: 'text-green-400'`)

- [X] T011 [P] [US2] `frontend/src/pages/Scrap.tsx` CaseAccordion 헤더에 출처 뱃지 추가 — 패턴뱃지 옆에 소형 뱃지: `source === 'chart'` → `📊 차트` (회색 bg), else → `✏️ 수동` (회색 bg). 기존 헤더 레이아웃 유지

- [X] T012 [US2] `frontend/src/pages/Scrap.tsx` CaseAccordion 인라인 삭제 확인 UI 구현 — (1) `confirmDelete: boolean` state 추가, (2) 삭제 버튼 클릭 시 `confirmDelete = true` → 해당 행 하단에 `"정말 삭제하시겠습니까? [확인] [취소]"` 인라인 표시, (3) 확인 클릭 → `onDelete(c.id)` 호출, (4) 취소 클릭 → `confirmDelete = false`. `window.confirm` 완전 제거

- [X] T013 [P] [US2] `frontend/src/pages/Scrap.tsx` CaseAccordion 아코디언 바디에 "차트 보기" 버튼 추가 — `useNavigate`로 `/${c.symbol}?market=${c.market_type || c.market}&highlightDate=${c.signal_date}` 이동. 기존 "수정" 버튼 옆에 배치

**Checkpoint**: US2 완료 — Scrap 페이지에서 출처 확인, 차트 이동, 인라인 삭제 모두 동작

---

## Phase 5: User Story 3 — 사례 메모 추가 (Priority: P3)

**Goal**: 스크랩 사례 아코디언 내에서 메모를 직접 입력하면 1.5초 디바운스 후 자동 저장됨

**Independent Test**: Scrap 페이지에서 사례 아코디언 열기 → textarea에 메모 입력 → "저장 중..." 표시 확인 → 1.5초 후 "저장됨" 표시 → 페이지 새로고침 후 메모 내용 유지 확인

### Implementation for User Story 3

- [X] T014 [US3] `frontend/src/pages/Scrap.tsx` CaseAccordion에 인라인 메모 textarea + debounce 자동저장 구현 — (1) `notesDraft: string` + `notesStatus: 'idle'|'saving'|'saved'` + `notesTimer: ReturnType<typeof setTimeout>|null` state 추가, (2) textarea `onChange`: notesDraft 업데이트 + 기존 타이머 클리어 + 1500ms 후 `updatePatternCase(c.id, { notes: draft })` 호출, (3) 저장 중 `notesStatus='saving'` → "저장 중..." 표시, 완료 시 `notesStatus='saved'` → "저장됨" 표시 (3초 후 'idle'로 복귀), (4) 기존 CaseFormModal의 notes 편집 기능은 유지(modal에서도 수정 가능), textarea는 아코디언 바디 하단 IndicatorTable 아래에 인라인 배치, placeholder: "매수 이유, 패턴 특징, 향후 활용 방안..."

**Checkpoint**: US3 완료 — 메모 자동저장 및 유지 동작

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 엣지 케이스, UX 마무리

- [X] T015 `backend/app.py` (또는 router 등록 파일)에서 `GET /api/chart/indicators-at` 라우터가 등록되어 있는지 확인 및 `quick_chart.router` 마운트 확인

- [X] T016 [P] DB 마이그레이션 실행 확인 — `cd backend && alembic upgrade head` 실행하여 `016_` 마이그레이션 적용 확인

- [X] T017 [P] `frontend/src/pages/SignalDetail.tsx`에서 로그아웃 상태 대응 — `user`가 null이면 오버레이 저장 버튼 비활성화 또는 미표시 (`useAuthStore` 활용)

- [X] T018 중복 저장 시 토스트 메시지 확인 — "이미 스크랩된 사례입니다 (종목·날짜)" 형식, 기존 `useToastStore` 활용

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 — **US1/US2/US3 모두 BLOCK**
- **Phase 3 (US1)**: Phase 2 완료 필수 (scrapedDates가 DB에서 오고, indicators-at API 필요)
- **Phase 4 (US2)**: Phase 2 완료 필수 (source 필드 필요) — US1과 병렬 가능
- **Phase 5 (US3)**: Phase 2 + US2 완료 후 (CaseAccordion 기반 위에 textarea 추가)
- **Phase 6 (Polish)**: 모든 US 완료 후

### User Story Dependencies

- **US1 (P1)**: Phase 2 완료 후 시작
- **US2 (P2)**: Phase 2 완료 후 시작 — US1과 독립적으로 병렬 작업 가능
- **US3 (P3)**: US2의 CaseAccordion 컴포넌트 필요

### Within Each User Story

- T007 → T008 (같은 파일 IndicatorChart.tsx, 순차 필요)
- T008 → T009 (IndicatorChart props 확정 후 SignalDetail 연동)
- T010 → T011, T012, T013 (타입 추가 후 UI 변경, T011과 T013은 병렬 가능)
- T012 → T014 (삭제 UI 완성 후 메모 추가)

### Parallel Opportunities

- T002, T003, T004, T005, T006 — Phase 2 내에서 T002→T003 순차, T004·T005·T006은 T002와 병렬
- T011, T013 — Phase 4 내 병렬 (각각 다른 UI 요소)
- T015, T016, T017 — Phase 6 내 병렬

---

## Parallel Example: Phase 2 실행

```bash
# T002 먼저 (DB 스키마 기준):
Task: "016 마이그레이션 파일 생성 in backend/alembic/versions/"

# T002 완료 후 병렬:
Task: "models.py PatternCase 업데이트"          # T003
Task: "/api/chart/indicators-at 엔드포인트"     # T004
Task: "client.ts 신규 API 함수"                # T006
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup 확인
2. Phase 2: Foundational 완료 (T002~T006)
3. Phase 3: US1 완료 (T007~T009)
4. **STOP and VALIDATE**: 차트에서 BUY 마커 저장 동작 확인
5. 검증 완료 후 US2/US3 진행

### Incremental Delivery

1. Phase 2 완료 → API 기반 준비
2. US1 완료 → 차트에서 BUY 사례 저장 가능 (MVP!)
3. US2 완료 → Scrap 목록에서 출처/차트이동/삭제 개선
4. US3 완료 → 메모 인라인 자동저장

---

## Notes

- `pattern_case` 테이블은 SQLite WAL — Alembic 마이그레이션으로 컬럼 추가 (ALTER TABLE)
- `user_id` nullable 유지 — 기존 데이터 호환
- IndicatorChart.tsx 수정 시 기존 `onBuyMarkerClick` (매수지점 기록) 인터페이스 유지 — 파괴적 변경 금지
- Scrap.tsx의 기존 CaseFormModal(수정 모달)은 유지 — notes 편집만 인라인 추가, 나머지 필드는 기존 모달 경유
- [P] 태스크 = 다른 파일 또는 독립 로직, 병렬 실행 가능
