# Phase 0 Research: .claude/ 재정비

**Feature**: 025-harness-engineering
**Date**: 2026-04-18
**Source of facts**: 저장소 실측(`find`, `ls`, grep, `git log`) — 2026-04-18 기준.

---

## R1 — 활성 vs 사문화 판정 (FR-007, SC-009)

**Decision**:
- `.claude/docs/archive/` 하위 10개 파일(버전 분석·ERD·구 기능 명세) → **`.claude/archive/`로 이동**(경로 단축, 레벨 1로 승격).
- `.claude/plans/buy차트스캔개선작업계획.md`(완료된 기능 계획서) → **`.claude/archive/buy-chart-scan-improvement-plan.md`로 개명·이동**.
- `.claude/plan/`(빈 디렉터리) → **삭제**.
- 타 활성 폴더(`backend/`, `frontend/`, `context/`, `domain/`, `rules/`, `guides/`, `commands/`) → **이관 대상 아님**.

**Rationale**: `docs/archive/` 명명은 이미 "격리"를 뜻하지만 한 단계 더 깊은 경로는 탐색 비용만 높임. `.claude/archive/` 최상단 1계층이 "여기를 읽지 말라"는 시그널로 더 명확. 완료된 기능 계획서는 스펙 `specs/`와 역할이 겹치므로 보관으로 이관.

**Alternatives considered**:
- "전부 Git 이력으로만 보존 후 삭제" — 검색 가능성을 유지해야 한다는 FR-007 "정보 소실 금지"에 반함. 기각.
- "docs/archive/ 경로 유지" — 호환성은 좋으나 한 계층 추가 문제가 남음. 이관 비용이 작아 승격 채택.

---

## R2 — CLAUDE.md 트리거 표 코드 정렬 감사 (FR-002, SC-002)

**Decision**: 현재 트리거 표는 대부분 유효하지만 다음 항목을 보강한다.
- **추가 필요 작업 유형**: "DB 마이그레이션(alembic/)", "유틸리티 함수 추가(utils/)", "테스트 추가", "스크립트 작업(scripts/)".
- 추가 시 각각 참조 파일: `backend/models.md` + (새로 만들 `backend/migrations.md`), `guides/tdd.md`, 등.
- **삭제 대상**: 현재 트리거 표에 직접 등장하지 않음. 변경 없음.

**Rationale**: 백엔드 최상위 코드에 `alembic/`·`utils/`·`scripts/`·`tests/`가 있으나 트리거 표에선 안내되지 않음 → 작업 요청 시 Claude가 `.claude/backend/` 문서를 다 뒤지게 됨(SC-001 침해 위험).

**Alternatives considered**:
- "추가 안 하고 기존만 유지" — 기각. US1 수용 기준 3(트리거 표에 없으면 갱신 제안)이 매번 트리거되는 비용.
- "트리거 표 대신 자동 정규식 기반 라우팅" — 과한 복잡도. 수기 표가 현재 규모에 적합.

---

## R3 — 코드 ↔ .claude/ 1:1 대응 감사 (FR-015, SC-004)

**Decision** (감사 매트릭스 결과):

### 백엔드 최상위 vs `.claude/backend/`

| 코드 경로 | 대응 문서 | 판정 |
|---|---|---|
| `backend/routes/` | `router.md` | ✅ 대응 |
| `backend/models.py` | `models.md` | ✅ 대응 |
| `backend/schemas.py` (또는 schemas/) | `schemas.md` | ✅ 대응 |
| `backend/services/` | `services.md` | ✅ 대응 |
| `backend/fetchers/` | `fetchers.md` | ✅ 대응 |
| `backend/indicators/` | `indicators.md` | ✅ 대응 |
| `backend/scheduler.py` | `scheduler.md` | ✅ 대응 |
| `backend/auth.py` | `auth.md` | ✅ 대응 |
| `backend/config.py` | `config.md` | ✅ 대응 |
| `backend/database.py` | `context/db.md` | ✅ 간접 대응 (context/에 유지) |
| `backend/app.py` | ❌ 없음 | 단순 FastAPI 엔트리 — 문서 **불필요** |
| `backend/utils/` | ❌ 없음 | **신규** `backend/utils.md` 필요 (드리프트) |
| `backend/alembic/` | ❌ 없음 | **신규** `backend/migrations.md` 필요 |
| `backend/scripts/` | ❌ 없음 | 일회성 스크립트 — **불필요**(정책 문서화) |
| `backend/tests/` | `guides/tdd.md` | ✅ 대응(다른 폴더지만 OK) |
| `backend/data/` | ❌ 없음 | CSV·시드 데이터 — **불필요** |

