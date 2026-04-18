# Implementation Plan: 하네스 엔지니어링 최적 구조화 (.claude/ 재정비 + 프로젝트 세팅)

**Branch**: `025-harness-engineering` | **Date**: 2026-04-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-harness-engineering/spec.md`

## Summary

프로젝트의 `.claude/` 하네스(지식 베이스 + 트리거 표)를 (a) 현재 코드 레이아웃을 미러링하는 `backend/`·`frontend/` 정렬 구조로 **유지·보강**하고, (b) 중복·사문화 폴더를 정리하며, (c) 프로젝트 헌장을 speckit 표준 위치(`.specify/memory/constitution.md`)로 추출하고, (d) `settings.local.json` 권한을 위험도 × 공유 영향 5개 카테고리의 glob으로 축약한다. 코드 변경 없음. 문서·설정 변경만으로 Claude의 컨텍스트 로딩 효율과 규칙 무결성을 높인다.

기술 접근: 파일 이동/통합 + 템플릿 기반 신규 문서 작성 + CLAUDE.md 슬림화 + settings.local.json 재작성. Git 이력으로 기존 문서는 보존하고, 사라질 정보 없음.

## Technical Context

**Language/Version**: N/A (문서·설정만, 마크다운 + JSON)
**Primary Dependencies**: 없음. 본 기능은 Claude Code 실행 환경의 `.claude/` 규약과 `.specify/` 템플릿을 참조할 뿐 런타임 의존성을 추가하지 않는다.
**Storage**: Git 저장소 내 파일(markdown, JSON). 신규 DB·서비스 없음.
**Testing**: 수동 검증 — (1) Claude Code로 5가지 작업 유형 시뮬레이션, (2) 문서-코드 대조 감사 10건 샘플, (3) settings.local.json 재생성 후 기존 허용 목록 누락 grep.
**Target Platform**: Claude Code CLI (주요 독자는 Claude 에이전트), 부차적으로 이 저장소 개발자.
**Project Type**: 메타/문서-only (web service 본체는 이미 존재; 본 기능은 그 문서화 계층을 재정비).
**Performance Goals**: SC-001 — 임의 5개 작업에서 Claude가 평균 2개 이하 `.claude/` 문서만 열어 정확한 변경을 제시(80% 이상). SC-004 — 코드-문서 불일치 ≤2/10. SC-005 — permissions ≤30 엔트리.
**Constraints**:
- 기존 47개 문서의 정보를 잃지 않는다(삭제 대신 `archive/` 이관 또는 Git 이력 보존).
- `.specify/` 내부 스크립트·템플릿은 수정 대상 아님.
- CI/CD·pre-commit·GitHub Actions 도입 금지(Out of Scope).
- 백엔드·프론트엔드 소스 코드 미변경.
**Scale/Scope**:
- 정비 대상: `.claude/` 47 문서 + CLAUDE.md + `.claude/settings.local.json` + `.specify/memory/constitution.md`(현재 스텁).
- 추정 신규·수정 파일: **< 30개**(신규 `_meta/` 또는 최상단 README 1개, constitution 1개, 기존 문서 17개 메타 헤더 갱신, settings.local.json 1개 재작성, CLAUDE.md 슬림화, archive 이관 10+ 파일).
- 추정 완료 기간: 2~3 개의 작은 PR로 나누어 약 1~2일.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

현재 `.specify/memory/constitution.md`는 **템플릿 스텁 상태**(FR-009의 일부로 본 기능이 이를 채운다). 따라서 Constitution Check는 **CLAUDE.md의 현존 규칙 체계**를 잠정 헌장으로 간주해 수행한다(스펙의 User Story 5가 이 과도기를 공식화함).

| 잠정 헌장 조항 (CLAUDE.md 출처) | 본 기능 준수 여부 | 비고 |
|---|---|---|
| R-01 한 번에 하나의 관심사 | ✅ | 본 기능은 문서 재정비 단일 관심사. 코드 변경 없음 |
| R-06 기존 유틸리티 재사용 | ✅ | speckit 표준 경로(`.specify/memory/`) 재사용 — 새 경로 만들지 않음 |
| R-04 주석은 "왜"를 설명 | ✅ | 각 문서 상단 메타 헤더(용도·독자·갱신 기준)로 WHY 명시 (FR-013) |
| SR-01~SR-06 서버 재시작 규칙 | ➖ 적용 없음 | 코드 변경이 없으므로 서버 재시작 불필요. Plan 단계에서 예외로 명시. |
| C-05 요청되지 않은 리팩토링 금지 | ✅ | 사용자가 명시적으로 `.claude/` 구조화를 요청 |
| C-06 speckit는 명시 요청 시 | ✅ | 사용자가 `/speckit.specify`·`/speckit.clarify`·`/speckit.plan` 직접 호출 |
| rules/ 폴더 보호 | ✅ | 본 기능은 rules/ 내용을 **수정하지 않고** 구조적 격리만 강화(경로 유지) |

**Gate 결과**: PASS — 위반 없음, Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/025-harness-engineering/
├── plan.md              # 본 파일
├── research.md          # Phase 0 출력
├── data-model.md        # Phase 1 출력 (문서 분류 데이터 모델)
├── quickstart.md        # Phase 1 출력 (재정비 실행 가이드)
├── checklists/
│   └── requirements.md  # /speckit.specify 단계 산출물
└── tasks.md             # /speckit.tasks 단계 산출물 (본 명령 범위 밖)
```

