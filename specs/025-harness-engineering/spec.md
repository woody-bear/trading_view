# Feature Specification: 하네스 엔지니어링 최적 구조화 (.claude/ 재정비 + 프로젝트 세팅)

**Feature Branch**: `025-harness-engineering`
**Created**: 2026-04-18
**Status**: Draft
**Input**: User description: "하네스 앤지니어링에 가장 적합한 방식으로 .claude/ 폴더아래 구조화를 시키고 프로젝트 세팅"

## Clarifications

### Session 2026-04-18

- Q: 최종 폴더 레이아웃 방향 → A: **현재 코드 영역 정렬 구조 유지** — `.claude/backend/`·`.claude/frontend/`가 이 프로젝트의 실제 코드 레이아웃(FastAPI 백엔드 + React 프론트엔드)을 **미러링**한다. Rails라면 `.claude/model/`·`.claude/controller/`가 되는 원칙. 급격한 재배치 없이 중복/사문화 폴더만 정리하고, 각 코드 영역 폴더 내부에서 해당 영역의 주요 구성요소(라우터·모델·스키마·서비스·페이지·컴포넌트 등)가 개별 파일로 설명되도록 **보강**한다.
- Q: 각 코드 영역 폴더 내부 파일의 커버리지 기준 → A: **코드 폴더/모듈당 1 문서** 원칙. 백엔드는 `routes/`·`models.py`·`schemas.py`·`services/`·`fetchers/`·`indicators/`·`scheduler.py`·`auth.py`·`config.py` 각각 .md 1개, 프런트엔드는 `api/`·`components/`·`pages/`·`router/`·`store/`·`hooks/`·`types/`·`css/` 각각 .md 1개. 신규 코드 폴더/모듈이 추가될 때 대응 문서 작성이 의무.
- Q: 프로젝트 헌장(constitution)의 위치·분리 수준 → A: **`.specify/memory/constitution.md`** 단일 파일이 원본(source of truth). Speckit의 `/speckit.constitution` 명령으로 생성·갱신. CLAUDE.md는 트리거 표를 유지하되 헌장 세부 규칙은 **헌장 파일 한 줄 참조**로 대체되어 중복을 제거한다.
- Q: 코드-문서 드리프트 감지 수준 → A: **분기 감사 + 작업 완료 시 셀프 체크** 2단계. (1) 기능이 완료되면(Speckit `tasks.md` 100% 또는 기능 PR 머지 직전) 담당자가 대응 `.claude/` 문서가 갱신되었는지 셀프 체크리스트로 확인. (2) 분기 1회 샘플 감사로 드리프트 누적을 감지한다. 자동 CI 체크·PR 템플릿 강제는 현 단계 비채택(향후 승격 가능).
- Q: Bash permissions 카테고리 그룹화 기준 → A: **위험도 × 공유 영향** 축. (a) 읽기 전용·감사, (b) 지역 빌드·테스트·실행, (c) Git 쓰기, (d) 파괴적/공유(push·force·reset·rm -rf), (e) 외부 API/셸 MCP. a·b는 넓은 glob으로 자동 허용, c는 중간 허용, d·e는 수동 승인 유지.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 작업 유형에 따라 Claude가 최소한의 컨텍스트만 로드하도록 트리거 표 정비 (Priority: P1)

개발자가 "API 엔드포인트를 추가해 줘" 또는 "신호 판정 로직을 수정해 줘" 같은 작업을 요청했을 때, Claude는 전체 `.claude/` 문서를 스캔하지 않고 **작업 유형별 트리거 표**(CLAUDE.md)를 먼저 조회해 필요한 3개 이하의 컨텍스트 파일만 읽는다. 이로써 응답 시작 속도가 빨라지고 컨텍스트 토큰 사용이 줄어든다.

**Why this priority**: 이 프로젝트의 컨텍스트 문서는 이미 47개에 달해 매번 다 읽는 것은 비효율적이다. 트리거 표가 명확해야 Claude가 "이 작업에는 이 3개만 읽으면 된다"고 판단할 수 있으며, 이 첫 번째 경로가 제대로 동작하지 않으면 나머지 문서 구조 개선이 의미가 없다.

**Independent Test**: 서로 다른 5가지 작업 유형(새 API, DB 모델 변경, 스캔 로직, 모바일 레이아웃, 차트 라벨)을 각각 따로 의뢰했을 때, Claude가 **3개 이하**의 컨텍스트 파일만 열람하고도 정확한 변경을 제시하면 성공.

