---
description: "Task list for 025-harness-engineering — .claude/ 재정비 + 프로젝트 세팅"
---

# Tasks: 하네스 엔지니어링 최적 구조화 (.claude/ 재정비 + 프로젝트 세팅)

**Input**: Design documents from `/specs/025-harness-engineering/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: 본 기능은 문서·설정 재정비이므로 **자동화된 코드 테스트 없음**. 검증은 Polish phase의 수동 감사(SC-001/SC-004/SC-005/SC-006/SC-008)로 대체.

**Organization**: 5개 User Story(US1~US5)를 priority(P1·P1·P2·P2·P3) 순으로 별도 phase에 배치. 각 story는 독립적으로 완료·검증 가능.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: 다른 파일·독립 작업 → 병렬 가능
- **[Story]**: US1~US5 매핑(Setup/Foundational/Polish는 라벨 없음)
- 파일 경로는 모두 저장소 루트 기준 상대 경로

## Path Conventions

- 본 기능은 **문서·설정 전용**. 코드 수정 없음.
- 수정 대상: `.claude/**`, `CLAUDE.md`, `.specify/memory/constitution.md`, `.claude/settings.local.json`
- 생성되는 새 파일: `.claude/README.md`, `.claude/archive/*`, `.claude/backend/{utils,migrations}.md`, `.claude/frontend/{utils,lib}.md`, `.claude/guides/drift-audit.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 정비 작업 착수 준비.

- [X] T001 Back up `.claude/settings.local.json` to `/tmp/settings.local.json.bak` (5982 bytes)
- [X] T002 [P] Confirm branch `025-harness-engineering` checked out and working tree clean
- [X] T003 [P] Inventory: md files=47, permissions.allow=104

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 참조할 공통 자산 준비.

**⚠️ CRITICAL**: 아래 2개 작업은 US1~US5 시작 전에 완료되어야 함.

- [X] T004 Drift matrix confirmed: backend/utils(market_hours.py) + backend/alembic/versions + frontend/src/utils(3 files) + frontend/src/lib(supabase.ts) = 4 신규 문서 필요
- [X] T005 Permissions matrix: 104 → (a)8 + (b)12 + (c)6 + (d)0 + (e)4 = 30. `git push`, `rm -rf`, `kill`, `reset --hard`, `brew services`는 (d)로 수동 승인. 25개 미분류(sed·one-off script)는 (b) glob으로 흡수

**Checkpoint**: 드리프트 목록 + permissions 매핑표가 PR 설명에 존재 → 각 스토리 시작 가능

---

## Phase 3: User Story 1 — 트리거 표 정비 (Priority: P1) 🎯 MVP

**Goal**: CLAUDE.md §4 작업 유형별 트리거 표를 현재 코드 구조와 100% 정렬해, Claude가 임의 작업에서 평균 2개 이하의 `.claude/` 문서만 로드해도 정확히 대응하도록 한다.

**Independent Test**: 5개 작업 시나리오(새 API / DB 모델 변경 / 스캔 로직 / 모바일 레이아웃 / 차트 라벨)를 각각 의뢰하여 Claude가 ≤3개 문서만 열고 정확한 변경 제안을 하는지 검증(SC-001, 80% 이상 성공).

### Implementation for User Story 1

- [X] T006 [US1] Audited CLAUDE.md §4 — 기존 엔트리 모두 실존 경로 확인
- [X] T007 [US1] Added "DB 마이그레이션(alembic)" → migrations.md + models.md
- [X] T008 [US1] Added "유틸리티 함수 추가(utils/)" → backend/utils.md
- [X] T009 [US1] Added "테스트 추가" → guides/tdd.md + backend/models.md
- [X] T010 [US1] Added "일회성 스크립트(scripts/)" → context/stack.md
- [X] T011 [US1] Added 프런트엔드 "유틸리티/공통 라이브러리" → frontend/utils.md + frontend/lib.md
- [X] T012 [US1] 모든 트리거 표 엔트리 파일 수 ≤3 확인
- [X] T013 [US1] archive 경로 참조 0건 확인(원래 없었음)

**Checkpoint**: CLAUDE.md 트리거 표가 코드 실물과 일치하고 모든 참조 경로가 실재.

---

## Phase 4: User Story 2 — 폴더 역할 가이드 + 드리프트 보강 + 메타 헤더 (Priority: P1) 🎯 MVP

**Goal**: `.claude/` 폴더 역할이 문서화되고, 코드↔문서 1:1 대응이 완성되고, 모든 활성 문서에 메타 헤더가 존재해 "어느 폴더에 무엇을 써야 하는가"가 1분 내 판단 가능하다.

**Independent Test**: 10개 가상 시나리오("X 주제를 어디에 기록하는가?")를 물었을 때 9개 이상 1분 내 정답(SC-002). 활성 문서 100%가 YAML frontmatter 4필드를 보유(SC-008).

### Implementation for User Story 2

- [X] T014 [US2] Created `.claude/README.md` — 폴더 역할 가이드 + 코드 미러링 원칙 + 헌장 참조
- [X] T015 [US2] Created `.claude/backend/utils.md` (market_hours.py 설명)
- [X] T016 [US2] Created `.claude/backend/migrations.md` (alembic 절차 + 네이밍)
- [X] T017 [US2] Created `.claude/frontend/utils.md` (format·indicatorLabels·buyReason)
- [X] T018 [US2] Created `.claude/frontend/lib.md` (supabase.ts)
- [X] T019 [US2] Extended `store/store.md` — detailViewStore + trendOverlayStore 추가, store/stores 혼재 명시
- [X] T020 [US2] 9 backend/*.md에 frontmatter 추가
- [X] T021 [US2] 9 frontend/**/*.md에 frontmatter 추가 (store.md 포함)
- [X] T022 [US2] context/*.md 2건 frontmatter 추가
- [X] T023 [US2] domain/*.md 2건 frontmatter 추가
- [X] T024 [US2] guides/*.md 2건 frontmatter 추가

**Checkpoint**: `.claude/README.md` 존재, 드리프트 매트릭스 0건, 활성 문서 100% 메타 헤더 보유.

---

## Phase 5: User Story 3 — 보호 규칙 격리 강화 (Priority: P2)

**Goal**: `.claude/rules/` 하위 파일은 편집 전 **명시적 승인 절차**가 구조적으로 보장되고, Claude가 이 규칙을 놓치지 않도록 문서 자체에 경고 헤더가 있다.

**Independent Test**: Claude에게 rules/ 하위 파일 수정을 요청했을 때 편집 전 사용자 승인 절차가 100% 트리거됨(SC-003). rules/ 파일 상단에 경고가 가시적.

### Implementation for User Story 3

- [X] T025 [US3] scan-symbols.md frontmatter (requires-approval + protected-since) 적용
- [X] T026 [US3] chart-buy-label.md frontmatter 적용
- [X] T027 [US3] chart-sell-label.md frontmatter 적용
- [X] T028 [US3] `.claude/README.md` §4에 보호 규칙 편집 절차 + contract 링크 명시 완료
- [X] T029 [US3] CLAUDE.md §2 보호 규칙 표 3파일 전부 나열, 확인 사항 컬럼 정상 확인

**Checkpoint**: rules/ 3 파일 모두 상단 경고 + requires-approval 헤더 보유, `.claude/README.md`와 CLAUDE.md에서 보호 절차 참조 가능.

---

## Phase 6: User Story 4 — 낡은/중복 문서 archive 격리 (Priority: P2)

**Goal**: 활성 컨텍스트와 사문화 문서가 명확히 분리되어 Claude가 옛 정보를 참조하지 않는다.

**Independent Test**: `.claude/archive/` 하위 문서가 트리거 표 어디에서도 참조되지 않으며(grep 0건), 활성 폴더에 중복·빈 디렉터리 없음.

### Implementation for User Story 4

- [X] T030 [US4] `.claude/archive/` 생성
- [X] T031 [US4] docs/archive/* 10개 → archive/ 이관
- [X] T032 [US4] plans/ 1개 이관·개명 (`buy-chart-scan-improvement-plan.md`)
- [X] T033 [US4] 빈 폴더 4개(docs, docs/archive, plans, plan) 삭제
- [X] T034 [US4] archive 외부 참조 0건 확인
- [X] T035 [US4] README.md archive 섹션에 읽기 전용·참조 금지 명시

**Checkpoint**: `.claude/archive/`에 11 파일, `docs/`·`plan/`·`plans/` 삭제됨, 트리거 표에서 archive 참조 0건.

---

## Phase 7: User Story 5 — 헌장 추출 + CLAUDE.md 슬림화 + permissions 정비 (Priority: P3)

**Goal**: 프로젝트 헌장이 `.specify/memory/constitution.md` 단일 파일에 집약되고, CLAUDE.md는 트리거 표 + 헌장 참조만 유지하며, settings.local.json 권한이 5 카테고리 glob ≤30 엔트리로 축약된다.

**Independent Test**: 헌장 외부에 R-·PY-·FE- 규칙 본문 0건(grep). Permissions 엔트리 ≤30이며 기존 허용 범위 누락 0건. CLAUDE.md에 헌장 참조 라인 존재.

### Implementation for User Story 5

- [X] T036 [US5] constitution.md v1.0.0 확정 (원칙 5 + R/PY/FE + Git + SR + E/D + DB + S + C + Governance)
- [X] T037 [US5] CLAUDE.md §5~§12 규칙 본문 제거, §6 헌장 참조 표로 대체 (R/PY/FE/SR/E/DB/S/C 영역별 요약)
- [X] T038 [US5] CLAUDE.md §0에 Constitution 참조 라인 추가
- [X] T039 [US5] settings.local.json 재작성 — allow 30 + ask 6
- [X] T040 [US5] `git push` 자동 허용에서 제거, ask로 이동
- [X] T041 [US5] permissions 매핑 검증 — 30개로 기존 104 엔트리 전부 커버(sed·specific script 등은 광범위 glob으로 흡수)

**Checkpoint**: constitution.md 1.0.0 확정, CLAUDE.md에 규칙 본문 0건(참조만), settings.local.json ≤30 엔트리.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 드리프트 감사 절차 수립 + 전체 Success Criteria 수동 검증.

- [X] T042 Created `guides/drift-audit.md` — 셀프 체크 + 분기 감사 2단계
- [X] T043 Created `guides/audit-log.md` — 2026-Q2 기준선 포함
- [ ] T044 [P] SC-001 simulation — Claude 세션에서 5 작업 시나리오 실행 (사용자가 수동 수행)
- [X] T045 [P] SC-004 sample audit — 정비 직후 기준선 drift 0건
- [X] T046 [P] SC-005 permissions count = 30 (≤30 ✅)
- [X] T047 [P] SC-006 CLAUDE.md 헌장 규칙 중복 = 0 (헌장 참조 3건)
- [X] T048 [P] SC-008 활성 문서 frontmatter 100%
- [X] T049 CLAUDE.md "Last updated: 2026-04-18", Version 2.1 bump (T037에서 함께 처리됨)
- [ ] T050 Final PR 설명 작성 (커밋 메시지로 대체 예정)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작 가능, 의존성 없음
- **Foundational (Phase 2)**: Setup 완료 필요 — US1~US5 시작을 블록
- **US1 (Phase 3, P1)**: Foundational(T004 드리프트 목록 + T005 permissions 매핑)에 의존
- **US2 (Phase 4, P1)**: Foundational에 의존, US1과 **병렬 가능**(다른 파일 수정)
- **US3 (Phase 5, P2)**: Foundational에 의존, US1~US2와 **병렬 가능**
- **US4 (Phase 6, P2)**: Foundational에 의존, US1~US3와 **병렬 가능** — 단, US4 완료 후 US1·US2 재검증(트리거 표 archive 참조 없음 확인)
- **US5 (Phase 7, P3)**: US1 완료 후 시작(CLAUDE.md 트리거 표가 먼저 안정되어야 슬림화가 수월). US2·US3·US4와 병렬 가능
- **Polish (Phase 8)**: 모든 US 완료 필요

### User Story Dependencies

- **US1 ↔ US4 간접 의존**: US4가 먼저 끝나면 US1의 T013(archive 경로 제거) 작업이 자명해짐. 순서는 바꿀 수 있음
- **US2의 메타 헤더(T020~T024)는 US3의 rules/ 메타 헤더(T025~T027)와 파일 경로가 달라 병렬 안전**
- **US5의 CLAUDE.md 슬림화(T037)는 US1의 CLAUDE.md 편집 완료 후에만 수행**(동일 파일 충돌 방지)

### Within Each User Story

- Models/파일 신규 생성 tasks [P]는 서로 병렬 실행
- 동일 파일을 수정하는 tasks는 순차 실행
- 스토리별 Checkpoint 통과 후 다음 스토리로 이동 권장

### Parallel Opportunities

- **Setup**: T002·T003 병렬(읽기 전용)
- **US2**: T014~T024 중 다른 파일을 건드리는 task는 모두 [P] — 최대 11 task 동시 가능
- **US3**: T025~T027 rules/ 3파일 병렬
- **US4**: T031·T032 병렬 가능(서로 다른 소스)
- **Polish**: T044~T048 SC 검증 5개 모두 독립, 병렬

---

## Parallel Example: User Story 2

```bash
# 신규 드리프트 보강 문서 4개 (서로 다른 파일)
Task: "Create .claude/backend/utils.md"         # T015
Task: "Create .claude/backend/migrations.md"    # T016
Task: "Create .claude/frontend/utils.md"        # T017
Task: "Create .claude/frontend/lib.md"          # T018

# 메타 헤더 일괄 적용 (폴더별 독립)
Task: "Add meta headers to backend/*.md"        # T020
Task: "Add meta headers to frontend/**/*.md"    # T021
Task: "Add meta headers to context/*.md"        # T022
Task: "Add meta headers to domain/*.md"         # T023
Task: "Add meta headers to guides/*.md"         # T024
```

---

## Parallel Example: Polish SC Verification

```bash
# 5개 SC 검증 모두 독립적으로 실행
Task: "SC-001 simulation (Claude 문서 로드 수)"       # T044
Task: "SC-004 audit (10 샘플 코드-문서 일치)"          # T045
Task: "SC-005 permissions count check"                # T046
Task: "SC-006 헌장 중복 grep"                         # T047
Task: "SC-008 메타 헤더 100% 체크"                    # T048
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 Setup 완료
2. Phase 2 Foundational 완료(드리프트·permissions 매핑표)
3. Phase 3 US1(트리거 표 정비) 완료 → SC-001 일부 검증
4. Phase 4 US2(폴더 가이드 + 드리프트 + 메타 헤더) 완료 → SC-002·SC-004·SC-008 일부 검증
5. **STOP & VALIDATE**: 이 시점에 이미 Claude 컨텍스트 로딩 품질의 80% 이상이 개선됨 → PR 머지 가능

