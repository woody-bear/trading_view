# UBB Pro Signal System — 개발 스택 명세

## 스택 선정 원칙

```
1. Python 단일 언어 우선 — 지표 엔진(pandas/numpy)이 핵심이므로 백엔드 전체를 Python으로 통일
2. 로컬 1인 사용 — 대규모 인프라 불필요, 경량 + 간편 실행
3. 의존성 최소화 — 학습 비용 낮은 성숙한 라이브러리 선택
4. Docker 없이 venv로 실행 — 저장공간 절약, 셸 스크립트 한 번으로 기동
5. n8n 제거 — Docker 의존성 제거, 웹훅 수신을 FastAPI가 직접 처리
```

---

## 실행 환경

```
실행 방식: Python venv 가상환경 + Node.js 로컬 설치
Docker 사용 안 함 — 저장공간 부담 제거

필수 사전 설치:
  - Python 3.11+ (권장 3.12)
  - Node.js 20 LTS
  - pnpm (npm install -g pnpm)
  - uv (curl -LsSf https://astral.sh/uv/install.sh | sh)
```

---

## 백엔드

| 구분 | 선택 | 이유 |
|------|------|------|
| **프레임워크** | FastAPI | async 지원, WebSocket 내장, 자동 API 문서(Swagger), 웹훅 수신도 직접 처리 |
| **ASGI 서버** | Uvicorn | FastAPI 표준 조합, 경량 + 고성능 |
| **스케줄러** | APScheduler | FastAPI 프로세스 내 임베디드, cron식 스케줄 + 동적 job 추가/삭제 |
| **ORM** | SQLAlchemy 2.0 | async 지원, 타입 힌트, Alembic 마이그레이션 연동 |
| **마이그레이션** | Alembic | 스키마 변경 이력 관리, SQLAlchemy 자동 감지 |
| **설정 관리** | Pydantic Settings | .env 자동 로드, 타입 검증, FastAPI와 자연스러운 통합 |
| **로깅** | Loguru | 설정 없이 바로 사용, 파일 로테이션 내장 |

### Python 버전

```
Python 3.11+ (권장 3.12)
  - 3.11: 성능 25% 향상, 에러 메시지 개선
  - 3.12: 타입 힌트 강화 (type 문), f-string 중첩
```

---

## 데이터 수집 / 지표 계산

| 구분 | 선택 | 이유 |
|------|------|------|
| **한국 주식 (1차)** | yfinance | 설치 간편, KRX 지원 ("005930.KS") |
| **한국 주식 (fallback)** | pykrx → FinanceDataReader | yfinance 장애 대비, 한국 거래소 직접 조회 |
| **미국 주식** | yfinance | 실시간 데이터, 티커 기반 |
| **암호화폐 (1차)** | ccxt | 100+ 거래소 통합, Binance/Upbit 지원 |
| **암호화폐 (fallback)** | yfinance | BTC-USD 등 주요 코인 |
| **지표 계산** | pandas-ta | pandas DataFrame 직접 연산, 볼린저/RSI/MACD/EMA/KC 모두 내장 |
| **수치 연산** | pandas + numpy | 금융 데이터 처리 표준 |
| **서머타임 판별** | pytz / zoneinfo | US/Eastern 오프셋 자동 감지 |

### 패키지 조합 근거

```
pandas-ta vs ta-lib:
  - ta-lib: C 바인딩으로 빠르지만 설치 복잡 (brew install ta-lib 필요)
  - pandas-ta: 순수 Python, pip install만으로 완료, 지표 130+ 내장
  - 10분 간격 스캔에서 속도 차이 무의미 → pandas-ta 선택

ccxt vs python-binance:
  - python-binance: Binance 전용
  - ccxt: Binance + Upbit + 100개 거래소 통합 → 확장성 우위
```

---

## 프론트엔드