**Acceptance Scenarios**:

1. **Given** 개발자가 "새 API 엔드포인트 `/foo`를 추가" 요청, **When** Claude가 CLAUDE.md 트리거 표를 조회, **Then** `.claude/backend/router.md`, `schemas.md`, `services.md` 3개만 열고 구현 제안이 나온다.
2. **Given** 개발자가 "차트 BUY 라벨 기준 조정" 요청, **When** Claude가 트리거 표를 조회, **Then** `domain/signals.md`와 `rules/chart-buy-label.md` 2개를 읽고 `rules/` 폴더가 보호되어 있음을 사용자에게 먼저 알린다.
3. **Given** 트리거 표에 없는 새 유형의 작업 요청, **When** Claude가 파일을 찾지 못함, **Then** 추측하지 않고 사용자에게 "어느 파일을 참조해야 할지 트리거 표에 추가가 필요하다"고 보고한다.

---

### User Story 2 - 폴더별 책임이 명확해 새 컨텍스트를 어디에 기록할지 즉시 판단 (Priority: P1)

개발자가 새 기능(예: 새로운 지표, 새로운 외부 데이터 소스, 새로운 시장)을 추가했을 때 그 맥락을 기록할 위치를 **1분 이내**에 결정할 수 있어야 한다. 현재는 `context/`, `backend/`, `domain/`, `docs/`, `plans/`, `plan/`, `rules/`, `guides/` 등 유사해 보이는 폴더가 혼재해 결정 피로가 있다.

**Why this priority**: 컨텍스트 문서는 작성 비용보다 **찾는 비용·유지 비용**이 훨씬 크다. 폴더 구분이 모호하면 같은 정보가 여러 곳에 분산되고, 시간이 지나며 stale 문서가 누적된다. 구조가 명확해야 컨텍스트가 자산이 된다.

**Independent Test**: "새로운 데이터 소스 X를 추가했다"는 가상 시나리오에서 개발자가 아무 추가 설명 없이도 기록 위치를 정확히 한 곳으로 특정하는지 실험 (예: `.claude/backend/fetchers.md`에 항목 추가).

**Acceptance Scenarios**:

1. **Given** 새 도메인 지식(예: "옵션 IV 분석")이 추가됨, **When** 개발자가 폴더 가이드를 참조, **Then** `.claude/domain/` 하위에 새 파일을 만든다고 1분 내 결정한다.
2. **Given** 새 CSS 레이아웃 규칙이 생김, **When** 개발자가 판단, **Then** `.claude/frontend/css/` 아래에 기록하고 `components/components.md`에서 중복 작성하지 않는다.
3. **Given** 폴더 구분이 모호한 경계 사례, **When** 개발자가 폴더 가이드(`.claude/README.md` 또는 동등 문서)를 조회, **Then** 명시적 결정 기준(예: "언어/런타임 지식은 context/, 비즈니스 규칙은 rules/, 절차적 가이드는 guides/")이 나와 있다.

---

### User Story 3 - 보호된 규칙(rules/)·가이드(guides/)·일반 컨텍스트의 경계가 자동으로 인식됨 (Priority: P2)

비즈니스 규칙(예: 스캔 대상 종목, 차트 BUY/SELL 임계값)은 무심코 리팩토링 중에 변경되면 안 된다. 현재 CLAUDE.md에 "`rules/` 수정 시 사용자 확인 필요" 문구가 있으나, 구조 자체로도 보호가 명확해야 실수 위험이 낮다.

**Why this priority**: 이미 트리거 표와 CLAUDE.md가 경고를 제공하지만, 실제 사고는 Claude가 경고를 놓치고 수정할 때 발생한다. 구조적 격리(명명, 경로, 선택적으로 pre-commit 체크)로 한 번 더 안전망을 둔다.

**Independent Test**: `rules/` 하위 파일을 Claude가 수정하려 할 때 최소 1회 이상 명시적 확인 절차가 트리거되면 성공.

**Acceptance Scenarios**:

1. **Given** Claude가 `.claude/rules/chart-buy-label.md` 편집을 계획, **When** 편집 직전, **Then** 사용자에게 변경 요약과 파급 효과를 먼저 보고하고 승인 전에 쓰지 않는다.
2. **Given** `.claude/guides/verification.md`는 절차 문서, **When** Claude가 수정, **Then** 경고 없이 바로 수정 가능 (rules/와 다름).
3. **Given** 새 비즈니스 규칙 추가 요청, **When** 파일 생성, **Then** `.claude/rules/` 하위에 놓이고, 해당 규칙을 이름으로 CLAUDE.md의 보호 표에 자동 추가된다(수기 또는 스크립트 지원).

