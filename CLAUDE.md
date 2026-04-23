# 🔧 하네스 엔지니어링 (Harness Engineering)

> Claude Code가 프로젝트를 분석하고 개발을 수행할 때 반드시 따라야 하는 규칙 체계.

---

## 0. 핵심 원칙 (Core Principles)

```
1. 먼저 이해하고, 그 다음에 코딩한다 (Understand First, Code Second)
2. 작은 단위로 쪼개고, 각 단위를 검증한다 (Small & Verified)
3. 기존 코드를 존중한다 — 동작하는 것을 깨뜨리지 않는다 (Don't Break What Works)
4. 모든 결정에는 이유가 있어야 한다 (No Silent Decisions)
5. 사용자의 의도를 코드보다 우선한다 (Intent Over Implementation)
```

---

## 1. 프로젝트 컨텍스트 파일 경로

> 작업 시작 전, 관련 파일을 읽어 컨텍스트를 파악한 뒤 진행한다.

### 프로젝트 개요

| 파일 | 내용 |
|------|------|
| `.claude/context/stack.md` | 프로젝트 개요, 기술 스택, 디렉토리 구조, 실행 명령어 |
| `.claude/context/db.md` | DB 테이블 13개 전체, 관계, 마이그레이션 이력 |

### 백엔드 (FastAPI)

| 파일 | 읽어야 할 상황 |
|------|--------------|
| `.claude/backend/router.md` | API 엔드포인트 추가/수정, 라우터 파악 |
| `.claude/backend/models.md` | DB 모델 수정, ORM 쿼리 작성 |
| `.claude/backend/schemas.md` | Pydantic 스키마 추가/수정, 요청·응답 형식 |
| `.claude/backend/services.md` | 서비스 로직 추가/수정, 의존성 파악 |
| `.claude/backend/fetchers.md` | 데이터 수신 로직 (yfinance/pykrx/ccxt/KIS) |
| `.claude/backend/indicators.md` | 기술 지표, 신호 엔진, 민감도 프리셋 |
| `.claude/backend/scheduler.md` | APScheduler 작업 추가/수정 |
| `.claude/backend/auth.md` | 인증 미들웨어, JWT 검증 로직 |
| `.claude/backend/config.md` | 환경 변수, 설정값 |

### 프론트엔드 (React + TypeScript)

| 파일 | 읽어야 할 상황 |
|------|--------------|
| `.claude/frontend/router/router.md` | 페이지 라우팅, 네비게이션 수정 |
| `.claude/frontend/pages/pages.md` | 각 페이지 기능, API 호출 목록 |
| `.claude/frontend/components/components.md` | 컴포넌트 목록, SignalCard/차트 등 |
| `.claude/frontend/api/api.md` | API 함수 추가/수정, axios 인터셉터 |
| `.claude/frontend/store/store.md` | Zustand 스토어, React Query 패턴 |
| `.claude/frontend/hooks/hooks.md` | 커스텀 훅 추가/수정 |
| `.claude/frontend/types/types.md` | TypeScript 타입 정의 확인 |
| `.claude/frontend/css/mobile.md` | 모바일 레이아웃, 스냅 스크롤, BottomNav |
| `.claude/frontend/css/pc.md` | PC 레이아웃, TopNav, 그리드, CSS 변수 |

### 도메인 지식

| 파일 | 읽어야 할 상황 |
|------|--------------|
| `.claude/domain/scan.md` | 전체 시장 스캔 조건, 카테고리 판정 로직 |
| `.claude/domain/signals.md` | BUY/SELL 신호 판정, 쿨다운, 지표 파라미터 |

---

## 2. 보호된 비즈니스 규칙 (rules/)

> ⚠️ **`rules/` 폴더의 파일은 자동으로 변경하지 않는다.**  
> 수정이 필요한 경우 반드시 사용자에게 먼저 확인을 받은 뒤 진행한다.

