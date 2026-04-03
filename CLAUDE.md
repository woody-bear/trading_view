# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**UBB Pro Signal System** — 기술적 지표 기반 한국/미국/암호화폐 종목 실시간 모니터링 + 텔레그램 자동 알림 시스템. 단일 FastAPI 프로세스에서 모든 기능이 동작한다 (Docker 없음).

## Architecture

단일 서버 구조: FastAPI가 스케줄링, 데이터 수집, 지표 계산, 신호 판정, 텔레그램 발송, 웹훅 수신, 대시보드 서빙을 모두 처리.

- **Backend**: `backend/` — Python 3.12 + FastAPI + Uvicorn
- **Frontend**: `frontend/` — React 18 + TypeScript + Vite + Tailwind CSS
- **DB**: SQLite WAL — `backend/data/ubb_pro.db` (SQLAlchemy 2.0 async + aiosqlite)
- **Scheduler**: APScheduler (10분 크론, 임베디드)
- **Realtime**: 한국투자증권 WebSocket (40종목) + SSE (상세화면 1초) + WebSocket (브라우저)
- **Chart**: lightweight-charts v5 (TradingView)

### Data Flow

```
APScheduler 10분 → fetcher(yfinance/pykrx/ccxt) → indicators → signal_engine
  → current_signal DB 업데이트 → 상태 전환 시 텔레그램 + WebSocket 브로드캐스트

한투 WebSocket → 실시간 체결가 → 메모리 캐시 → price_feed 5초 → DB + WebSocket

SSE /api/prices/stream/{symbol} → 한투 REST 1초 → 브라우저 직접 수신

차트 데이터: chart_cache(SQLite) → 캐시 HIT 시 즉시 반환 / MISS 시 yfinance 다운로드 → 캐시 저장
```

## Setup & Run

```bash
# Initial setup
cd backend && uv venv && source .venv/bin/activate
uv pip install -r requirements.txt && mkdir -p data
alembic upgrade head
cd ../frontend && pnpm install
cp .env.example .env  # Set TELEGRAM_BOT_TOKEN, KIS_APP_KEY, etc.

# Development (two terminals)
cd backend && source .venv/bin/activate && uvicorn app:app --reload --port 8000
cd frontend && pnpm dev  # localhost:3000, proxy → :8000

# Production (single port)
cd frontend && pnpm build
cd ../backend && uvicorn app:app --host 0.0.0.0 --port 8000
```

## Lint & Test

```bash
# Python
cd backend && source .venv/bin/activate
ruff check . && ruff format .
pytest

# Frontend
cd frontend
pnpm lint && pnpm format
pnpm test
```

## Key Design Decisions

- **Docker 미사용** — 로컬 실행, venv + Node.js
- **SQLite** — 1인 시스템, 별도 DB 서버 불필요
- **pandas-ta** (not ta-lib) — 순수 Python, C 바인딩 불필요
- **단일 포트 8000** — FastAPI StaticFiles로 React SPA 서빙
- **chart_cache 테이블** — yfinance 반복 다운로드 방지, 재조회 시 <1초
- **stock_master 테이블** — 한투 종목 마스터 파일에서 3,700+ 종목 검색
- **current_signal 테이블** — 대시보드 빠른 조회 캐시

## DB Tables (9개)

| Table | Purpose |
|-------|---------|
| `watchlist` | 관심종목 목록 |
| `current_signal` | 최신 신호 캐시 (1:1 with watchlist) |
| `signal_history` | 신호 전환 이력 |
| `alert_log` | 텔레그램 발송 기록 |
| `ohlcv_cache` | 관심종목 OHLCV 캐시 (스캐너용) |
| `chart_cache` | 전종목 차트 캔들 캐시 (symbol 기반) |
| `stock_master` | 종목 마스터 (한투 FTP, 3,700+) |
| `daily_top_pick` | 일일 스캔 추천 종목 |
| `system_log` | 시스템 로그 |

## Signal Logic

BUY/SELL/NEUTRAL. 조건: BB %B, RSI, MACD 전환, 거래량. 민감도 3단계(strict/normal/sensitive). Confidence 0~100 → STRONG(90+)/NORMAL(70+)/WEAK(60+).

## Environment Variables

`.env` at project root. Required: none (all optional with graceful degradation).
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — alerts
- `KIS_APP_KEY`, `KIS_APP_SECRET`, `KIS_ACCOUNT_NO` — realtime KR prices
- `DATABASE_URL` — SQLite path (auto-default)

## Frontend Routing

| Path | Page | Description |
|------|------|-------------|
| `/` | Dashboard | 관심종목 + 시장 스캔(PC) |
| `/scan` | Scan | 시장 스캔 (모바일 탭) |
| `/:symbol` | SignalDetail | 종목 상세 (통합 뷰) |
| `/picks` | TopPicks | 스퀴즈 추천 |
| `/forex` | Forex | 환율 분석 |
| `/settings` | Settings | 설정 |

## Mobile vs PC

- PC: 상단 헤더 네비게이션 + footer
- Mobile: 하단 탭바 (5탭: 홈/스캔/환율/추천/설정) + 헤더 없음
- 반응형 breakpoint: `md` (768px)
- 카드 텍스트: 모바일 13px / PC 9~10px