### Source Code (repository root) — 재정비 후 목표 상태

본 기능은 소스 코드가 아닌 **저장소 내 문서·설정 레이아웃**을 변경한다. 아래는 정비 완료 후 목표 트리(경로 기준 변경 항목만 표시, 기존 유지 항목은 `…` 처리).

```text
# 저장소 루트
CLAUDE.md                        # 슬림화: 트리거 표 + 보호 규칙 표 + 헌장 참조 링크
.specify/
├── memory/
│   └── constitution.md         # 스텁 → 완성(본 기능이 채움)
└── …                            # 스크립트·템플릿 변경 없음
.claude/
├── README.md                   # 신규: 폴더 역할 가이드 (FR-001)
├── backend/                    # 유지 — routes/models/schemas/services/fetchers/indicators/scheduler/auth/config 1:1 대응 (FR-015)
│   ├── router.md
│   ├── models.md
│   ├── schemas.md
│   ├── services.md
│   ├── fetchers.md
│   ├── indicators.md
│   ├── scheduler.md
│   ├── auth.md
│   └── config.md
├── frontend/                   # 유지 — api/components/pages/router/store/hooks/types/css 1:1 대응
│   ├── api/api.md
│   ├── components/components.md
│   ├── pages/pages.md
│   ├── router/router.md
│   ├── store/store.md
│   ├── hooks/hooks.md
│   ├── types/types.md
│   └── css/{mobile.md, pc.md}
├── context/                    # 유지 — 프로젝트 개요 계층
│   ├── stack.md
│   └── db.md
├── domain/                     # 유지 — 코드로 표현되지 않는 지식
│   ├── scan.md
│   └── signals.md
├── rules/                      # 유지 — 보호된 비즈니스 규칙 (편집 전 승인 필수)
│   ├── scan-symbols.md
│   ├── chart-buy-label.md
│   └── chart-sell-label.md
├── guides/                     # 유지 — 절차 가이드
│   ├── verification.md
│   ├── tdd.md
│   └── drift-audit.md          # 신규: FR-010 2단계 드리프트 감지 절차
├── archive/                    # 신규 최상단(기존 docs/archive/ 승격) — 사문화 문서 격리
│   └── (구 docs/archive/* + plans/*)
├── commands/                   # 유지 — speckit 명령 정의(외부 도구)
└── settings.local.json         # 재작성 — 위험도×공유 영향 5 카테고리 glob, ≤30 엔트리

# 제거/통합되는 것:
# .claude/plan/                  → 빈 폴더, 삭제
# .claude/plans/                 → .claude/archive/로 이관
# .claude/docs/                  → .claude/archive/로 승격·통합
# .claude/프로젝트개선.md        → .claude/archive/ 혹은 guides/로 분류 (research.md에서 결정)
```

