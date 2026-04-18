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

> **Constitution**: 상세 코딩 규칙(R-/PY-/FE-), Git 워크플로, 서버 재시작, 에러 대응, DB·보안·커뮤니케이션 규칙은 `.specify/memory/constitution.md` (v1.0.0)에 통합되어 있다. CLAUDE.md는 해당 헌장을 참조할 뿐 본문을 복제하지 않는다.

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
| 새 API 엔드포인트 추가 | `backend/router.md` → `backend/schemas.md` → `backend/services.md` |
| DB 모델 변경 | `context/db.md` → `backend/models.md` → `backend/schemas.md` |
| DB 마이그레이션 (alembic) | `backend/migrations.md` → `backend/models.md` |
| 스캔 로직 수정 | `domain/scan.md` → `backend/services.md` → `rules/chart-buy-label.md` |
| 신호 판정 수정 | `domain/signals.md` → `backend/indicators.md` → `rules/chart-buy-label.md` |
| 스케줄 작업 추가 | `backend/scheduler.md` → `backend/services.md` |
| 인증 관련 작업 | `backend/auth.md` → `backend/config.md` |
| 데이터 수신 수정 | `backend/fetchers.md` → `rules/scan-symbols.md` |
| 유틸리티 함수 추가 (utils/) | `backend/utils.md` |
| 테스트 추가 | `guides/tdd.md` → `backend/models.md` |
| 일회성 스크립트 (scripts/) | `context/stack.md` |

### 프론트엔드 작업

| 작업 유형 | 읽을 파일 |
|----------|----------|
| 새 페이지 추가 | `frontend/router/router.md` → `frontend/pages/pages.md` → `frontend/api/api.md` |
| 컴포넌트 수정 | `frontend/components/components.md` → `frontend/types/types.md` |
| API 연동 | `frontend/api/api.md` → `frontend/types/types.md` |
| 상태 관리 수정 | `frontend/store/store.md` → `frontend/hooks/hooks.md` |
| 모바일 레이아웃 수정 | `frontend/css/mobile.md` → `frontend/components/components.md` |
| PC 레이아웃 수정 | `frontend/css/pc.md` → `frontend/components/components.md` |
| 유틸리티/공통 라이브러리 | `frontend/utils.md` → `frontend/lib.md` |

### 풀스택 작업

| 작업 유형 | 읽을 파일 |
|----------|----------|
| 새 기능 전체 구현 | `stack.md` → `db.md` → `router.md` → `schemas.md` → `api/api.md` → `types/types.md` |
| 스캔 결과 표시 변경 | `domain/scan.md` → `services.md` → `api/api.md` → `components/components.md` |

---

## 5. 작업 분해 프로토콜 (Task Decomposition Protocol)

| 등급 | 기준 | 접근법 |
|------|------|--------|
| **S** (Small) | 단일 파일, 10줄 이내 변경 | 즉시 실행 |
| **M** (Medium) | 2~5개 파일, 기존 패턴 내 변경 | 계획 → 실행 → 검증 |
| **L** (Large) | 새로운 기능, 다수 파일 생성 | 설계 → 승인 → 단계별 실행 → 검증 |
| **XL** (Extra Large) | 아키텍처 변경, DB 스키마 변경 | 제안서 작성 → 승인 → 마이그레이션 계획 → 단계별 실행 |

M 이상 작업은 목표·영향 범위(수정/생성/삭제)·리스크·실행 단계·완료 기준을 작업 시작 전 사용자에게 요약 보고한다.

---

## 6. 헌장(Constitution) 참조

> 상세 규칙은 모두 `.specify/memory/constitution.md` (v1.0.0, Ratified 2026-04-18)에 있다. CLAUDE.md는 중복 기재하지 않는다.

| 영역 | 규칙 ID | 요약 |
|------|---------|------|
| 범용 코딩 규칙 | R-01 ~ R-08 | 단일 관심사·네이밍 일치·매직 넘버 금지·타입 힌트 등 |
| Python / FastAPI | PY-01 ~ PY-06 | `async def` 우선·Pydantic·Depends·pydantic-settings·파라미터 바인딩·loguru |
| Frontend / React+TS | FE-01 ~ FE-05 | 단일 책임·서버=React Query/전역=Zustand·api/client.ts 집중·VITE_ 환경변수·로딩·에러 처리 |
| Git 워크플로 | — | 브랜치 규칙(feature/fix/refactor/chore), 커밋 타입(feat/fix/...), 한국어 허용 |
| 서버 재시작 | SR-01 ~ SR-06 | 모든 작업 후 백엔드 + 프론트 재빌드 필수. 순서: 백엔드 → `pnpm build` → 프론트 |
| 에러 대응 | E-01 ~ E-04, D-01 | 추측 금지·전문 확인·3단계 분석·5회 초과 시 사용자 보고 |
| DB | DB-01 ~ DB-04 | 롤백 SQL 동반·NOT NULL은 DEFAULT 필수·SELECT * 금지·N+1 회피 |
| 보안 | S-01 ~ S-04 | 시크릿 하드코딩 금지·`.env` gitignore·입력 검증·SQL 파라미터 바인딩 |
| 커뮤니케이션 | C-01 ~ C-06 | 작업 전후 요약 보고·선택지 제시·요청되지 않은 리팩토링 금지·speckit은 명시 요청 시만 |

→ 상세 본문: [`.specify/memory/constitution.md`](./.specify/memory/constitution.md)

---

*Last updated: 2026-04-18*
*Version: 2.1 — 헌장 외부화 + 폴더 가이드*

## Active Technologies
- Python 3.11 (backend), TypeScript 5 / React 18 (frontend) + FastAPI, SQLAlchemy, pydantic-settings, yfinance, pykrx (backend) · React Router, React Query, Zustand, lightweight-charts, Tailwind (frontend) (022-stock-detail-layered-analysis)
- 기존 SQLite/PostgreSQL — 본 기능은 **신규 테이블 없음**. `/company/{symbol}` 응답은 백엔드 in-memory 1h TTL 캐시 재사용. 프론트는 React Query 캐시(staleTime 1h) 사용. (022-stock-detail-layered-analysis)
- Python 3.11 (backend), TypeScript 5 / React 18 (frontend) + FastAPI, yfinance, httpx(이미 설치), BeautifulSoup(bs4, 이미 설치) (backend) · React Query, Zustand (frontend, 022에서 도입) (023-kr-naver-fundamentals)
- 신규 테이블 없음. 네이버 보강 결과는 **in-memory dict 캐시**(24h TTL) + 기존 company in-memory 캐시 재사용. (023-kr-naver-fundamentals)
- DB 신규 테이블 없음. 서버 in-memory 캐시 60초 TTL + 프론트 React Query staleTime 5분 (024-trend-trading-signals)

## Recent Changes
- 022-stock-detail-layered-analysis: Added Python 3.11 (backend), TypeScript 5 / React 18 (frontend) + FastAPI, SQLAlchemy, pydantic-settings, yfinance, pykrx (backend) · React Router, React Query, Zustand, lightweight-charts, Tailwind (frontend)