| 구분 | 선택 | 이유 |
|------|------|------|
| **프레임워크** | React 18 + Vite | 빠른 HMR, 경량 번들, 생태계 성숙 |
| **언어** | TypeScript | 컴포넌트 props 타입 안정성, API 응답 타입 정의 |
| **UI 컴포넌트** | Shadcn/ui + Tailwind CSS | 커스텀 자유도 높음, 복사 방식(의존성 아님), 다크모드 내장 |
| **상태 관리** | Zustand | 경량 (1.1KB), 보일러플레이트 없음, WebSocket 상태 관리에 적합 |
| **차트 위젯** | TradingView Lightweight Charts | 공식 오픈소스, 캔들차트 + 지표 오버레이 |
| **HTTP 클라이언트** | Axios + React Query (TanStack Query) | 캐싱, 자동 재요청, 로딩/에러 상태 관리 |
| **WebSocket** | 네이티브 WebSocket + 커스텀 훅 | 외부 라이브러리 불필요, reconnect 로직만 구현 |
| **라우팅** | React Router v6 | SPA 표준 라우터 |
| **아이콘** | Lucide React | Shadcn/ui 기본 아이콘셋, 트리쉐이킹 |

### Next.js를 선택하지 않는 이유

```
- SSR/SSG 불필요 (로컬 대시보드, SEO 무관)
- 파일 기반 라우팅은 이 규모에서 오버엔지니어링
- API Routes 불필요 (FastAPI가 백엔드 전담)
- Vite + React가 더 가볍고 빌드 빠름
```

### 프론트엔드 배포 방식

```
개발: pnpm dev → localhost:3000 (Vite dev server, HMR)
운영: pnpm build → dist/ 정적 파일 생성 → FastAPI에서 정적 파일 서빙
  - FastAPI의 StaticFiles 마운트로 별도 웹서버 불필요
  - 단일 포트(8000)에서 API + 프론트엔드 모두 서빙
```

---

## 데이터베이스

| 구분 | 선택 | 이유 |
|------|------|------|
| **메인 DB** | SQLite | 로컬 1인 사용, 설치 불필요, 파일 1개로 백업 간편 |
| **비동기 드라이버** | aiosqlite | FastAPI async 호환, SQLAlchemy async 세션 |
| **마이그레이션** | Alembic | 스키마 버전 관리 |

### SQLite 선택 근거

```
PostgreSQL/MySQL vs SQLite:
  - 동시 사용자 1명, 10분 간격 쓰기 → SQLite WAL 모드로 충분
  - 별도 DB 서버 프로세스 불필요
  - DB 파일 복사만으로 백업 완료
  - 향후 PostgreSQL 전환 필요 시 SQLAlchemy 레이어에서 드라이버만 교체

DB 파일 위치: backend/data/ubb_pro.db
  - 프로젝트 디렉토리 내부에서 관리 (외부 의존 없음)
  - .gitignore에 data/*.db 추가 (DB 파일은 커밋하지 않음)
  - 백업: cp backend/data/ubb_pro.db backend/data/ubb_pro_backup_$(date +%Y%m%d).db
```

---

## 텔레그램 봇

| 구분 | 선택 | 이유 |
|------|------|------|
| **라이브러리** | python-telegram-bot (v20+) | async 지원, 공식 Telegram Bot API 래퍼, 타입 힌트 완비 |
| **대안** | aiogram | 더 경량이지만 커뮤니티 작음 → python-telegram-bot이 안정적 |

```
사용 방식:
  - 알림 발송 전용 (단방향)
  - 향후 확장: 봇 명령어로 워치리스트 조회/추가 (양방향)
```

---

## TradingView 웹훅 수신 (n8n 대체)