---

### User Story 4 - 낡은/중복 문서가 눈에 보이게 격리되어 최신 상태만 활성 참조됨 (Priority: P2)

시간이 지나면 구버전 설계 문서, 더 이상 존재하지 않는 기능 명세, 중복 폴더(예: `plan/` vs `plans/`)가 쌓인다. 활성 컨텍스트와 보관물이 분리되어 Claude가 옛 정보를 참조해 잘못된 제안을 하지 않도록 한다.

**Why this priority**: 정확성을 해치지만 당장 기능이 고장나지는 않는 **서서히 나빠지는** 문제다. 우선순위는 P1보다 낮지만 방치 시 US1·US2의 전제(트리거 표 신뢰·폴더 역할 명확)가 무너진다.

**Independent Test**: 무작위로 추출한 `.claude/` 하위 문서 5개를 읽었을 때, 현재 코드와 대조해 **불일치가 1건 이하**면 성공.

**Acceptance Scenarios**:

1. **Given** 구버전 설계 문서가 존재함, **When** 구조 재정비 후, **Then** `.claude/docs/archive/` 같은 명시적 보관 구역에 격리되고 트리거 표에서 참조되지 않는다.
2. **Given** 같은 주제를 다루는 두 폴더(`plan/`, `plans/`), **When** 정비 후, **Then** 한 폴더로 통합되거나 용도가 명확히 분리된다.
3. **Given** 기능 완료 커밋, **When** 해당 기능의 speckit `tasks.md`가 전부 완료됨, **Then** 해당 디렉터리가 지속 참조 대상인지 보관 대상인지 결정되어 명시적으로 표시된다.

---

### User Story 5 - 프로젝트 세팅(permissions, 에이전트 정의, 프로젝트 헌장)이 하나의 일관된 체계에 통합 (Priority: P3)

`.claude/settings.local.json`에 허용 명령이 백여 개 누적돼 있고, 프로젝트의 불변 원칙(예: "한 번에 하나의 관심사", "R-시리즈 규칙")은 CLAUDE.md에 산재해 있다. 이들을 **프로젝트 헌장**으로 추출하고, 자주 쓰는 커맨드 패턴은 permissions 그룹으로 정리한다.

**Why this priority**: 동작에 영향은 없으나 개발 흐름이 매끄러워진다. US1~US4가 완료된 뒤 마무리 수준으로 적용한다.

**Independent Test**: 새 개발자가 프로젝트에 합류해 `.claude/` 상단의 README와 헌장 문서 2개만 읽고도 "이 프로젝트에서 Claude에게 무엇을 맡기고 무엇을 직접 검증해야 하는지" 설명할 수 있으면 성공.

**Acceptance Scenarios**:

1. **Given** 산재된 코딩 규칙(R-01~R-08 등), **When** 헌장 문서로 통합, **Then** 단일 지점에서 읽을 수 있고 CLAUDE.md는 그 헌장을 참조하는 형태로 슬림화된다.
2. **Given** 100개 이상의 개별 bash 허용 규칙, **When** 정비, **Then** 카테고리별 glob 그룹으로 합쳐 항목 수가 30개 이하로 줄어든다.
3. **Given** 새로운 speckit 명령 사용 시나리오, **When** 헌장을 참조, **Then** `/spec`·`/plan`·`/implement`의 사용 조건과 수동 개발의 경계가 명시되어 있다.

---

### Edge Cases

