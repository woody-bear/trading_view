# Contract: Document Meta-Header Schema

**Applies to**: `.claude/**/*.md`를 제외한 `commands/`·`archive/` 하위는 선택(archive는 보존된 원본을 건드리지 않음).

## Schema

각 ContextDocument 최상단에 **YAML frontmatter** 블록이 있어야 한다:

```markdown
---
purpose: <1줄, 이 문서가 설명하는 대상>
reader: <언제·누가 읽는가>
update-trigger: <어떤 변경이 이 문서 갱신을 요구하는가>
last-audit: YYYY-MM-DD
---

# 문서 본문 제목
...
```

## Field Rules

### `purpose` (필수)

- 타입: 단일 문장, ≤120자.
- 내용: 문서가 **무엇을** 설명하는지. 코드 경로 또는 도메인 개념을 명시.
- 예: `"backend/routes/ 하위 모든 FastAPI 라우터의 엔드포인트·의존성·응답 스키마를 설명."`

### `reader` (필수)

- 타입: 단일 문장, ≤120자.
- 내용: Claude 또는 개발자가 **어떤 작업을 할 때** 이 문서를 읽어야 하는가.
- 예: `"Claude가 새 API 엔드포인트를 추가·수정할 때."`

### `update-trigger` (필수)

- 타입: 단일 문장 또는 세미콜론 구분 목록, ≤200자.
- 내용: 문서 갱신을 유발하는 **코드·데이터 변경 조건**.
- 예: `"backend/routes/ 하위 파일 추가·제거; FastAPI 라우터 prefix 변경; 전역 미들웨어 변경."`

### `last-audit` (필수)

- 타입: `YYYY-MM-DD`.
- 초기값: 문서 작성일.
- 갱신 규칙: 문서 내용이 변경될 때, 또는 분기 감사에서 "현 상태와 일치 확인"이 끝났을 때 갱신.

## Validation

### 기계 검증

```bash
# frontmatter 존재 여부 (각 파일의 1번째 줄이 "---"이고 이후 "---" 닫힘)
for f in .claude/**/*.md; do
  head -1 "$f" | grep -q "^---$" || echo "MISSING: $f"
done
```

### 수기 검증

- 분기 감사(R7) 시 샘플 10건에 대해 4개 필드 모두 존재·최신 여부 확인.
- SC-008(100%) 기준.

## 예시 (완성본)

```markdown
---
purpose: backend/services/ 하위 비즈니스 로직 서비스 모듈의 역할·의존성·주요 함수 설명.
reader: Claude가 서비스 로직 추가/수정, 또는 서비스 간 호출 흐름 이해가 필요할 때.
update-trigger: backend/services/ 하위 새 파일 생성; 기존 서비스의 public 함수 시그니처 변경; 서비스 간 의존 방향 변경.
last-audit: 2026-04-18
---

# Backend Services

## 개요
...
```

## 예외

- `.claude/archive/` 하위: 역사적 문서이므로 **추가하지 않음**(기존 형태 유지).
- `.claude/commands/` 하위(speckit 명령 정의): 외부 도구 파일이므로 **적용 제외**.
- `CLAUDE.md`, `README.md`: 자체가 트리거 표·폴더 가이드이므로 **적용 제외**(대신 버전 라인 유지).