```
n8n 제거 이유:
  - n8n은 Docker 기반 실행이 사실상 필수 (npm 설치 시 800MB+)
  - 웹훅 수신 + 시크릿 검증 + API 전달이 전부 → FastAPI 엔드포인트 1개로 대체 가능
  - 디버깅도 FastAPI Swagger UI + Loguru 로그로 충분

대체 구현:
  - FastAPI에 POST /api/webhook/tradingview 엔드포인트 추가
  - TV_WEBHOOK_SECRET 헤더 검증 미들웨어
  - 수신 내용을 signal_engine으로 전달 → 기존 파이프라인 합류
  - 웹훅 수신 로그를 system_log 테이블에 기록

ngrok/cloudflared (외부 웹훅 수신 시):
  - 로컬 서버를 외부에 노출해야 TradingView Alert 수신 가능
  - ngrok: ngrok http 8000 → 임시 공개 URL 생성 (무료 플랜)
  - cloudflared: cloudflared tunnel → Cloudflare 터널 (무료, 안정적)
  - TradingView Alert URL에 해당 공개 URL 입력
```

---

## 개발 도구

| 구분 | 선택 | 이유 |
|------|------|------|
| **패키지 관리 (Python)** | uv | pip 대비 10~100배 빠름, lock 파일 지원, venv 자동 관리 |
| **패키지 관리 (Node)** | pnpm | npm 대비 빠르고 디스크 절약, 엄격한 의존성 |
| **린터/포매터 (Python)** | Ruff | flake8 + isort + black 통합, Rust 기반 초고속 |
| **타입 체크 (Python)** | mypy (또는 pyright) | Pydantic/SQLAlchemy 타입 검증 |
| **린터/포매터 (TS)** | ESLint + Prettier | React/TS 표준 조합 |
| **Git 훅** | pre-commit | 커밋 전 Ruff + ESLint 자동 실행 |
| **테스트 (Python)** | pytest + pytest-asyncio | async 테스트 지원, fixture 기반 |
| **테스트 (Frontend)** | Vitest | Vite 네이티브, Jest 호환 API |
| **API 테스트** | httpx (TestClient) | FastAPI 공식 테스트 클라이언트 |

---

## 실행 방법

### 초기 설치 (1회)

```bash
# 프로젝트 루트에서
cd ubb-pro-signal

# 백엔드 venv 생성 + 의존성 설치
cd backend
uv venv                              # .venv 생성
source .venv/bin/activate            # 가상환경 활성화
uv pip install -r requirements.txt   # 의존성 설치
mkdir -p data                        # SQLite DB 디렉토리 생성

# DB 초기화 (Alembic 마이그레이션)
alembic upgrade head                 # 테이블 자동 생성 → data/ubb_pro.db

# 프론트엔드 의존성 설치
cd ../frontend
pnpm install

# 환경변수 설정
cd ..
cp .env.example .env
# .env 파일 편집: 텔레그램 토큰, 웹훅 시크릿 등 입력
```

### 개발 모드 (백엔드 + 프론트엔드 각각)

```bash
# 터미널 1: 백엔드
cd backend
source .venv/bin/activate
uvicorn app:app --reload --port 8000

# 터미널 2: 프론트엔드 (개발 중에만)
cd frontend
pnpm dev    # → localhost:3000 (Vite dev server)
```

### 운영 모드 (단일 프로세스)

```bash
# 프론트엔드 빌드 → FastAPI에서 서빙
cd frontend && pnpm build            # dist/ 생성
cd ../backend
source .venv/bin/activate
uvicorn app:app --host 0.0.0.0 --port 8000
# → localhost:8000 에서 API + 대시보드 모두 접근
```

### 원클릭 실행 스크립트 (start.sh)

```bash
#!/bin/bash
# ubb-pro-signal/start.sh

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 프론트엔드 빌드 (변경 있을 때만)
if [ "$1" = "--build" ] || [ ! -d "$PROJECT_DIR/frontend/dist" ]; then
  echo "📦 프론트엔드 빌드 중..."
  cd "$PROJECT_DIR/frontend" && pnpm build
fi

# 백엔드 실행
cd "$PROJECT_DIR/backend"
source .venv/bin/activate
echo "🚀 UBB Pro Signal System 시작 → http://localhost:8000"
uvicorn app:app --host 0.0.0.0 --port 8000
```