- **트리거 표에 없는 신규 작업**: 예) "새로운 언어(Rust) 백엔드 모듈 추가" — 트리거 표에 없음. Claude는 추측으로 파일을 만들지 말고 구조 업데이트를 먼저 제안해야 한다.
- **문서와 코드의 동기 실패**: 개발자가 코드를 수정했지만 `.claude/` 문서를 갱신하지 않음 → 드리프트. 주기적 감사 또는 PR 체크로 감지해야 한다.
- **이미 진행 중인 speckit 기능과 충돌**: 구조 재정비 중 `specs/025-*` 외 다른 스펙 파일이 활성 중이면 해당 브랜치의 경로는 건드리지 않는다.
- **한글·영문 혼용 파일명**: 기존 문서 중 일부(`buy차트스캔개선작업계획.md`)는 한글 경로. 보존하되 신규는 영문 kebab-case로 통일한다.
- **대량 Bash permissions 누적**: 허용 명령이 수백 개로 늘어 의미를 추적하기 어려워지는 상황. 카테고리 묶음(glob) + 주석/그룹화로 완화.
- **보호 규칙 우회**: Claude가 rules/ 경고를 읽었지만 사용자가 "그냥 해"라고 말한 경우 — 허용하되 기록을 남기도록 한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 프로젝트는 `.claude/` 최상단에 **폴더 역할 가이드**(README 성격의 단일 문서)를 제공해야 하며, 각 하위 폴더의 "언제 읽고 언제 작성하는지"를 1페이지 이내로 정의해야 한다. 가이드는 **현재 코드 레이아웃을 미러링하는 원칙**(이 프로젝트: `backend/`·`frontend/`; 타 프로젝트 예: Rails의 `model/`·`controller/`)과 영역별 파일이 해당 코드 구성요소(라우터·모델·스키마·서비스·페이지·컴포넌트 등)를 1:1로 설명한다는 규칙을 명시해야 한다.
- **FR-002**: CLAUDE.md의 **작업 유형별 트리거 표**는 백엔드/프런트엔드/풀스택 각 영역에 대해 현재 실제 코드 구조를 반영해 최신 상태여야 하며, 최소 커버리지로 다음을 포함해야 한다: 새 API, DB 모델 변경, 스캔/신호 로직 수정, 스케줄러, 페이지/컴포넌트 추가, 상태 관리, 모바일/PC 레이아웃, 인증, 데이터 수신.
- **FR-003**: `.claude/rules/` 하위 문서는 "보호된 비즈니스 규칙"으로 **명시적 경고**와 **편집 전 승인 절차**를 가져야 하며, 규칙 파일은 구조적으로 별도 폴더에 격리되어야 한다.
- **FR-004**: `.claude/guides/`는 **절차적 가이드**(검증, TDD 등)만 포함하고 비즈니스 규칙은 포함하지 않아야 한다.
- **FR-005**: `.claude/domain/`은 **코드에 직접 표현되지 않는 도메인 지식**(스캔 카테고리, 신호 판정 이유, 민감도 기준 등)을 담고, 단순히 파일 위치를 안내하는 문서는 포함하지 않는다.
- **FR-006**: 중복·유사 폴더는 통합되거나 용도가 구분되어야 한다. 구체적으로 비어 있는 `.claude/plan/`은 삭제하고 `.claude/plans/`는 archive로 이관(또는 상시 계획 폴더로 유지 여부 결정), `.claude/docs/archive/`의 잡다한 보관물은 `.claude/archive/` 하위로 승격해 경로 일관성을 확보한다. 코드 영역 폴더(`backend/`·`frontend/`)는 **유지**한다 (Session 2026-04-18 결정).
- **FR-007**: 구버전·완료된 문서는 **`archive/` 하위로 격리**되어 트리거 표 어디에서도 참조되지 않아야 하며, 기능 완료 시 이관 결정이 명시되어야 한다.
- **FR-008**: `.claude/settings.local.json`의 개별 Bash permissions는 **"위험도 × 공유 영향" 축 5개 카테고리**로 그룹화되고, 총 엔트리 수가 **30개 이하**로 유지되어야 한다:
    - **(a) 읽기 전용·감사**: grep·ls·cat·git status·git log 등 — 넓은 glob으로 자동 허용.
    - **(b) 지역 빌드·테스트·실행**: pnpm build·pnpm dev·.venv/bin/uvicorn·pytest·pnpm test·curl localhost 등 — 넓은 glob으로 자동 허용.
    - **(c) Git 쓰기**: git add·git commit — 중간 허용(개별 확인 없이 실행 가능).
    - **(d) 파괴적/공유**: git push·git reset --hard·rm -rf·git push -f 등 — **수동 승인 유지**.
    - **(e) 외부 API·셸 MCP**: 외부 서비스 호출, 광범위 MCP 도구 — **수동 승인 유지**.
    정비 후에도 기존에 정상 동작하던 일상 명령이 누락되지 않아야 한다(SC-005).