**Structure Decision**: Option A(현재 코드 영역 정렬 유지 + 청소)를 Session 2026-04-18에서 채택. 폴더 계보는 바꾸지 않고 **중복 제거·메타 헤더 추가·헌장 외부화**로 하네스 품질을 끌어올린다. 라디컬 재구조화는 Git blame 손실 대비 이득이 작다고 판단.

## Complexity Tracking

> 본 기능은 Constitution Check를 위반하는 설계 선택을 하지 않음. 이 섹션은 공란.

---

## Phase 0: Outline & Research

### 해소해야 할 미지 항목 (Technical Context에서 도출)

| # | 미지 항목 | 연관 FR/SC | 조사 결과물 |
|---|---|---|---|
| R1 | 현재 `.claude/docs/` · `plans/` · `프로젝트개선.md` 각 파일이 "활성 참조"인지 "사문화"인지 판정 기준 | FR-007, SC-009 | archive/ 이관 대상 목록 확정 |
| R2 | CLAUDE.md 트리거 표의 현재 실제 코드 구조 대비 누락·과잉 항목 | FR-002, SC-002 | 트리거 표 diff |
| R3 | `.claude/backend/` · `frontend/` 파일이 실제 `backend/routes/` 등 코드와 1:1 대응하는지 감사 | FR-015, SC-004 | 대응 매트릭스 + 드리프트 목록 |
| R4 | 프로젝트 헌장에 들어갈 규칙의 완전 목록(CLAUDE.md 0장/R/PY/FE/SR/E/D/DB/S/C 전 섹션) | FR-009, SC-006 | 헌장 초안 구조 |
| R5 | `settings.local.json` 현재 엔트리 100+를 5 카테고리(a–e)로 매핑 | FR-008, SC-005 | 카테고리별 glob 초안 + 누락 방지 체크리스트 |
| R6 | 문서 상단 메타 헤더(용도·독자·갱신 기준) 포맷 | FR-013, SC-008 | 표준 헤더 템플릿 |
| R7 | 드리프트 감지 2단계(작업 완료 셀프 체크 + 분기 감사)의 실제 체크리스트 항목 | FR-010, SC-004 | `drift-audit.md` 초안 |
| R8 | 한글 파일명 → 영문 kebab-case 개명 규칙과 예외 처리(기존 링크 유지) | FR-014 | 개명 매핑표 |

### 조사 수행 방식

- 저장소 내부 grep·ls·git log만 사용(외부 의존성 없음).
- 각 항목은 research.md에 "Decision / Rationale / Alternatives considered" 형식으로 기록.
- 모든 NEEDS CLARIFICATION은 결정으로 종결되어야 하며, 잔존 시 ERROR.

**Output**: `specs/025-harness-engineering/research.md` — 8개 결정 항목.

## Phase 1: Design & Contracts

### Prerequisites

- Phase 0 완료(`research.md` 존재).

### 1. 데이터 모델 (`data-model.md`)

본 기능은 서비스가 아니라 **문서 자산**을 다루므로 "엔티티"는 실제 DB 테이블이 아니라 **문서 분류 체계**가 된다. data-model.md에 다음 엔티티와 관계를 정의한다:

- **ContextDocument** — `.claude/` 하위 1개 .md 파일. 속성: path, category(code-mirror/context/domain/rules/guides/archive/meta), owner-area(backend/frontend/shared/none), meta-header(용도·독자·갱신 기준), mirrors(코드 경로 0..1).
- **ProtectedRule** — ContextDocument의 하위 종류(`category=rules`). 속성: requires-approval(true), protected-since(date).
- **TriggerTable** — CLAUDE.md 안의 매핑. 필드: task-type(string), files(List<ContextDocument 경로>).
- **Constitution** — `.specify/memory/constitution.md` 단일 인스턴스. 섹션: 핵심 원칙·코딩 규칙·Git 워크플로·SR·에러·DB·보안·커뮤니케이션.
- **PermissionGroup** — settings.local.json의 permissions 엔트리 묶음. 필드: category(a/b/c/d/e), pattern(glob), action(allow/ask).
- **ArchiveEntry** — `archive/` 하위 이관된 구 문서. 필드: original-path, archived-at, reason.