### 프런트엔드 최상위 vs `.claude/frontend/`

| 코드 경로 | 대응 문서 | 판정 |
|---|---|---|
| `frontend/src/api/` | `api/api.md` | ✅ |
| `frontend/src/components/` | `components/components.md` | ✅ |
| `frontend/src/hooks/` | `hooks/hooks.md` | ✅ |
| `frontend/src/pages/` | `pages/pages.md` | ✅ |
| `frontend/src/store/` | `store/store.md`(authStore.ts 1개만 포함) | ⚠️ 부분 |
| `frontend/src/stores/` | ❌ 없음 | **드리프트**: 실제 활성 4개 스토어가 여기 있음 |
| `frontend/src/types/` | `types/types.md` | ✅ |
| `frontend/src/styles/` | `css/mobile.md`, `css/pc.md` | ✅ 간접 대응 |
| `frontend/src/utils/` | ❌ 없음 | **신규** `utils.md` 필요(드리프트) |
| `frontend/src/lib/` | ❌ 없음 | **신규** `lib.md` 필요(드리프트) |
| `frontend/src/assets/` | ❌ 없음 | 정적 에셋 — **불필요** |
| `frontend/src/App.tsx`, `main.tsx` | ❌ 없음 | 엔트리 — **불필요** |
| `frontend/src/router/` | `router/router.md` | ⚠️ 실제 라우팅은 `App.tsx` 내부에 있어 별도 `router/` 코드 폴더 부재 — 문서 내용 검토 필요 |

**드리프트 요약**: 신규 문서 4개(`backend/utils.md`, `backend/migrations.md`, `frontend/utils.md`, `frontend/lib.md`) + `store/store.md`를 `stores/`의 4개 스토어 전체를 커버하도록 확장(또는 `store/` 디렉터리를 `stores/`로 코드 정규화 → 본 범위 밖이라 문서만 확장).

**Rationale**: FR-015는 "코드 최상위 폴더/모듈과 .claude 문서가 1:1"을 요구. 누락 4건은 문서 신규 작성으로 해결 가능(코드 변경 없음).

**Alternatives considered**:
- "utils/·lib/는 사소하므로 문서 없이 둔다" — FR-015 감사 기준에 drift로 집계됨. 기각.
- "코드의 store/stores 혼재를 고친다" — 본 기능 Out of Scope(코드 미변경 원칙). 별도 코드 리팩토링 이슈로 제안.

---

## R4 — 프로젝트 헌장 초안 구조 (FR-009, SC-006)

**Decision**: `.specify/memory/constitution.md`는 다음 섹션으로 채운다.

```
# Trading View Platform Constitution

## Core Principles
1. 이해 먼저, 코딩 다음
2. 작은 단위로 쪼개고 검증
3. 기존 코드 존중 — 동작하는 것을 깨뜨리지 않는다
4. 모든 결정에는 이유가 있다 (No Silent Decisions)
5. 사용자의 의도를 코드보다 우선 (Intent Over Implementation)

## Coding Rules
### Universal (R-01 ~ R-08)
### Python / FastAPI (PY-01 ~ PY-06)
### Frontend / React + TypeScript (FE-01 ~ FE-05)

## Git Workflow
- 브랜치 전략: feature/fix/refactor/chore
- 커밋 규칙: feat/fix/refactor/style/docs/test/chore/hotfix (한국어 허용)

## Operations
### Server Restart (SR-01 ~ SR-06)
### Error Protocol (E-01 ~ E-04, D-01)

## Data Rules (DB-01 ~ DB-04)
## Security Rules (S-01 ~ S-04)
## Communication Rules (C-01 ~ C-06)

## Governance
- 헌장이 다른 관행보다 우선.
- 변경 시 PR 리뷰 + `/speckit.constitution` 명령 사용.
- 복잡도 증가 시 Complexity Tracking 요구.

**Version**: 1.0.0 | **Ratified**: 2026-04-18 | **Last Amended**: 2026-04-18
```