| 파일 | 내용 | 변경 시 확인 사항 |
|------|------|-----------------|
| `.claude/rules/scan-symbols.md` | 스캔 대상 종목 리스트 (KR/US/CRYPTO) | 종목 추가/삭제 시 StockMaster 동기화 필요 여부 |
| `.claude/rules/chart-buy-label.md` | 차트 BUY 라벨 표시 기준 | 신호 판정 로직 변경의 전체적 파급 효과 |
| `.claude/rules/chart-sell-label.md` | 차트 SELL 라벨 표시 기준 | RSI 고정값(60) 변경 여부, 하위 호환성 |

---

## 3. 가이드

| 파일 | 내용 |
|------|------|
| `.claude/guides/verification.md` | 검증 프로토콜 (구문 검사, 서버 기동, 엔드포인트 테스트) |
| `.claude/guides/tdd.md` | 테스트 전략, 테스트 파일 구조, 실행 명령어 |
| `.claude/프로젝트개선.md` | 개선 제안 목록 (우선순위별) |

---

## 4. 작업 유형별 파일 참조 가이드 (Strategy A)

### 백엔드 작업

| 작업 유형 | 읽을 파일 |
|----------|----------|
| 새 API 엔드포인트 추가 | `router.md` → `schemas.md` → `services.md` |
| DB 모델 변경 | `db.md` → `models.md` → (스키마 변경 시) `schemas.md` |
| 스캔 로직 수정 | `domain/scan.md` → `services.md` → `rules/chart-buy-label.md` |
| 신호 판정 수정 | `domain/signals.md` → `indicators.md` → `rules/chart-buy-label.md` |
| 스케줄 작업 추가 | `scheduler.md` → `services.md` |
| 인증 관련 작업 | `auth.md` → `config.md` |
| 데이터 수신 수정 | `fetchers.md` → `rules/scan-symbols.md` |

### 프론트엔드 작업

| 작업 유형 | 읽을 파일 |
|----------|----------|
| 새 페이지 추가 | `router/router.md` → `pages/pages.md` → `api/api.md` |
| 컴포넌트 수정 | `components/components.md` → `types/types.md` |
| API 연동 | `api/api.md` → `types/types.md` → `store/store.md` |
| 상태 관리 수정 | `store/store.md` → `hooks/hooks.md` |
| 모바일 레이아웃 수정 | `css/mobile.md` → `components/components.md` |
| PC 레이아웃 수정 | `css/pc.md` → `components/components.md` |

### 풀스택 작업

| 작업 유형 | 읽을 파일 |
|----------|----------|
| 새 기능 전체 구현 | `stack.md` → `db.md` → `router.md` → `schemas.md` → `api/api.md` → `types/types.md` |
| 스캔 결과 표시 변경 | `domain/scan.md` → `services.md` → `api/api.md` → `components/components.md` |

---

## 5. 작업 분해 프로토콜 (Task Decomposition Protocol)

### 5.1 작업 크기 분류

| 등급 | 기준 | 접근법 |
|------|------|--------|
| **S** (Small) | 단일 파일, 10줄 이내 변경 | 즉시 실행 |
| **M** (Medium) | 2~5개 파일, 기존 패턴 내 변경 | 계획 → 실행 → 검증 |
| **L** (Large) | 새로운 기능, 다수 파일 생성 | 설계 → 승인 → 단계별 실행 → 검증 |
| **XL** (Extra Large) | 아키텍처 변경, DB 스키마 변경 | 제안서 작성 → 승인 → 마이그레이션 계획 → 단계별 실행 |

### 5.2 작업 계획서 양식 (M 이상)

```
🎯 작업: [작업 제목]
━━━━━━━━━━━━━━━━━━━━

📌 목표: [이 작업이 완료되면 달라지는 것]

📂 영향 범위:
  - 수정: [파일 목록]
  - 생성: [파일 목록]
  - 삭제: [파일 목록]

⚠️ 리스크:
  - [깨질 수 있는 기존 기능]
  - [주의해야 할 의존성]

📋 실행 단계:
  1. [구체적 단계]
  2. [구체적 단계]

✅ 완료 기준:
  - [검증 가능한 조건 1]
  - [검증 가능한 조건 2]
```

---

## 6. 코딩 규칙 (Coding Rules)

### 6.1 범용 규칙

