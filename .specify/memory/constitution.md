# Trading View Platform Constitution

**Version**: 1.0.0 | **Ratified**: 2026-04-18 | **Last Amended**: 2026-04-18

이 문서는 프로젝트의 **유일한 헌장(source of truth)**이다. CLAUDE.md는 트리거 표·보호 규칙 표를 유지하되 상세 규칙은 본 헌장을 참조한다. 본 헌장 외부에 규칙을 중복 기재하지 않는다.

---

## Core Principles

1. **이해 먼저, 코딩 다음** (Understand First, Code Second) — 관련 컨텍스트 파일을 먼저 읽고 설계 방향을 정한 뒤 코드를 수정한다.
2. **작은 단위로 쪼개고 검증** (Small & Verified) — 한 번에 하나의 관심사만 변경하고 각 단위를 독립적으로 확인한다.
3. **기존 코드 존중 — 동작하는 것을 깨뜨리지 않는다** (Don't Break What Works) — 리팩토링보다 기능 추가가 우선이며, 이미 검증된 로직의 관성을 존중한다.
4. **모든 결정에는 이유가 있다** (No Silent Decisions) — 임계값·설계 선택·예외 처리의 이유를 커밋·PR·메모리에 남긴다.
5. **사용자의 의도를 코드보다 우선** (Intent Over Implementation) — 요청의 의도가 모호하면 구현 전에 질문하고 선택지를 제시한다.

---

## Coding Rules

### Universal (R-01 ~ R-08)

- **R-01** 한 번에 하나의 관심사만 변경한다.
- **R-02** 새 코드는 기존 프로젝트의 네이밍 컨벤션을 따른다.
- **R-03** 매직 넘버/스트링 금지 — 상수 또는 설정값으로 추출한다.
- **R-04** 주석은 "왜(Why)"를 설명한다, "무엇(What)"은 코드가 설명한다.
- **R-05** 에러 메시지는 사용자가 다음 행동을 알 수 있도록 작성한다.
- **R-06** 기존 유틸리티/헬퍼가 있으면 재사용한다, 중복 생성하지 않는다.
- **R-07** import 구문은 프로젝트의 기존 정렬 방식을 따른다.
- **R-08** 타입 힌트(Python) 또는 타입 정의(TypeScript)를 반드시 포함한다.

### Python / FastAPI (PY-01 ~ PY-06)

- **PY-01** 비동기 함수(`async def`)를 기본으로 사용한다.
- **PY-02** Pydantic 모델로 요청/응답 스키마를 정의한다.
- **PY-03** DB 세션은 의존성 주입(`Depends`)으로 관리한다.
- **PY-04** 환경별 설정은 `pydantic-settings` 또는 `.env`로 관리한다.
- **PY-05** SQL 쿼리는 파라미터 바인딩을 사용한다(SQL Injection 방지).
- **PY-06** 로깅은 `print()` 대신 `loguru` logger를 사용한다.

### Frontend / React + TypeScript (FE-01 ~ FE-05)

- **FE-01** 컴포넌트는 단일 책임 원칙을 따른다.
- **FE-02** 상태 관리: 서버 상태 → React Query, 전역 상태 → Zustand.
- **FE-03** API 호출은 `frontend/src/api/client.ts`에 집중한다.
- **FE-04** 하드코딩된 API URL 금지 — 환경 변수(`VITE_API_URL`)로 관리한다.
- **FE-05** 에러/로딩/빈 상태(empty state)를 반드시 처리한다.

---

## Git Workflow

### Branch Strategy

```
main
 └── feature/[기능명]   — 새 기능
 └── fix/[이슈-설명]    — 버그 수정
 └── refactor/[대상]    — 리팩토링
 └── chore/[내용]       — 설정, 의존성 등
 └── NNN-[short-name]   — Speckit 기능 브랜치 (NNN은 3자리 순번)
```

### Commit Conventions

- 형식: `<type>: <설명>` (한국어 허용).
- type: `feat` / `fix` / `refactor` / `style` / `docs` / `test` / `chore` / `hotfix`.
- 예시:
    - `feat: 관심종목 알림 설정 추가`
    - `fix: 차트 BUY 거래량 필터 오작동 수정`
    - `refactor: 스캔 청크 처리 로직 분리`
- PR 제목은 70자 이내. 본문에 변경 요약·Test plan 포함.

### Safety

- `rules/` 편집 전 사용자 명시적 승인 필수.
- `git push --force`, `git reset --hard` 등 파괴적 명령은 수동 승인 카테고리.
- 시크릿(`.env`, 토큰) 커밋 금지.

---

## Operations

### Server Restart (SR-01 ~ SR-06)

- **SR-01** 모든 작업 완료 후 백엔드와 프론트엔드를 반드시 재시작한다(등급 무관).
- **SR-02** 백엔드: `uvicorn app:app --reload --host 0.0.0.0 --port 8000`.
- **SR-03** 프론트엔드 재빌드: `pnpm build` (`frontend/dist/` 갱신).
- **SR-04** 프론트엔드 재시작: `pnpm dev`.
- **SR-05** 재시작 순서: 백엔드 → 프론트 빌드 → 프론트 서버.
- **SR-06** 상세 명령어는 `.claude/guides/verification.md` 참조.

> 백엔드가 `frontend/dist/`를 SPA로 직접 서빙하므로 빌드 생략 시 변경 사항이 실제 서비스에 반영되지 않는다.

### Error Protocol (E-01 ~ E-04, D-01)

- **E-01** 에러를 만나면 즉시 멈추고 분석한다 — 추측으로 수정하지 않는다.
- **E-02** 에러 메시지를 전문(full text) 읽는다.
- **E-03** 3단계 분석법:
    1. 에러 메시지가 직접 가리키는 원인.
    2. 스택 트레이스에서 내 코드의 마지막 호출 지점.
    3. 관련 코드의 최근 변경 이력.
- **E-04** 같은 해결책을 3번 이상 시도하지 않는다 — 접근 방식 변경.
- **D-01** 5번의 시도 이상 같은 문제에 머물면 사용자에게 보고한다.

---

## Data Rules (DB-01 ~ DB-04)

- **DB-01** 스키마 변경 전 반드시 롤백 SQL도 함께 작성한다.
- **DB-02** NOT NULL 컬럼 추가 시 DEFAULT 값을 반드시 지정한다.
- **DB-03** `SELECT *` 사용 금지 — 필요한 컬럼만 명시한다.
- **DB-04** N+1 쿼리 패턴을 피한다.

---

## Security Rules (S-01 ~ S-04)

- **S-01** 비밀번호, API 키, 토큰을 코드에 하드코딩하지 않는다.
- **S-02** `.env` 파일은 `.gitignore`에 반드시 포함한다.
- **S-03** 사용자 입력은 항상 검증(validation)한다.
- **S-04** SQL 파라미터 바인딩을 사용한다.

---

## Communication Rules (C-01 ~ C-06)

- **C-01** 작업 시작 전: 무엇을 할 것인지 요약한다.
- **C-02** 작업 완료 후: 무엇을 했는지 + 검증 결과를 보고한다.
- **C-03** 불확실한 결정이 필요할 때: 선택지를 제시하고 의견을 묻는다.
- **C-04** 예상치 못한 상황 발견 시: 즉시 보고하고 진행 여부를 확인한다.
- **C-05** 사용자가 요청하지 않은 리팩토링을 하지 않는다.
- **C-06** speckit(`/spec` 명령)은 사용자가 명시적으로 요청할 때만 실행한다.

---

## Governance

- 본 헌장은 프로젝트 내 모든 관행보다 우선한다.
- 헌장 변경 시 PR에 변경 근거(왜)를 명시한다.
- 버전 규칙: MAJOR(비호환 원칙 변경) · MINOR(섹션 추가) · PATCH(문구·예시 조정).
- 헌장 변경은 `/speckit.constitution` 명령 또는 수기 PR로 수행한다.
- CLAUDE.md는 본 헌장을 참조만 하고 규칙 본문을 복제하지 않는다(중복 검사: `grep '^\[R-[0-9]*\]' CLAUDE.md` 결과 0 기대).

---

**End of Constitution** | v1.0.0