**Rationale**: 이미 CLAUDE.md 2.0에 모든 규칙이 명시돼 있어 추출·복제 작업으로 충분. Speckit의 `/speckit.constitution` 명령을 사용해 표준 포맷으로 변환.

**Alternatives considered**:
- "CLAUDE.md 내용을 그대로 두고 constitution.md는 참조만" — FR-009 "single source of truth" 위반. 기각.
- "규칙을 부록으로만 요약" — SC-006 "헌장 외부 중복 0건"과 충돌. 기각.

---

## R5 — Permissions 카테고리화 (FR-008, SC-005)

**Decision**: 현재 103 엔트리를 5 카테고리 glob으로 축약(예상 29 엔트리):

```jsonc
{
  "permissions": {
    "allow": [
      // (a) 읽기 전용·감사 — 8
      "Bash(ls:*)", "Bash(cat:*)", "Bash(grep:*)", "Bash(find:*)",
      "Bash(git status:*)", "Bash(git log:*)", "Bash(git diff:*)", "Bash(lsof:*)",

      // (b) 지역 빌드·테스트·실행 — 8
      "Bash(pnpm:*)", "Bash(npm:*)", "Bash(python3:*)",
      "Bash(.venv/bin/*)", "Bash(pytest:*)", "Bash(uvicorn:*)",
      "Bash(curl -s http://localhost:*)", "Bash(node:*)",

      // (c) Git 쓰기 — 7
      "Bash(git add:*)", "Bash(git commit:*)", "Bash(git stash:*)",
      "Bash(git branch:*)", "Bash(git checkout:*)", "Bash(git restore:*)",
      "Bash(git merge:*)",

      // (d) 파괴적/공유 — 명시적으로 비워두고 수동 승인 (git push는 사용자 판단)
      // (공란)

      // (e) 외부/MCP — 범용 허용 6
      "mcp__filesystem__*",
      "mcp__context7__*",
      "mcp__memory__*",
      "mcp__github__*",
      "Bash(awk:*)",
      "Bash(xargs:*)"
    ]
  }
}
```

**엔트리 수**: 29 (30 이하 ✅).

**누락 방지 체크리스트**: 기존 103 엔트리를 위 5 카테고리에 모두 매핑 가능함을 grep으로 검증한 뒤 교체.
- `Bash(git push:*)`: 현재 allow. 정책상 (d)로 이동 → **제거**(수동 승인 유지). 사용자 확인 필요 항목.

**Rationale**: Option A(위험도 × 공유 영향)를 Session 2026-04-18에서 채택. 파괴적 명령만 자동 허용에서 제거하되, 나머지는 넓은 glob으로 일상 작업 마찰을 줄임.

**Alternatives considered**:
- "현재 엔트리 유지, 주석만 추가" — SC-005(30 이하) 불충족.
- "git push도 자동 허용 유지" — 공유 영향이 높아 보호 실패 리스크. 기각.

---

## R6 — 문서 상단 메타 헤더 포맷 (FR-013, SC-008)

**Decision**: **YAML frontmatter** 형식.

```markdown
---
purpose: 이 문서가 설명하는 대상(1줄)
reader: 누가 언제 읽는가
update-trigger: 어떤 코드/데이터 변경이 이 문서 갱신을 요구하는가
last-audit: 2026-04-18
---
```

**Rationale**: YAML frontmatter는 마크다운 표준 도구(Jekyll/Hugo/많은 정적 분석기)에서 해석 가능하고, grep/awk로 기계 검증이 쉽다. HTML 주석 대비 가독성과 추출성 모두 우수.

**Alternatives considered**:
- HTML 주석 `<!-- meta: ... -->`: 렌더링에 영향 없지만 기계 파싱 어려움.
- 테이블 헤더: 시각적으로 복잡, grep 어려움.
- 자유 텍스트: 드리프트 감사 자동화 불가.