관계:
- ContextDocument `1..* mirrors` 코드 경로 (category=code-mirror인 경우).
- TriggerTable `n..n references` ContextDocument.
- Constitution `1 referenced-by` CLAUDE.md.
- PermissionGroup `n..n covers` 기존 개별 permissions.

상태 전이:
- ContextDocument: Draft → Active → Stale → Archived.
- TriggerTable entry: Proposed → Ratified → Deprecated.

### 2. Contracts (`contracts/`)

본 기능은 외부 API·CLI·UI를 노출하지 않으므로 **Claude Code 에이전트 소비 규약**만 정의한다. contracts/ 안에 다음 문서를 둔다:

- **`claude-context-contract.md`**: Claude가 `.claude/`를 읽을 때 지켜야 하는 "트리거 표 우선 조회 → 해당 파일만 로드" 규약. FR-012(트리거 표에 없으면 추측 금지)를 명시.
- **`document-header-schema.md`**: 메타 헤더 스키마(R6 결과). 필드 4개(용도·독자·갱신 기준·마지막 감사일) + 유효성 규칙.
- **`permission-categories.md`**: Bash permissions 5 카테고리(a–e)의 포함·배제 기준과 glob 예시. R5 결과 반영.

### 3. Quickstart (`quickstart.md`)

재정비를 실제로 실행할 때 따라 할 운영 가이드:

1. 브랜치: 이미 `025-harness-engineering` (체크아웃 완료).
2. 순서: (i) archive 이관 → (ii) `.claude/README.md` 생성 → (iii) 메타 헤더 일괄 추가 → (iv) 코드↔문서 대응 감사·누락 보강 → (v) CLAUDE.md 슬림화 + constitution 생성 → (vi) settings.local.json 재작성 → (vii) 드리프트 감사 체크리스트 생성.
3. 각 단계마다 Git 커밋 단위로 구분(한 번에 하나의 관심사 [R-01]).
4. 중간 검증: SC-001(Claude 5개 작업 시뮬레이션), SC-004(10 문서 샘플 감사), SC-005(permissions grep).

### 4. 에이전트 컨텍스트 업데이트

`/speckit.plan` 종료 직전에 `.specify/scripts/bash/update-agent-context.sh claude`를 실행해 CLAUDE.md의 "Active Technologies" 섹션에 본 기능이 소비·생성하는 문서 자산을 기록한다(실제 기술 스택 추가 아님, 메타 기능임을 명시).

### Constitution Check 재평가 (Phase 1 설계 후)

- 위 설계는 Complexity Tracking 항목을 추가하지 않는다.
- rules/ 폴더는 이동·수정 대상 아님(FR-003 보호 유지) — OK.
- speckit `.specify/` 내부 미수정(Assumption 준수) — OK.
- 코드 변경 0건 → SR-01~SR-06 서버 재시작 규칙 대상 외 — OK.
- **Gate 재통과**: PASS.

**Output**: `research.md`, `data-model.md`, `contracts/{claude-context-contract.md, document-header-schema.md, permission-categories.md}`, `quickstart.md`, CLAUDE.md 업데이트(에이전트 컨텍스트).

---

## Post-Plan 결정 요약

- **범위**: 문서·설정만. 코드 0줄 수정.
- **전략**: Option A(현재 구조 유지 + 청소 + 보강).
- **산출물(최종)**: `.claude/README.md` 1, constitution.md 1, `guides/drift-audit.md` 1, archive/ 이관 10+ 파일, 메타 헤더 17개 추가/갱신, settings.local.json 재작성, CLAUDE.md 슬림화.
- **검증**: 3개 SC(SC-001 작업 시뮬레이션 / SC-004 샘플 감사 / SC-005 permissions grep)를 완료 직전에 수동 실행.

## Stop

`/speckit.plan` 명령은 여기서 종료. 다음 단계는 `/speckit.tasks`(본 plan.md + research.md + data-model.md를 읽어 tasks.md 생성).