### 외부 웹훅 수신 (TradingView Alert 사용 시)

```bash
# 터미널 3: ngrok 터널 (선택)
ngrok http 8000
# → https://xxxx.ngrok.io 를 TradingView Alert URL에 입력

# 또는 cloudflared
cloudflared tunnel --url http://localhost:8000
```

### 프로세스 관리 (백그라운드 실행)

```bash
# macOS: launchd로 자동 시작 (선택)
# 또는 간단하게 nohup:
cd backend && source .venv/bin/activate
nohup uvicorn app:app --host 0.0.0.0 --port 8000 > ../logs/server.log 2>&1 &

# 종료
kill $(lsof -t -i:8000)
```

---

## requirements.txt (핵심 의존성)

```txt
# 프레임워크
fastapi>=0.110
uvicorn[standard]>=0.27
websockets>=12.0

# DB
sqlalchemy[asyncio]>=2.0
aiosqlite>=0.19
alembic>=1.13

# 설정
pydantic-settings>=2.1

# 데이터 수집
yfinance>=0.2.36
ccxt>=4.2
pykrx>=1.0.45
finance-datareader>=0.9.66

# 지표 계산
pandas>=2.2
numpy>=1.26
pandas-ta>=0.3.14b1

# 스케줄러
apscheduler>=3.10

# 텔레그램
python-telegram-bot>=20.7

# 서머타임
pytz>=2024.1

# HTTP
httpx>=0.27

# 로깅
loguru>=0.7

# 개발
pytest>=8.0
pytest-asyncio>=0.23
ruff>=0.3
pre-commit>=3.6
```

---

## package.json 핵심 의존성 (프론트엔드)

```json
{
  "dependencies": {
    "react": "^18.3",
    "react-dom": "^18.3",
    "react-router-dom": "^6.22",
    "@tanstack/react-query": "^5.24",
    "axios": "^1.6",
    "zustand": "^4.5",
    "lightweight-charts": "^4.1",
    "lucide-react": "^0.344",
    "tailwindcss": "^3.4",
    "class-variance-authority": "^0.7",
    "clsx": "^2.1",
    "tailwind-merge": "^2.2"
  },
  "devDependencies": {
    "typescript": "^5.4",
    "vite": "^5.1",
    "@vitejs/plugin-react": "^4.2",
    "vitest": "^1.3",
    "eslint": "^8.57",
    "prettier": "^3.2"
  }
}
```

---

## 스택 전체 요약

```
┌─────────────────────────────────────────────────────┐
│                    프론트엔드                         │
│  React 18 + TypeScript + Vite                       │
│  Shadcn/ui + Tailwind CSS                           │
│  Zustand + TanStack Query                           │
│  TradingView Lightweight Charts                     │
│  운영 시: FastAPI StaticFiles로 서빙 (단일 포트)      │
├─────────────────────────────────────────────────────┤
│                    백엔드                             │
│  FastAPI + Uvicorn (Python 3.12, venv)              │
│  SQLAlchemy 2.0 + aiosqlite (SQLite)                │
│  APScheduler (크론 스케줄링)                          │
│  pandas-ta (지표 계산)                               │
│  yfinance + ccxt + pykrx (데이터 수집)               │
│  python-telegram-bot (알림 발송)                     │
│  TradingView 웹훅 직접 수신 (n8n 대체)               │
├─────────────────────────────────────────────────────┤
│                    인프라                             │
│  Python venv + Node.js 로컬 (Docker 없음)            │
│  SQLite WAL (DB) + Loguru (로깅)                     │
│  ngrok/cloudflared (외부 웹훅 수신 시, 선택)          │
│  start.sh 원클릭 실행                                │
├─────────────────────────────────────────────────────┤
│                    개발 도구                          │
│  uv (Python) + pnpm (Node)                          │
│  Ruff + mypy + ESLint + Prettier                    │
│  pytest + Vitest + pre-commit                       │
└─────────────────────────────────────────────────────┘
```