- **FR-009**: 프로젝트는 **`.specify/memory/constitution.md` 단일 파일**을 유일한 헌장(source of truth)으로 보유해야 한다. 이 파일은 `/speckit.constitution` 명령으로 생성·갱신되며, 0장 핵심 원칙(5개), R-시리즈/PY-시리즈/FE-시리즈 코딩 규칙, 작업 완료 후 서버 재시작 규칙, 에러 대응 프로토콜, Git 워크플로, 보안/DB 규칙을 통합한다. CLAUDE.md는 트리거 표·보호 규칙 표를 유지하되 헌장 상세 규칙은 **헌장 파일 한 줄 참조로 대체**하고 중복 기재하지 않는다. `.claude/` 하위에는 constitution 사본을 두지 않는다.
- **FR-010**: 문서와 코드의 드리프트를 감지하는 **검증 절차**는 `.claude/guides/verification.md`(또는 동등 위치)에 2단계로 정의되어야 한다. (1) **작업 완료 시 셀프 체크리스트**: 기능이 완료(Speckit `tasks.md` 전부 완료 또는 기능 PR 머지 직전)되면 담당자가 해당 기능이 건드린 코드 영역에 대응하는 `.claude/` 문서가 갱신되었는지 수기로 확인한다. (2) **분기별 샘플 감사**: 3개월마다 무작위 10건의 `.claude/` 문서를 샘플링해 실제 코드와 일치하는지 확인하고, 드리프트 건수를 기록한다. 자동 CI·PR 템플릿 강제는 본 스펙에서 비채택(향후 승격 여지).
- **FR-011**: 새 기능이 speckit 플로우를 통해 추가될 때, 해당 기능이 만들어낸 영구 컨텍스트(코드 외 지식)는 **speckit `specs/` 폴더가 아니라 `.claude/` 폴더**로 옮겨지거나 복사되어야 한다. speckit 결과물은 이력 보관, .claude/ 는 활성 참조.
- **FR-012**: 트리거 표에 없는 작업 유형이 등장했을 때 Claude는 추측으로 파일을 만들거나 변경하지 않고, **트리거 표 갱신을 먼저 제안**해야 한다.
- **FR-013**: `.claude/` 하위 모든 마크다운 파일은 **상단에 용도·독자·갱신 기준**을 한 줄씩 명시해야 한다(stale 판단 근거 제공).
- **FR-014**: 한글/영문 파일명 규칙이 문서화되어 신규 파일은 **영문 kebab-case**로 통일되며, 기존 한글 파일명은 이동 시 번역·개명된다.
- **FR-015**: `.claude/backend/`와 `.claude/frontend/`는 실제 코드의 최상위 폴더·모듈에 **1:1로 대응하는 .md 문서**를 유지해야 한다. 이 프로젝트 기준 최소 문서 집합은 다음과 같다:
    - 백엔드: `router.md`(routes/), `models.md`(models.py), `schemas.md`(schemas.py), `services.md`(services/), `fetchers.md`(fetchers/), `indicators.md`(indicators/), `scheduler.md`(scheduler 작업), `auth.md`(auth 흐름), `config.md`(config/환경 변수).
    - 프런트엔드: `api/api.md`, `components/components.md`, `pages/pages.md`, `router/router.md`, `store/store.md`, `hooks/hooks.md`, `types/types.md`, `css/` 하위 레이아웃 문서.
    - 코드 쪽에 최상위 폴더/모듈이 **새로 추가·제거**되면 동일 변경이 .claude/ 문서에도 반영되어야 하며, 누락된 경우 감사에서 드리프트로 집계된다(SC-004 반영).

### Key Entities

