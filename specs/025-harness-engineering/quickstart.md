# Quickstart: .claude/ 재정비 실행 가이드

**Feature**: 025-harness-engineering
**Date**: 2026-04-18
**Branch**: `025-harness-engineering` (이미 체크아웃됨)

본 문서는 재정비를 실제 수행하는 **운영 가이드**다. 각 단계는 **단일 관심사 커밋**[R-01]으로 분리한다.

---

## 사전 상태 체크

```bash
# 현재 브랜치
git branch --show-current   # → 025-harness-engineering

# 작업 트리 클린
git status                   # → nothing to commit, working tree clean

# 기준 수치
find .claude -name "*.md" | wc -l                       # 47
python3 -c "import json; d=json.load(open('.claude/settings.local.json')); print(len(d['permissions']['allow']))"   # 103
```

---

## Step 1 — Archive 이관 (R1)

**관심사**: 사문화 문서를 `.claude/archive/`로 격리.

```bash
mkdir -p .claude/archive

# docs/archive/ → archive/ 승격
mv .claude/docs/archive/* .claude/archive/
rmdir .claude/docs/archive .claude/docs

# plans/ 단일 파일 개명·이관
mv .claude/plans/buy차트스캔개선작업계획.md \
   .claude/archive/buy-chart-scan-improvement-plan.md
rmdir .claude/plans

# 빈 plan/ 삭제
rmdir .claude/plan 2>/dev/null || true
```

**검증**:
- `ls .claude/archive/ | wc -l` → 11
- `.claude/docs/`, `.claude/plan/`, `.claude/plans/` 모두 사라짐.

**Commit**: `chore: .claude 보관 문서 경로 정리 (docs+plans → archive/)`

---

## Step 2 — 폴더 역할 가이드(`README.md`) 신설 (FR-001)

**관심사**: `.claude/` 최상단에 "어디에 뭘 써야 하는지" 1페이지 가이드.

```bash
# .claude/README.md 신규 작성 — 아래 골격 기준
```

**최소 내용**:
- 원칙: `backend/`·`frontend/`는 실제 코드 최상위를 미러링.
- 폴더별 1줄 설명 + "언제 읽고 언제 작성하는지".
- 헌장은 `.specify/memory/constitution.md` 참조.
- 보호된 `rules/`는 편집 전 승인 필요.

**검증**: `.claude/README.md` 존재 + 최대 1페이지.

**Commit**: `docs(.claude): 폴더 역할 가이드 README.md 추가 (FR-001)`

---

## Step 3 — 메타 헤더 일괄 추가 (FR-013, SC-008)

**관심사**: 모든 활성 문서에 YAML frontmatter 추가.

**대상**: `.claude/backend/*.md`, `.claude/frontend/**/*.md`, `.claude/context/*.md`, `.claude/domain/*.md`, `.claude/guides/*.md`, `.claude/rules/*.md`. (archive, commands 제외 — `contracts/document-header-schema.md` 참조)

**작업 방식**: 파일마다 수기 최상단 삽입.

```markdown
---
purpose: <용도>
reader: <언제 누가>
update-trigger: <갱신 조건>
last-audit: 2026-04-18
---
```

**검증**:
```bash
for f in .claude/{backend,frontend,context,domain,guides,rules}/**/*.md; do
  head -1 "$f" | grep -q "^---$" || echo "MISSING: $f"
done
# 출력 없어야 함
```

**Commit**: `docs(.claude): 활성 문서에 메타 헤더 추가 (FR-013)`

---

## Step 4 — 코드↔문서 대응 보강 (FR-015, R3)

**관심사**: 드리프트 5건 해소.

```bash
# 신규 파일 4개 작성
touch .claude/backend/utils.md          # backend/utils/ 대응
touch .claude/backend/migrations.md     # backend/alembic/ 대응
touch .claude/frontend/utils.md         # frontend/src/utils/ 대응
touch .claude/frontend/lib.md           # frontend/src/lib/ 대응
```

- 각각 메타 헤더 포함.
- 본문: 해당 코드 폴더의 주요 파일·패턴·재사용 규칙.

**store/ 확장**: 기존 `.claude/frontend/store/store.md`를 **`frontend/src/stores/` 전체(4개 store)**까지 커버하도록 보강. (코드의 `store`/`stores` 혼재는 본 기능 범위 밖 — 문서는 양쪽을 한 문서에서 설명)

**검증**: R3 매트릭스의 모든 드리프트가 해결됨.

**Commit**: `docs(.claude): 코드-문서 1:1 대응 보강 (utils·migrations·lib + store 확장)`

---

## Step 5 — 헌장 생성 + CLAUDE.md 슬림화 (FR-009, SC-006)

**관심사**: 헌장 외부화 + CLAUDE.md 참조화.

### 5.1 헌장 작성

```bash
# .specify/memory/constitution.md 덮어쓰기
# R4 결과에 따른 섹션 구조 적용
# 최초 버전: 1.0.0 / Ratified 2026-04-18
```

`/speckit.constitution` 명령을 사용하거나 직접 편집 가능(어느 쪽이든 결과 동일).

