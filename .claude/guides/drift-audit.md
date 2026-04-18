---
purpose: 코드와 .claude/ 문서 간 드리프트를 감지·예방하는 2단계 절차(작업 완료 셀프 체크 + 분기 샘플 감사).
reader: 기능 PR을 머지하기 전 담당자, 또는 분기별 하네스 점검 담당자.
update-trigger: 드리프트 감지 자동화 도입; 감사 주기 변경; 체크리스트 항목 추가·삭제.
last-audit: 2026-04-18
---

# Drift Audit — 코드 ↔ .claude/ 문서 동기화 감사

하네스(`.claude/`)가 코드의 현재 상태를 정확히 반영하지 못하면 Claude가 거짓말을 시작한다. 아래 2단계로 드리프트를 차단한다.

## 1) 작업 완료 시 셀프 체크리스트

**언제 수행**: 기능 PR 머지 **직전**(Speckit `tasks.md`가 모두 완료된 시점 또는 일반 기능 PR에서 리뷰 승인 직전).

**누가**: 해당 기능 담당자 본인.

```markdown
## Self-Check

- [ ] 이 PR이 건드린 **코드 최상위 폴더·모듈**을 나열했는가?
      (예: `backend/routes/`, `backend/services/`, `frontend/src/pages/`)
- [ ] 나열한 각 영역에 **대응하는 `.claude/` 문서**(FR-015 1:1 매핑)를 확인했는가?
- [ ] 각 대응 문서의 내용이 변경된 동작과 일치하는가? (경로·심볼·임계값·파일명)
- [ ] 새 API·페이지·컴포넌트·지표·스케줄 작업을 추가했다면 해당 .md에 항목을 **추가**했는가?
- [ ] `rules/` 변경이 있다면 PR 설명에 **사용자 승인 기록**이 있는가?
- [ ] 수정한 문서의 `last-audit` frontmatter를 오늘 날짜로 갱신했는가?
- [ ] 새 코드 폴더·모듈이 생겼는데 `.claude/` 문서가 없다면 신규 문서를 작성했는가?
```

**실패 시**: 위 항목 중 하나라도 미충족이면 머지 전에 해결한다. 의도적으로 미충족이면 PR 설명에 근거를 남긴다.

## 2) 분기별 샘플 감사

**언제 수행**: 매 분기 첫째 주(연 4회 — 1월·4월·7월·10월).

**절차**:

```bash
# 1. 무작위 10건 샘플링 (archive·commands 제외)
find .claude -name "*.md" \
  -not -path "*/archive/*" \
  -not -path "*/commands/*" \
  | shuf | head -10

# 2. 각 문서에 대해:
#    (a) frontmatter의 update-trigger 조건이 최근 3개월간 일어났는지 grep/git log
#    (b) 문서가 언급하는 코드 경로·심볼이 현 저장소에 존재하는지 grep
#    (c) rules/ 문서라면 임계값이 실제 코드와 일치하는지 대조

# 3. 드리프트 발견 시
#    - 건수를 감사 로그(audit-log.md)에 append
#    - 2건 초과 시 즉시 보강 PR 시작(SC-004 위반)
```

**기록 포맷** (`.claude/guides/audit-log.md`):

```markdown
## 2026-Q2 (2026-04-first-week)
- 감사자: woody
- 샘플 10건: [파일 목록]
- 드리프트: 1건
  - `.claude/backend/router.md` — `/api/foo` 경로가 실제 코드에서 제거됨 → 문서에서 해당 줄 삭제
- SC-004 상태: PASS (≤2)
```

## 3) 드리프트의 흔한 원인과 대응

| 원인 | 대응 |
|------|------|
| 코드 리팩토링 후 경로명 변경 | `git log --diff-filter=R --since="3 months ago"`로 리네임 추적, 문서 경로 갱신 |
| 새 엔드포인트·컴포넌트 추가 후 문서 누락 | Self-Check로 사전 방지, 분기 감사로 후행 보강 |
| rules/의 임계값이 실제 파라미터와 어긋남 | 대조 grep 후 코드와 문서 중 **어느 쪽이 맞는지** 사용자 확인 필요 |
| 완료된 speckit 기능의 맥락이 `.claude/`로 이관되지 않음 | FR-011: speckit `specs/NNN/` 완료 시 활성 지식은 반드시 `.claude/`로 복사 |

## 4) 관련 참조

- 헌장: `.specify/memory/constitution.md`
- 메타 헤더 스키마: `specs/025-harness-engineering/contracts/document-header-schema.md`
- 감사 로그: `.claude/guides/audit-log.md`