---

## R7 — 드리프트 감사 체크리스트 (FR-010, SC-004)

**Decision**: `.claude/guides/drift-audit.md`를 신설. 내용 개요:

### (1) 작업 완료 시 셀프 체크리스트

```
## Self-Check (기능 PR 머지 전 수행)
- [ ] 이 PR이 건드린 코드 최상위 폴더·모듈에 대응하는 .claude/{area}/ 문서를 확인했는가?
- [ ] 문서의 설명이 변경된 동작과 일치하는가? (경로·심볼·임계값)
- [ ] 새 API/페이지/컴포넌트 추가 시 해당 .md에 항목이 추가되었는가?
- [ ] rules/ 변경이 있다면 사용자 승인 기록이 PR 설명에 있는가?
- [ ] last-audit 헤더를 오늘 날짜로 갱신했는가?
```

### (2) 분기별 샘플 감사

```
## Quarterly Audit (3개월마다 수행)
1. .claude/ 하위 .md 전체에서 무작위 10건 추출.
2. 각 문서가 언급하는 코드 경로·심볼(예: backend/routes/company.py, _is_polluted_name)이 실재하는지 grep으로 확인.
3. 임계값·규칙이 현 구현과 일치하는지 확인(특히 rules/).
4. 드리프트 건수 기록. 2건 초과 시 즉시 보강(SC-004 위반).
5. audit-log.md에 감사 일자·결과 append.
```

**Rationale**: Option B(작업 완료 셀프 + 분기 감사)를 Session 2026-04-18에서 채택. 자동 CI는 Out of Scope, PR 템플릿 강제는 외부 도구 변경이라 제외.

**Alternatives considered**: Q4에서 기각된 A(분기만)·C(PR 템플릿)·D(자동 grep CI) 참고.

---

## R8 — 한글→영문 kebab-case 개명 정책 (FR-014)

**Decision**:
- **이관되는 문서는 이관 시점에 개명**: `plans/buy차트스캔개선작업계획.md` → `archive/buy-chart-scan-improvement-plan.md` 1건.
- **archive/ 내부 기존 한글 파일 10건**(`기능명세서_홈화면.md`, `ERD.md`, `상승조건저점체크조건검사.md` 등) → **개명하지 않음**. 이유: 이미 archive라 활성 참조 없음, 개명은 Git 이력 추적 비용만 증가.
- **신규 문서**: 모두 영문 kebab-case 의무(예: `drift-audit.md`, `folder-map.md`, `permission-categories.md`).

**Rationale**: 개명은 정보 손실 없이도 Git blame 연결을 깨뜨리므로 이득이 있는 경우에만 적용(이관 동시 처리 1건).

**Alternatives considered**:
- "전수 개명" — 과도, archive 파일 개명 이득이 작음.
- "개명 금지" — FR-014와 US 수용 기준 위반(신규 파일 규칙 필요).

---

## Resolved Unknowns

| # | 결정 요약 |
|---|---|
| R1 | docs/archive + plans/ → `.claude/archive/` 승격. plan/ 삭제. |
| R2 | 트리거 표에 migrations·utils·tests·scripts 항목 추가. |
| R3 | 드리프트 문서 4개 신설(`backend/utils.md`, `backend/migrations.md`, `frontend/utils.md`, `frontend/lib.md`) + `store/store.md` 확장. |
| R4 | Constitution 섹션 구조 확정(원칙 5 + R/PY/FE/Git/SR/E/DB/S/C + Governance). |
| R5 | Permissions 29 엔트리로 축약(5 카테고리). `git push`는 (d)로 이동해 자동 허용에서 제거. |
| R6 | YAML frontmatter 메타 헤더 채택(purpose/reader/update-trigger/last-audit). |
| R7 | `guides/drift-audit.md` 신설(셀프 체크 + 분기 감사 2부). |
| R8 | 이관 1건만 개명, archive 기존 파일은 유지. 신규는 모두 kebab-case. |

**NEEDS CLARIFICATION 잔존**: 없음. Phase 1 진입 가능.