### 5.2 CLAUDE.md 슬림화

- **유지**: §0 원칙 요약(헌장 참조 추가), §1 컨텍스트 파일 경로, §2 보호 규칙 표, §4 트리거 표(R2 보강 적용).
- **이동**: §5 코딩 규칙, §7 Git 워크플로, §8 서버 재시작, §9 에러, §10 DB, §11 보안, §12 커뮤니케이션 → **헌장으로 이동**, CLAUDE.md에는 "세부 규칙은 `.specify/memory/constitution.md` 참조" 한 줄만.

**검증**:
```bash
# CLAUDE.md에 R-01, PY-01 같은 세부 규칙 본문이 남아 있지 않아야 함(참조만 허용)
grep -c '^\[R-[0-9]*\]' CLAUDE.md   # 0 기대
```

**Commit** (두 단계로):
1. `docs(constitution): 프로젝트 헌장 1.0.0 확정 (FR-009)`
2. `docs(CLAUDE): 헌장 외부화에 따른 CLAUDE.md 슬림화 (SC-006)`

---

## Step 6 — Permissions 재작성 (FR-008, SC-005)

**관심사**: 103 엔트리 → 29 엔트리, 5 카테고리 glob.

```bash
# .claude/settings.local.json 백업
cp .claude/settings.local.json /tmp/settings.local.json.bak

# 재작성 (contracts/permission-categories.md 기준)
```

**누락 감사 절차**:
```bash
# 기존 엔트리 목록 추출
python3 -c "import json; d=json.load(open('/tmp/settings.local.json.bak')); print('\n'.join(d['permissions']['allow']))" > /tmp/prev-allow.txt

# 각 엔트리가 새 glob 중 하나에 매핑되는지 수기 확인
# git push만 예외(자동 허용에서 의도적 제외)
```

**검증**:
```bash
python3 -c "import json; d=json.load(open('.claude/settings.local.json')); print(len(d['permissions']['allow']))"
# 30 이하
```

**Commit**: `chore(.claude): settings.local.json 권한 5카테고리 glob 정리 (103 → 29)`

---

## Step 7 — 드리프트 감사 체크리스트 (FR-010, R7)

**관심사**: 정기 점검 절차 문서화.

```bash
# .claude/guides/drift-audit.md 신규
```

**내용**: R7 결과(셀프 체크 + 분기 감사 2부). 메타 헤더 포함.

**추가**: 감사 로그 템플릿 `audit-log.md` 빈 파일 생성(분기별 append 용도).

**Commit**: `docs(.claude): 드리프트 감사 체크리스트 추가 (FR-010)`

---

## Step 8 — 최종 검증

### SC-001 (Claude 로딩 시뮬레이션)

Claude Code 세션에서 아래 5 작업을 각각 **독립 요청**으로 실행하고 평균 `.claude/` 문서 로드 수를 센다. 목표: ≤2.

1. "`/api/foo` 엔드포인트 추가"
2. "`models.py`에 UserPreference 테이블 추가"
3. "스캔 결과에 ATR 지표 추가"
4. "모바일 BottomNav 버튼 추가"
5. "차트 BUY 거래량 필터 조정"

### SC-004 (10 문서 샘플 감사)

```bash
# 무작위 10건
find .claude -name "*.md" -not -path "*/archive/*" -not -path "*/commands/*" | shuf | head -10
```

각 문서가 언급하는 경로·심볼이 실제 코드에 있는지 grep으로 확인. 불일치 ≤2 기대.

### SC-005 (permissions 감사)

```bash
python3 -c "import json; d=json.load(open('.claude/settings.local.json')); print(len(d['permissions']['allow']))"
# ≤30
```

### SC-006 (헌장 중복 0)

```bash
grep -c '^\[R-[0-9]*\]\|^\[PY-[0-9]*\]\|^\[FE-[0-9]*\]' CLAUDE.md
# 0
```

### SC-008 (메타 헤더 100%)

```bash
fail=0
for f in .claude/{backend,frontend,context,domain,guides,rules}/**/*.md; do
  head -1 "$f" | grep -q "^---$" || { echo "MISSING: $f"; fail=1; }
done
[ "$fail" = 0 ] && echo "OK"
```

---

## Rollback 절차

모든 변경은 Git 커밋 단위로 분리되므로 문제 발생 시 커밋별 revert 가능. settings.local.json은 백업 경로(`/tmp/settings.local.json.bak`) 사용 권장.

---

## 예상 소요

| Step | 예상 시간 |
|---|---|
| 1. Archive 이관 | 10분 |
| 2. README 작성 | 20분 |
| 3. 메타 헤더 일괄 | 40분 (17파일 × ~2분) |
| 4. 드리프트 보강 | 60분 (4 신규 + 1 확장) |
| 5. 헌장 + CLAUDE.md | 60분 |
| 6. Permissions 재작성 | 30분 |
| 7. 감사 체크리스트 | 15분 |
| 8. 최종 검증 | 30분 |
| **총계** | **약 4~5시간** |

1~2 영업일 내 1~2개 PR로 완료 가능.
