# `.claude/` 폴더 역할 가이드

> Claude Code와 개발자가 **"어디에 무엇을 쓸지"를 1분 이내에 판단**할 수 있도록 폴더별 역할을 정의한다.
> 상세 규칙·원칙은 프로젝트 헌장 `.specify/memory/constitution.md` 참조.

---

## 0. 핵심 원칙

**이 저장소의 `.claude/` 구조는 실제 코드 레이아웃을 미러링한다.**

- 이 프로젝트는 FastAPI 백엔드 + React 프런트엔드 → `.claude/backend/`·`.claude/frontend/`.
- Rails 프로젝트라면 `.claude/model/`·`.claude/controller/`가 될 원칙.
- 각 코드 영역 폴더 내부에는 **코드 폴더/모듈마다 1개의 .md**가 대응해 해당 영역의 주요 구성요소를 설명한다.

---

## 1. 폴더 지도

| 폴더 | 역할 | 언제 읽는가 | 언제 작성/갱신하는가 |
|------|------|-------------|---------------------|
| `backend/` | FastAPI 코드 최상위 모듈 1:1 대응 문서 (routes·models·schemas·services·fetchers·indicators·scheduler·auth·config·utils·migrations) | 백엔드 작업(새 API, 모델 변경, 스캐너, 인증 등) | 코드 최상위 폴더·모듈이 추가·제거·의미 변경될 때 |
| `frontend/` | React 코드 최상위 영역 1:1 대응 (api·components·pages·router·store·hooks·types·css·utils·lib) | 프런트엔드 작업(새 페이지, 컴포넌트, 상태, 레이아웃) | 프런트 최상위 폴더·모듈 변경 시 |
| `context/` | 프로젝트 전반 개요 — 기술 스택(`stack.md`), DB 개요(`db.md`) | 신규 온보딩, 기술/DB 구조 탐색 | 주요 의존성 버전, DB 테이블 관계가 바뀔 때 |
| `domain/` | **코드에 직접 나타나지 않는 도메인 지식** — 스캔 카테고리·신호 판정 이유·임계값 | 도메인 로직을 추가·수정할 때 | 도메인 개념·기준의 변경 발생 시 |
| `rules/` | **보호된 비즈니스 규칙** — 스캔 대상 종목, 차트 라벨 기준 등 | 관련 로직 수정 전 필수 참조 | ⚠️ **사용자 승인 전 편집 금지** (§4 참조) |
| `guides/` | 절차 가이드 — 검증(`verification.md`), TDD(`tdd.md`), 드리프트 감사(`drift-audit.md`) | 해당 절차를 실행할 때 | 프로세스가 변경될 때 |
| `archive/` | 사문화·완료된 문서의 보관 구역 (기존 `docs/archive/`·`plans/`를 여기로 통합) | **읽기 전용 역사 자료 — 트리거 표에서 참조 금지**. Claude는 스스로 이 폴더를 컨텍스트로 포함시키지 않는다 | 더 이상 활성 참조하지 않는 문서를 이관할 때만 |
| `commands/` | Speckit 슬래시 명령 정의(외부 도구) | speckit 플로우 사용 시 | speckit 업데이트에 맞춰 별도 관리 |

---

## 2. 작업 진입 흐름

1. **`CLAUDE.md §4 트리거 표`에서 작업 유형을 찾는다**. 매칭되면 지정된 3개 이하 문서만 읽는다.
2. 매칭되지 않으면 추측하지 말고 사용자에게 **트리거 표 확장**을 제안한다.
3. 작업이 끝나면 해당 코드 영역 폴더 문서의 `last-audit`을 갱신하거나 내용 보강한다.

## 3. 새 문서를 추가할 때

| 추가하는 지식 | 쓰는 위치 |
|---|---|
| 새 백엔드 코드 폴더/모듈 | `backend/<module>.md` — 코드 경로와 1:1 |
| 새 프런트엔드 영역(폴더) | `frontend/<area>/<area>.md` |
| 도메인 규칙이지만 코드로 직접 표현되지 않음 | `domain/<topic>.md` |
| 변경 시 사용자 승인이 필요한 비즈니스 규칙 | `rules/<rule-name>.md` (§4 절차 포함) |
| 반복 실행 절차 | `guides/<procedure>.md` |
| 기술 스택·DB 개요 수준 설명 | `context/stack.md` 또는 `context/db.md`에 섹션 추가 |

**파일명 규칙**: 신규 파일은 **영문 kebab-case**. 기존 한글 파일은 이관·개명 시에만 영문화.

**메타 헤더(의무)**: 모든 활성 문서 최상단에 YAML frontmatter — `purpose` / `reader` / `update-trigger` / `last-audit`. 스키마는 `specs/025-harness-engineering/contracts/document-header-schema.md`.

---

## 4. 보호 규칙(`rules/`) 편집 절차

`.claude/rules/` 하위 파일은 **비즈니스 규칙의 근거**이므로 Claude가 무심코 수정하면 사고로 이어진다. 편집 전에:

1. 변경 요약과 파급 효과를 사용자에게 **먼저 보고**한다.
2. 사용자 **명시적 승인**을 받는다(묵시 승인 금지).
3. 승인 기록을 PR 설명 또는 커밋 메시지에 남긴다.

상세 계약: `specs/025-harness-engineering/contracts/claude-context-contract.md#rule-3`.

---

## 5. 드리프트 감사

문서와 코드의 불일치가 쌓이면 하네스가 거짓말하기 시작한다. 두 단계로 방지:

- **작업 완료 시 셀프 체크** — 기능 PR 머지 전 담당자가 대응 문서 갱신 확인.
- **분기 샘플 감사** — 3개월마다 무작위 10건 검증.

체크리스트: `guides/drift-audit.md`.

---

## 6. 외부 참조

- 프로젝트 헌장: `.specify/memory/constitution.md` (원칙·코딩 규칙·Git 워크플로·서버 재시작·보안 등).
- CLAUDE.md: 트리거 표 + 보호 규칙 표. 헌장을 참조하며 상세 규칙은 헌장에 둔다.
- Speckit 기능 이력: `specs/NNN-*/`. 완료된 기능의 영구 컨텍스트는 반드시 `.claude/` 로 흡수되어야 한다(Git 이력에만 묻히지 않게).