## API Endpoints (주요)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/signals` | 관심종목 신호 목록 |
| `GET /api/chart/quick?symbol=&market=` | 차트 데이터 (캐시 우선) |
| `GET /api/prices/stream/{symbol}` | SSE 실시간 가격 (1초) |
| `POST /api/prices/batch` | 배치 가격 조회 |
| `GET /api/financials/{symbol}` | 연간/분기 실적 |
| `POST /api/scan/unified` | 전체 시장 스캔 |
| `GET /api/search?q=` | 종목 검색 (stock_master DB) |
| `/ws` | WebSocket 실시간 브로드캐스트 |

## Documentation

- `.claude/docs/ERD.md` — 데이터베이스 ERD
- `.claude/docs/기능명세서_홈화면.md` — 홈화면 기능명세
- `.claude/docs/기능명세서_추천.md` — 추천 탭 기능명세
- `.claude/docs/기능명세서_환율.md` — 환율 탭 기능명세
- `.claude/docs/기능명세서_설정.md` — 설정 탭 기능명세

## Active Technologies
- TypeScript 5.x (React 18) + Python 3.12 (변경 없음) + React 18, lightweight-charts v5, Zustand, React Query, Tailwind CSS (002-fix-chart-usability)
- N/A (프론트엔드 상태만 변경, DB 스키마 변경 없음) (002-fix-chart-usability)
- TypeScript 5.x (React 18) + Python 3.12 + React 18, lightweight-charts v5, Zustand, React Query, Tailwind CSS / FastAPI, pandas, yfinance (002-fix-chart-usability)
- SQLite chart_cache (스키마 변경 없음, 로직만 변경) + localStorage (매수지점) (002-fix-chart-usability)
- Python 3.12 + TypeScript 5.x (React 18) + APScheduler (기존), telegram Bot API (기존), SQLAlchemy (기존) (003-kr-buy-telegram-alert)
- SQLite — alert_log 테이블 확장 (alert_type, symbol_count 컬럼 추가) (003-kr-buy-telegram-alert)
- Python 3.12 + TypeScript 5.x (React 18) + yfinance (기존), pandas (기존), lightweight-charts (기존) (005-market-sentiment-dashboard)
- 없음 (실시간 조회, DB 변경 없음) (005-market-sentiment-dashboard)
- Python 3.12 (backend) + TypeScript 5.x (frontend) + FastAPI, pykis (한투 API), React 18, Tailwind CSS (006-kis-stock-detail)
- SQLite WAL (aiosqlite) — 투자지표 캐시용 메모리 캐시 (dict + TTL) (006-kis-stock-detail)
- TypeScript 5.x (React 18) — 프론트엔드 전용 + React 18, Tailwind CSS (007-position-guide)
- N/A (DB 변경 없음, 상태 저장 없음) (007-position-guide)
- Python 3.12 (backend) + TypeScript 5.x / React 18 (frontend) + FastAPI, SQLAlchemy 2.0 async, asyncpg, PyJWT, @supabase/supabase-js v2, Zustand, Tailwind CSS (008-google-auth-personalization)
- Supabase PostgreSQL (이미 전환 완료) (008-google-auth-personalization)
- Python 3.12 (backend) / TypeScript 5.x React 18 (frontend) + FastAPI, SQLAlchemy 2.0 async (backend) / React Query, Tailwind CSS (frontend) (009-buy-scan-watchlist)
- SQLite WAL — stock_master 테이블 읽기 전용 + ScanSnapshot 기존 읽기 (009-buy-scan-watchlist)
<<<<<<< HEAD
- TypeScript 5.x (React 18) + Python 3.12 + React 18, Tailwind CSS v4, Zustand, React Query / FastAPI, SQLAlchemy 2.0 async (011-stock-card-redesign)
- SQLite WAL — stock_master 테이블 읽기 전용 (market_type 조회), 스키마 변경 없음 (011-stock-card-redesign)
=======
- Python 3.12 (backend) + TypeScript 5.x / React 18 (frontend) + FastAPI, SQLAlchemy 2.0 async, Alembic / React 18, lightweight-charts v5, React Query, Tailwind CSS, Zustand (010-chart-buy-scrap)
- SQLite WAL (aiosqlite) — `pattern_case` 테이블 컬럼 2개 추가 (source, user_id) (010-chart-buy-scrap)
>>>>>>> main
- Python 3.12 (backend) + TypeScript 5.x / React 18 (frontend) + FastAPI, SQLAlchemy 2.0 async, yfinance (backend) / React 18, lightweight-charts v5, React Query, Tailwind CSS (frontend) (012-crisis-indicator-history)
- SQLite WAL — `backend/data/ubb_pro.db` (4개 신규 테이블 추가, 기존 스키마 변경 없음) (012-crisis-indicator-history)

## Recent Changes
- 002-fix-chart-usability: Added TypeScript 5.x (React 18) + Python 3.12 (변경 없음) + React 18, lightweight-charts v5, Zustand, React Query, Tailwind CSS