- **트리거 표(Trigger Table)**: CLAUDE.md 안의 작업 유형 → 참조 파일 매핑표. 핵심 네비게이션 자산.
- **컨텍스트 문서(Context Document)**: `.claude/backend/`, `.claude/frontend/`, `.claude/context/` 등에 있는 "이 프로젝트는 이렇게 생겼다"를 설명하는 문서.
- **보호 규칙(Protected Rule)**: `.claude/rules/` 하위의 비즈니스 규칙. 변경 전 사용자 승인 필수.
- **가이드(Guide)**: `.claude/guides/` 하위의 절차 문서(검증, TDD 등).
- **도메인 지식(Domain Knowledge)**: `.claude/domain/` 하위의, 코드에 직접 나타나지 않는 규칙/판정 근거.
- **헌장(Constitution)**: 프로젝트의 불변 원칙과 코딩 규칙을 통합한 단일 문서.
- **보관 문서(Archive)**: 더 이상 활성 참조하지 않는 완료/폐기 문서.
- **폴더 역할 가이드(Folder Map)**: `.claude/` 최상단에 위치한 README 성격 문서. "어느 폴더에 무엇을 써야 하는가"를 한눈에 보여준다.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 임의의 5개 작업 유형을 각각 Claude에게 요청했을 때, Claude가 **평균 2개 이하**의 `.claude/` 문서만 읽고 정확한 변경을 제시하는 비율이 80% 이상.
- **SC-002**: 새 개발자(또는 Claude)가 "X 주제를 어디에 기록해야 합니까?"를 물었을 때 **1분 이내**에 올바른 폴더·파일명을 답할 수 있는 문항이 10개 중 9개 이상.
- **SC-003**: `.claude/rules/` 하위 파일을 수정하려는 모든 시도에서 **사전 승인 절차**가 100% 트리거된다(감사 로그로 확인).
- **SC-004**: 구조 재정비 완료 시점에 활성 `.claude/` 문서와 실제 코드 간 **불일치 사례가 2건 이하**(무작위 표본 10건 감사 기준).
- **SC-005**: `.claude/settings.local.json`의 permissions 엔트리가 재정비 전 100+에서 **30개 이하**로 감소하며, 줄어든 상태에서도 기존 허용 범위가 누락되지 않는다.
- **SC-006**: 프로젝트 헌장 문서가 단일 파일로 존재하고, CLAUDE.md에서 해당 헌장을 참조하는 라인이 최소 1개 존재하며, 헌장 외부에 규칙이 중복 정의되지 않는다(중복 검사 스크립트 또는 수기 grep으로 0건).
- **SC-007**: `.claude/` 하위 문서 총 파일 수가 재정비 직후 기준 대비 분기당 **10% 이하 증가**(의도적 성장 억제).
- **SC-008**: 무작위 10건의 `.claude/` 문서에서 **상단 메타 헤더(용도·독자·갱신 기준)** 100% 존재.
- **SC-009**: 완료된 speckit 기능(`specs/024` 이전의 브랜치)은 활성 트리거 표에서 더 이상 참조되지 않으며, 이관 결정(활성 반영 or 보관)이 각 기능에 대해 명시된 기록이 존재.
- **SC-010**: 재정비 후 3개월 동안 "파일을 못 찾아서 Claude가 엉뚱한 제안을 한" 보고 사례가 0건(사용자 피드백 기반).

## Assumptions

- **범위는 `.claude/` 폴더 + CLAUDE.md + `.claude/settings.local.json`에 한정**. CI/CD 파이프라인, pre-commit hooks 도입, .gitattributes 조정, GitHub 워크플로 수정은 본 스펙에 포함하지 않는다(후속 제안 가능).
- **speckit 자체는 건드리지 않는다**. `.specify/` 폴더의 스크립트·템플릿은 외부 도구로 간주하며 내부 재구성 대상이 아니다.
- **기존 문서는 파괴적으로 삭제하지 않는다**. 모든 구버전 문서는 `archive/`로 이관되거나 Git 이력으로만 보존되며, 재정비 과정에서 정보가 사라지지 않도록 한다.
- **영어 문서화는 선택**. 현재 프로젝트는 한국어 중심이며, 영문 번역은 본 스펙의 요구 사항이 아니다(파일명만 영문 kebab-case).
- **Claude Code 이외 에이전트는 고려하지 않는다**. `.claude/` 구조는 Claude Code의 트리거 표·메모리 시스템에 최적화되며, 다른 AI 도구 호환은 비목표.
- **하나의 실행 경로**: 재정비는 한 번의 PR(또는 소수의 작은 PR)로 완료되며, 장기 점진 재구성보다 단기 집중 정비를 선호한다.
- **개발자는 한국어 커밋 메시지 허용**. 기존 규칙(`feat: 한국어 허용`)을 유지한다.

## Dependencies

- CLAUDE.md 트리거 표가 현재 프로젝트 코드 구조(라우터·모델·페이지·컴포넌트 경로)에 대응되어 있어야 함.
- `.specify/` 스크립트 동작 유지(본 스펙은 speckit와 공존).
- 사용자 메모리 시스템(`~/.claude/projects/.../memory/`)은 본 스펙과 독립적으로 운영되며, 본 스펙의 `.claude/`는 저장소 내 공유 컨텍스트만 다룬다.

## Out of Scope

- 새로운 도메인 기능 추가(매매 로직, UI 변경 등).
- 프론트엔드·백엔드 코드 리팩토링.
- DB 스키마 변경.
- 외부 자동화 도구(GitHub Actions, pre-commit 프레임워크) 도입.
- `.specify/` 템플릿·스크립트 내부 재구성.
- 영문 번역 문서 작성.