```
[R-01] 한 번에 하나의 관심사만 변경한다
[R-02] 새 코드는 기존 프로젝트의 네이밍 컨벤션을 따른다
[R-03] 매직 넘버/스트링 금지 — 상수 또는 설정값으로 추출한다
[R-04] 주석은 "왜(Why)"를 설명한다, "무엇(What)"은 코드가 설명한다
[R-05] 에러 메시지는 사용자가 다음 행동을 알 수 있도록 작성한다
[R-06] 기존 유틸리티/헬퍼가 있으면 재사용한다, 중복 생성하지 않는다
[R-07] import 구문은 프로젝트의 기존 정렬 방식을 따른다
[R-08] 타입 힌트(Python) 또는 타입 정의(TypeScript)를 반드시 포함한다
```

### 6.2 Python (FastAPI) 전용 규칙

```
[PY-01] 비동기 함수(async def)를 기본으로 사용한다
[PY-02] Pydantic 모델로 요청/응답 스키마를 정의한다
[PY-03] DB 세션은 의존성 주입(Depends)으로 관리한다
[PY-04] 환경별 설정은 pydantic-settings 또는 .env로 관리한다
[PY-05] SQL 쿼리는 파라미터 바인딩을 사용한다 (SQL Injection 방지)
[PY-06] 로깅은 print() 대신 loguru logger를 사용한다
```

### 6.3 프론트엔드 전용 규칙

```
[FE-01] 컴포넌트는 단일 책임 원칙을 따른다
[FE-02] 상태 관리: 서버 상태 → React Query, 전역 상태 → Zustand
[FE-03] API 호출은 frontend/src/api/client.ts에 집중한다
[FE-04] 하드코딩된 API URL 금지 — 환경 변수(VITE_API_URL)로 관리한다
[FE-05] 에러/로딩/빈 상태(empty state)를 반드시 처리한다
```

---

## 7. Git 워크플로 규칙

### 브랜치 전략

```
main
 └── feature/[기능명]     — 새 기능
 └── fix/[이슈-설명]      — 버그 수정
 └── refactor/[대상]      — 리팩토링
 └── chore/[내용]         — 설정, 의존성 등
```

### 커밋 규칙

```
형식: <type>: <설명> (한국어 허용)
  feat / fix / refactor / style / docs / test / chore / hotfix

예시:
  feat: 관심종목 알림 설정 추가
  fix: 차트 BUY 거래량 필터 오작동 수정
  refactor: 스캔 청크 처리 로직 분리
```

---

## 8. 작업 완료 후 서버 재시작 규칙

```
[SR-01] 모든 작업 완료 후 백엔드와 프론트엔드를 반드시 재시작한다 (등급 무관)
[SR-02] 백엔드 재시작: uvicorn app:app --reload --host 0.0.0.0 --port 8000
[SR-03] 프론트엔드 재빌드: pnpm build (dist/ 갱신)
[SR-04] 프론트엔드 재시작: pnpm dev
[SR-05] 재시작 순서: 백엔드 → 프론트 빌드 → 프론트 서버
[SR-06] 상세 명령어: .claude/guides/verification.md 참조
```

> 백엔드가 `frontend/dist/`를 SPA로 직접 서빙하므로,  
> 빌드를 건너뛰면 변경 사항이 실제 서비스에 반영되지 않는다.

---

## 9. 에러 대응 프로토콜

```
[E-01] 에러를 만나면 즉시 멈추고 분석한다 — 추측으로 수정하지 않는다
[E-02] 에러 메시지를 전문(full text) 읽는다
[E-03] 3단계 분석법:
       1단계: 에러 메시지가 직접 가리키는 원인 확인
       2단계: 스택 트레이스에서 내 코드의 마지막 호출 지점 확인
       3단계: 관련 코드의 최근 변경 이력 확인
[E-04] 같은 해결책을 3번 이상 시도하지 않는다 — 접근 방식 변경
[D-01] 5번의 시도 이상 같은 문제에 머물면 사용자에게 보고한다
```

---

## 10. DB 규칙

```
[DB-01] 스키마 변경 전 반드시 롤백 SQL도 함께 작성한다
[DB-02] NOT NULL 컬럼 추가 시 DEFAULT 값을 반드시 지정한다
[DB-03] SELECT * 사용 금지 — 필요한 컬럼만 명시한다
[DB-04] N+1 쿼리 패턴을 피한다
```

