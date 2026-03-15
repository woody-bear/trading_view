# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UBB Pro Signal System — TradingView 기술적 지표 기반 한국/미국/비트코인 종목 실시간 모니터링 + 텔레그램 자동 알림 로컬 시스템. 모든 기능이 단일 Python FastAPI 프로세스에서 동작한다 (Docker 없음, n8n 없음).

## Architecture

단일 서버 구조: FastAPI 백엔드가 스케줄링, 데이터 수집, 지표 계산, 신호 판정, 텔레그램 발송, 웹훅 수신, 대시보드 서빙을 모두 처리한다.

- **백엔드**: `backend/` — FastAPI + Uvicorn (Python 3.12, venv)
- **프론트엔드**: `frontend/` — React 18 + TypeScript + Vite + Shadcn/ui + Tailwind CSS
- **DB**: SQLite (WAL 모드), `backend/data/ubb_pro.db` — SQLAlchemy 2.0 async + aiosqlite
- **스케줄러**: APScheduler (FastAPI 프로세스 내 임베디드, 10분 간격 크론)
- **지표 엔진**: `backend/indicators/signal_engine.py` — BB, RSI, MACD, EMA, 거래량을 종합하여 BUY/SELL/NEUTRAL + confidence(0~100) 판정
- **데이터 수집**: `backend/data/` fetchers — yfinance → pykrx → FDR (한국), yfinance (미국), ccxt → yfinance (암호화폐) fallback 체인
- **웹훅**: `POST /api/webhook/tradingview` — FastAPI가 직접 수신 (ngrok/cloudflared로 외부 노출)

핵심 데이터 흐름: APScheduler 크론 → fetcher로 시세 수집 → indicators로 지표 계산 → signal_engine에서 신호 판정 → current_signal 테이블 업데이트 → 상태 전환 시 텔레그램 발송 + WebSocket 푸시

## Setup & Run Commands

```bash
# 초기 설치
cd backend && uv venv && source .venv/bin/activate
uv pip install -r requirements.txt && mkdir -p data
alembic upgrade head
cd ../frontend && pnpm install
cp .env.example .env  # 텔레그램 토큰 등 입력

# 개발 모드
cd backend && source .venv/bin/activate && uvicorn app:app --reload --port 8000
cd frontend && pnpm dev  # 별도 터미널, localhost:3000

# 운영 모드 (단일 포트)
cd frontend && pnpm build
cd ../backend && source .venv/bin/activate && uvicorn app:app --host 0.0.0.0 --port 8000

# 원클릭
./scripts/start.sh         # 운영 실행
./scripts/start.sh --build # 프론트 재빌드 포함
```

## Lint & Test

```bash
# Python
cd backend && source .venv/bin/activate
ruff check . && ruff format .   # 린트 + 포맷
mypy .                          # 타입 체크
pytest                          # 전체 테스트
pytest tests/test_signal.py -k "test_buy"  # 단일 테스트

# Frontend
cd frontend
pnpm lint        # ESLint
pnpm format      # Prettier
pnpm test        # Vitest
pnpm test -- --run tests/SignalCard.test.tsx  # 단일 테스트
```

## Key Design Decisions

- **Docker 사용 안 함** — 저장공간 절약, venv + 로컬 Node.js로 실행
- **n8n 제거** — 웹훅 수신을 FastAPI가 직접 처리 (엔드포인트 1개로 충분)
- **pandas-ta** (not ta-lib) — 순수 Python, C 바인딩 설치 불필요
- **SQLite** (not PostgreSQL) — 1인 로컬 시스템, 별도 DB 서버 불필요, `backend/data/` 내부에서 관리
- **운영 시 단일 포트(8000)** — FastAPI StaticFiles로 프론트엔드 정적 파일 서빙
- **current_signal 테이블** — 대시보드용 빠른 조회 캐시, signal_history와 분리

## Signal Logic

신호 상태: BUY / SELL / NEUTRAL. 필수 조건 4개(BB, RSI<30/>70, MACD 전환, 거래량>1.2x) 모두 충족 시 신호 발생. confidence 점수(0~100)로 STRONG(90+)/NORMAL(70+)/WEAK(60+) 등급 분류. NEUTRAL 복귀는 RSI 50 + BB 중간선 또는 MACD 역전환.

## Environment Variables

`.env` 파일은 프로젝트 루트. 필수: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. 선택: `TV_WEBHOOK_SECRET`, `BINANCE_API_KEY/SECRET`. DB: `DATABASE_URL=sqlite:///./data/ubb_pro.db`.

## Plan Documents

- `UBB_Pro_Signal_System_Plan.md` — 전체 시스템 설계, 신호 로직, DB 스키마, 구현 우선순위
- `UBB_Pro_Tech_Stack.md` — 기술 스택 선정 근거, 의존성 목록, 실행 방법 상세
