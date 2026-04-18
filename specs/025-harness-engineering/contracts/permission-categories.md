# Contract: Bash/MCP Permission Categories

**Applies to**: `.claude/settings.local.json`의 `permissions.allow` / `permissions.ask` 목록.
**Target size**: 전체 엔트리 ≤ 30 (FR-008, SC-005).

## 5 Categories

### (a) Read-only / Audit

**Intent**: 저장소·런타임 상태를 **읽기만** 하는 명령.
**Action**: `allow` (넓은 glob 허용).

**Patterns**:
```
Bash(ls:*)
Bash(cat:*)
Bash(grep:*)
Bash(find:*)
Bash(git status:*)
Bash(git log:*)
Bash(git diff:*)
Bash(lsof:*)
```

**Exclusions**: 위 명령이라도 `| xargs rm -rf` 형태의 파괴적 파이프가 있으면 (d)로 분류.

---

### (b) Local Build / Test / Run

**Intent**: 로컬에서 빌드·테스트·서버·스크립트 실행. 외부 시스템 상태 변경 없음.
**Action**: `allow`.

**Patterns**:
```
Bash(pnpm:*)
Bash(npm:*)
Bash(python3:*)
Bash(.venv/bin/*)
Bash(pytest:*)
Bash(uvicorn:*)
Bash(curl -s http://localhost:*)
Bash(node:*)
```

**Exclusions**: `curl`에 외부 호스트가 포함되면 (e)로 분류.

---

### (c) Git Write

**Intent**: 지역 브랜치에 쓰기. 원격·힘 쓰기(force)는 포함 안 함.
**Action**: `allow`.

**Patterns**:
```
Bash(git add:*)
Bash(git commit:*)
Bash(git stash:*)
Bash(git branch:*)
Bash(git checkout:*)
Bash(git restore:*)
Bash(git merge:*)
```

**Exclusions**:
- `git push` → (d).
- `git reset --hard`, `git branch -D`, `git checkout .` → (d).
- `git config` 수정 → (d).

---

### (d) Destructive / Shared Impact

**Intent**: **되돌리기 어렵거나 저장소 외부에 영향을 미치는** 명령.
**Action**: `ask` (자동 허용 금지). 필요 시 사용자가 그때그때 승인.

**Patterns** (allow 리스트에 넣지 않음, 참고용):
```
Bash(git push:*)
Bash(git reset --hard:*)
Bash(git push --force:*)
Bash(git branch -D:*)
Bash(rm -rf:*)
Bash(kill:*)
Bash(docker stop:*)
Bash(docker rm:*)
```

**Rule**: 본 카테고리는 `permissions.allow`에 **등록하지 않는다**. `permissions.ask`에 명시적으로 넣거나, 기본 동작(미등록 → 승인 필요)에 맡긴다.

---

### (e) External / MCP

**Intent**: 외부 API 호출, MCP 서버 도구 사용.
**Action**: `allow` (프로젝트에서 활용 중인 MCP 서버로 한정).

**Patterns**:
```
mcp__filesystem__*
mcp__context7__*
mcp__memory__*
mcp__github__*
Bash(awk:*)
Bash(xargs:*)
```

**Exclusions**: 알려지지 않은 MCP 서버 도구는 `ask`로 남겨 재검토.

---

## Categorization Rules

1. 모든 명령은 정확히 **한 카테고리**에 속한다.
2. 애매한 경우 **더 높은 위험 카테고리**(더 보수적)로 분류.
3. 새 명령을 추가하려면 카테고리 결정을 PR 설명에 적어야 한다.
4. 이 계약이 변경되면 `last-audit` 갱신 + 헌장 참조 업데이트.

## Audit

### 정합성 체크

```bash
# allow 엔트리 수
python3 -c "import json; d=json.load(open('.claude/settings.local.json')); print(len(d['permissions']['allow']))"
# 목표: ≤ 30
```

### 누락 감사

재정비 전 기존 103 엔트리 각각이 **어느 카테고리에 매핑되는지** 표로 증명한 뒤 교체한다. 매핑되지 않는 엔트리가 있으면:

- 실제 필요한지 재검증 후 분류.
- 더 이상 필요 없으면 제거(Assumption: 무해).

## Examples

### 잘못된 분류

```
❌ "Bash(pnpm build:*)" 을 (a)에 넣음 → 빌드는 파일 쓰기가 있으므로 (b) 옳음
❌ "Bash(git push:*)" 을 (c)에 넣음 → 원격 쓰기는 (d)
❌ "mcp__filesystem__write_file"을 (a)에 넣음 → 쓰기는 (b) 또는 (d) 분류
```

### 올바른 분류

```
✅ "Bash(pnpm build:*)" → (b) local build/test
✅ "Bash(git push:*)" → (d) destructive/shared (자동 허용 금지)
✅ "mcp__filesystem__*" → (e) external/MCP
```