### Incremental Delivery

1. MVP(US1+US2) → 첫 PR 머지
2. US3(rules 격리 강화) → SC-003 검증 → 두 번째 PR
3. US4(archive 정리) → 세 번째 PR
4. US5(헌장 + permissions) → SC-005·SC-006 검증 → 네 번째 PR
5. Polish(drift-audit.md + 최종 SC 감사) → 다섯 번째 PR

한 번에 모두 머지해도 되지만 리뷰 부담을 줄이려면 스토리별 PR 권장.

### Parallel Team Strategy

혼자 수행 시 US2가 가장 큰 덩어리이므로 메타 헤더 작업을 하위 batch(백엔드 / 프런트엔드 / 기타)로 쪼개 집중 시간에 배치.

---

## Notes

- [P] tasks는 서로 다른 파일을 수정하므로 병렬 실행 안전
- Story label은 추적성 유지를 위해 필수
- US1·US5가 동일 파일(CLAUDE.md)을 수정하므로 **US1 → US5 순차 실행 권장**
- 커밋 단위: Phase당 1~2 커밋(R-01 단일 관심사 원칙)
- 각 Checkpoint에서 멈춰 수동 검증 후 다음 Phase 진입
- 금지: rules/*.md 내용 수정(경로·메타 헤더만 변경 허용, 본문 수정 시 사용자 승인 필수)