---

## 11. 보안 규칙

```
[S-01] 비밀번호, API 키, 토큰을 코드에 하드코딩하지 않는다
[S-02] .env 파일은 .gitignore에 반드시 포함한다
[S-03] 사용자 입력은 항상 검증(validation)한다
[S-04] SQL 파라미터 바인딩을 사용한다
```

---

## 12. 커뮤니케이션 규칙

```
[C-01] 작업 시작 전: 무엇을 할 것인지 요약한다
[C-02] 작업 완료 후: 무엇을 했는지 + 검증 결과를 보고한다
[C-03] 불확실한 결정이 필요할 때: 선택지를 제시하고 의견을 묻는다
[C-04] 예상치 못한 상황 발견 시: 즉시 보고하고 진행 여부를 확인한다
[C-05] 사용자가 요청하지 않은 리팩토링을 하지 않는다
[C-06] speckit(/spec 명령)은 사용자가 명시적으로 요청할 때만 실행한다
```

---

*Last updated: 2026-04-23*
*Version: 2.0 — Strategy A (trigger table)*

## Active Technologies
- Python 3.11 (backend), TypeScript 5 / React 18 (frontend) + FastAPI, SQLAlchemy, pydantic-settings, yfinance, pykrx (backend) · React Router, React Query, Zustand, lightweight-charts, Tailwind (frontend) (022-stock-detail-layered-analysis)
- 기존 SQLite/PostgreSQL — 본 기능은 **신규 테이블 없음**. `/company/{symbol}` 응답은 백엔드 in-memory 1h TTL 캐시 재사용. 프론트는 React Query 캐시(staleTime 1h) 사용. (022-stock-detail-layered-analysis)
- Python 3.11 (backend), TypeScript 5 / React 18 (frontend) + FastAPI, yfinance, httpx(이미 설치), BeautifulSoup(bs4, 이미 설치) (backend) · React Query, Zustand (frontend, 022에서 도입) (023-kr-naver-fundamentals)
- 신규 테이블 없음. 네이버 보강 결과는 **in-memory dict 캐시**(24h TTL) + 기존 company in-memory 캐시 재사용. (023-kr-naver-fundamentals)
- DB 신규 테이블 없음. 서버 in-memory 캐시 60초 TTL + 프론트 React Query staleTime 5분 (024-trend-trading-signals)
- TypeScript 5 / React 18 (frontend), Python 3.11 (backend) (027-scan-conditions-page)
- 본 기능은 신규 테이블·DB 변경 없음. 정적 콘텐츠 페이지 + 백엔드 함수 재구성. (027-scan-conditions-page)
- Python 3.11 (backend), TypeScript 5 / React 18 (frontend) + FastAPI, PyJWT (backend) · Supabase JS Client, Zustand, React Query, Axios (frontend) (029-auth-session-stability)
- N/A — 신규 테이블 없음. ReturnUrl은 localStorage, JWKS는 메모리 캐시 (029-auth-session-stability)
- TypeScript 5 / React 18 (frontend), Python 3.11 (backend) + React, Tailwind CSS, React Query, Zustand, Vite (030-list-price-flicker)
- N/A — 신규 DB 테이블 없음, in-memory 상태만 사용 (030-list-price-flicker)
- TypeScript 5 / React 18 (frontend), Python 3.11 (backend) + React, Tailwind CSS, FastAPI, SQLAlchemy (backend) (031-signal-days-label)
- 신규 테이블 없음. `ScanSnapshotItem.last_signal_date` 기존 컬럼 활용 (031-signal-days-label)
- TypeScript 5 / React 18 + React Query (`@tanstack/react-query`), Tailwind CSS, Vite (032-scan-buy-strip-pc)
- N/A — 신규 테이블 없음, 기존 스냅샷 API 재사용 (032-scan-buy-strip-pc)

## Recent Changes
- 022-stock-detail-layered-analysis: Added Python 3.11 (backend), TypeScript 5 / React 18 (frontend) + FastAPI, SQLAlchemy, pydantic-settings, yfinance, pykrx (backend) · React Router, React Query, Zustand, lightweight-charts, Tailwind (frontend)
