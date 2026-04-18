# Phase 1 Data Model: 문서 분류 체계

**Feature**: 025-harness-engineering
**Date**: 2026-04-18

본 기능은 런타임 데이터가 아니라 **저장소 내 문서 자산**을 다룬다. 따라서 "엔티티"는 DB 테이블이 아니라 **문서 분류 체계**를 정의한다. 각 엔티티는 파일 또는 파일 내 섹션으로 구현된다.

---

## Entities

### 1. ContextDocument

`.claude/` 하위의 개별 `.md` 파일.

| Field | Type | Rule |
|---|---|---|
| `path` | string (절대) | `.claude/` 이하 경로, 고유 |
| `category` | enum | `code-mirror` / `context` / `domain` / `rules` / `guides` / `meta` / `archive` |
| `owner-area` | enum | `backend` / `frontend` / `shared` / `none` (code-mirror만 값 가짐) |
| `mirrors` | string? | 대응 코드 경로(`backend/routes/`) — code-mirror 카테고리에서만 필수 |
| `meta-header` | YAML frontmatter | purpose·reader·update-trigger·last-audit (FR-013) |
| `state` | enum | `Draft` / `Active` / `Stale` / `Archived` |

**Validation**:
- `category=rules` → FR-003에 따라 편집 전 승인 필요(ProtectedRule).
- `category=code-mirror` → `mirrors` 필드 필수, 값은 실제 코드 경로로 존재해야 함.
- `category=archive` → 트리거 표에서 참조되지 않아야 함(FR-007).

**State transitions**:
- `Draft → Active`: 초기 저작·리뷰 완료.
- `Active → Stale`: 분기 감사에서 드리프트 발견(SC-004).
- `Stale → Active`: 보강 후 last-audit 갱신.
- `Active → Archived`: 기능 폐기·대체 시(수기 결정).
- `Archived → *`: 일방향(되돌리지 않음).

---

### 2. ProtectedRule *(ContextDocument의 서브타입, category=rules)*

| Field | Type | Rule |
|---|---|---|
| `requires-approval` | boolean | `true` 고정 |
| `approval-record` | string? | 최근 승인 PR·커밋 참조(감사용) |
| `protected-since` | date | 보호 시작일 |

**Validation**: `requires-approval=true` 필수. 편집 시 PR 설명에 `approval-record`가 기록되어야 함.

---

### 3. TriggerTable

`CLAUDE.md` 내부의 **작업 유형 → 참조 파일** 매핑표. 섹션 4 "작업 유형별 파일 참조 가이드"에 해당.

| Field | Type | Rule |
|---|---|---|
| `section` | enum | `backend` / `frontend` / `fullstack` |
| `task-type` | string | 예: "새 API 엔드포인트 추가" |
| `files` | List<string> | ContextDocument.path 목록 |
| `status` | enum | `Proposed` / `Ratified` / `Deprecated` |

**Validation**:
- 모든 `files` 항목은 실재하는 ContextDocument 경로여야 함.
- `files.length ≤ 3`가 권장(SC-001 참조 ≤2 목표 부합).
- Deprecated 엔트리는 60일 내 제거 또는 이동.

**State transitions**:
- `Proposed → Ratified`: 커밋·리뷰 완료.
- `Ratified → Deprecated`: 대응 코드가 제거되었거나 작업 유형이 사문화.
- `Deprecated → (삭제)`: 정기 정비 시.

---

### 4. Constitution

`.specify/memory/constitution.md` — 프로젝트 단일 헌장(FR-009).

| Field | Type | Rule |
|---|---|---|
| `path` | string | `.specify/memory/constitution.md` (고정) |
| `sections` | List<Section> | R4 결과(Core Principles, Coding Rules, Git Workflow, Operations, Data, Security, Communication, Governance) |
| `version` | semver | 예: `1.0.0` |
| `ratified-date` | date | 최초 확정일 |
| `last-amended` | date | 최근 수정일 |

**Validation**:
- 파일은 유일 인스턴스(복제 금지).
- CLAUDE.md 내부에 헌장 규칙이 중복 기재되지 않음(SC-006).
- 버전 변경 시 PR에 Why 설명 필수.

---

### 5. PermissionGroup

`.claude/settings.local.json` 내 Bash/MCP permissions를 5 카테고리(a–e)로 묶은 논리 그룹.

| Field | Type | Rule |
|---|---|---|
| `category` | enum | `a-read-only` / `b-build-test` / `c-git-write` / `d-destructive` / `e-external-mcp` |
| `patterns` | List<string> | glob 패턴들(예: `Bash(ls:*)`) |
| `action` | enum | `allow` / `ask` |

**Validation**:
- `a-read-only`·`b-build-test`·`e-external-mcp` → `action=allow` 허용.
- `c-git-write` → `action=allow`(편의), 단 `git push`·`git reset --hard` 등은 `d`로 분류.
- `d-destructive` → `action=ask` 필수(자동 허용 금지).
- 전체 엔트리 합 ≤ 30(FR-008, SC-005).

---

### 6. ArchiveEntry

`.claude/archive/` 하위로 이관된 구 문서.

| Field | Type | Rule |
|---|---|---|
| `original-path` | string | 이관 전 경로 |
| `archived-at` | date | 이관일 |
| `reason` | string | 예: "feature deprecated", "superseded by X" |
| `superseded-by` | string? | 후속 문서 경로(있으면) |

**Validation**: archive로 이관된 문서는 **트리거 표에서 참조되지 않아야 함**(FR-007).

---

## Relationships

```
Code (저장소 실물)
  └─ 1..* mirrors
      └─ ContextDocument [category=code-mirror]

TriggerTable
  └─ n..n references
      └─ ContextDocument [category ≠ archive]

Constitution (1 instance)
  └─ 1 referenced-by
      └─ CLAUDE.md (링크)

PermissionGroup
  └─ n..n covers
      └─ Bash/MCP command patterns (저장소 외부 런타임 개념)

ArchiveEntry
  └─ 1 derived-from
      └─ ContextDocument [state=Archived]
```

---

## Derived Counts (현 상태 → 목표)

| 항목 | 현재 | 재정비 후 목표 |
|---|---|---|
| `.claude/` .md 파일 수 | 47 | ~40 (archive 정리 + utils/migrations/lib 4종 신규) |
| TriggerTable 엔트리 | ~15 | ~20 (migrations·utils·tests·scripts 추가) |
| Constitution 파일 | 0(스텁) | 1 |
| PermissionGroup 실질 엔트리 | 103 | ≤30 |
| code-mirror drift 건 | 5 (utils×2·lib×1·migrations×1·stores×1) | 0 |
| archive 격리 문서 | 10(docs/archive/) + 1(plans/) | 11(동일, 경로만 단축) |

---

## 감사 지표 (SC 매핑)

- **SC-001**(Claude 로드 문서 수 ≤2): TriggerTable.files ≤3 불변 조건으로 간접 보장.
- **SC-004**(불일치 ≤2/10): R7 분기 감사에서 ContextDocument의 `mirrors` 유효성 점검.
- **SC-005**(permissions ≤30): PermissionGroup 합계 감사 스크립트.
- **SC-006**(헌장 중복 0): Constitution path ≠ CLAUDE.md 안 규칙 본문 존재 여부 grep.
- **SC-008**(메타 헤더 100%): 각 ContextDocument의 frontmatter 존재 여부 파서.
