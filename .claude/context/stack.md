---
purpose: 이 프로젝트의 언어·프레임워크·디렉터리 구조·실행 명령 개요.
reader: Claude가 신규 작업을 시작하기 전 프로젝트 전반 구조를 파악할 때.
update-trigger: 주요 의존성 버전 업그레이드; 디렉터리 구조 변경; 실행 명령 변경.
last-audit: 2026-04-18
---

# UBB Pro — 기술 스택 & 프로젝트 구조

> 최종 업데이트: 2026-04-12

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | UBB Pro Signal System (추세추종 연구소) |
| 설명 | 주식/암호화폐 기술적 신호 감지 + 텔레그램 알림 서비스 |
| 단계 | 성장 (기능 확장 중) |
| 플랫폼 | macOS 로컬 개발, 프로덕션: asst.kr |

---

## 백엔드 스택

| 항목 | 기술 | 버전 |
|------|------|------|
| 언어 | Python | 3.x |
| 프레임워크 | FastAPI | ≥0.110 |
| DB (로컬) | SQLite + aiosqlite | - |
| DB (프로덕션) | PostgreSQL + asyncpg | Supabase |
| ORM | SQLAlchemy (async, Mapped) | ≥2.0 |
| 마이그레이션 | Alembic | ≥1.13 |
| 설정 | pydantic-settings + .env | ≥2.1 |
| 로깅 | loguru | ≥0.7 |
| 스케줄러 | APScheduler | ≥3.10, <4.0 |
| 인증 | Supabase JWT (ES256) | - |
| HTTP 클라이언트 | httpx | ≥0.27 |
| 린터 | ruff | ≥0.3 |
| 테스트 | pytest + pytest-asyncio | - |

### 외부 데이터 소스

| 소스 | 용도 |
|------|------|
| yfinance | 미국 주식 + 한국주식 OHLCV |
| ccxt | 암호화폐 |
| pykrx | 한국 주식 fallback |
| python-kis | 한국투자증권 API 실시간 시세 |
| finance-datareader | 보조 데이터 소스 |

### 기술 지표

- `pandas-ta-classic` + 자체 구현 (`backend/indicators/`)
- RSI(14), Bollinger Bands(20, ±2σ), EMA(20/50/200), MACD(12/26/9), Volume, Squeeze Pro

---

## 프론트엔드 스택

| 항목 | 기술 | 버전 |
|------|------|------|
| 언어 | TypeScript | ~5.9 |
| 프레임워크 | React | 19 |
| 빌드 도구 | Vite | 8 |
| 스타일 | Tailwind CSS | 4 |
| 상태 (서버) | TanStack React Query | 5 |
| 상태 (클라이언트) | Zustand | 5 |
| 차트 | lightweight-charts | 5 |
| 인증 | @supabase/supabase-js | 2 |
| HTTP | axios | - |
| 라우터 | react-router-dom | 7 |
| 패키지 매니저 | pnpm | - |

---

## 디렉토리 구조

```
trading_view/
├── backend/
│   ├── app.py              # FastAPI 앱 진입점, lifespan 설정
│   ├── config.py           # pydantic-settings Settings 클래스
│   ├── database.py         # SQLAlchemy engine + async_session
│   ├── models.py           # SQLAlchemy ORM 모델 (DeclarativeBase)
│   ├── auth.py             # Supabase JWT 검증 Dependency
│   ├── scheduler.py        # APScheduler 작업 등록
│   ├── routes/             # FastAPI 라우터 (기능별 분리)
│   │   ├── __init__.py     # api_router (prefix=/api) — 18개 라우터 통합
│   │   ├── watchlist.py    # 관심종목 CRUD
│   │   ├── market_scan.py  # 전체 시장 스캔 API
│   │   ├── charts.py       # 차트 + 신호 시뮬레이션
│   │   ├── signals.py      # 신호 조회
│   │   ├── alerts.py       # 알림 이력
│   │   ├── auth.py         # 인증 (Google OAuth 콜백)
│   │   ├── company.py      # 회사 정보
│   │   ├── financials.py   # 재무 데이터
│   │   ├── forex.py        # 환율 분석
│   │   ├── pattern_cases.py # 패턴 케이스 스크랩
│   │   ├── position.py     # 포지션 가이드
│   │   ├── prices.py       # 실시간 가격
│   │   ├── quick_chart.py  # 퀵 차트
│   │   ├── search.py       # 종목 검색
│   │   ├── sentiment.py    # 시장 심리
│   │   ├── settings.py     # 앱 설정
│   │   ├── system.py       # 시스템 상태
│   │   ├── webhook.py      # TradingView 웹훅
│   │   └── websocket.py    # 실시간 WebSocket
│   ├── services/           # 비즈니스 로직 레이어
│   │   ├── full_market_scanner.py  # 핵심: 전체 시장 스캔 + DB 스냅샷
│   │   ├── unified_scanner.py      # 통합 스캔 (인메모리, 새로고침용)
│   │   ├── scanner.py              # 관심종목 신호 스캔
│   │   ├── chart_cache.py          # 차트 OHLCV 캐시 관리
│   │   ├── buy_signal_alert.py     # BUY 텔레그램 알림 발송
│   │   ├── sell_signal_alert.py    # SELL 텔레그램 알림 발송
│   │   ├── telegram_bot.py         # 텔레그램 봇 공통 유틸
│   │   ├── kis_client.py           # 한투 API 클라이언트
│   │   ├── kis_websocket.py        # 한투 실시간 WebSocket
│   │   ├── price_feed.py           # 실시간 가격 피드
│   │   ├── forex_analyzer.py       # 환율 분석 로직
│   │   ├── sentiment_analyzer.py   # 시장 심리 분석
│   │   ├── stock_master.py         # 종목 마스터 DB 관리 (한투 FTP)
│   │   ├── scan_symbols_list.py    # 스캔 대상 종목 리스트 상수
│   │   ├── symbol_validator.py     # 심볼 유효성 검사
│   │   └── price_feed.py           # 실시간 가격 피드
│   ├── indicators/         # 기술 지표 계산 모듈
│   │   ├── signal_engine.py  # 관심종목 신호 엔진 (BUY/SELL 판정)
│   │   ├── rsi.py
│   │   ├── bollinger.py
│   │   ├── ema.py
│   │   ├── macd.py
│   │   └── volume.py
│   ├── fetchers/           # 외부 데이터 수집 (소스별)
│   │   ├── base.py         # 공통 인터페이스
│   │   ├── us_fetcher.py   # yfinance (미국)
│   │   ├── kr_fetcher.py   # yfinance + pykrx (한국)
│   │   └── crypto_fetcher.py  # ccxt (암호화폐)
│   ├── utils/
│   │   └── market_hours.py   # 시장 개장 시간 유틸
│   ├── alembic/            # DB 마이그레이션
│   │   └── versions/       # 마이그레이션 파일들
│   ├── tests/              # pytest 테스트 (초기 단계)
│   ├── data/
│   │   └── ubb_pro.db      # SQLite (로컬 개발용)
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # 앱 진입점, 라우터, QueryClient, AuthProvider
│   │   ├── api/
│   │   │   └── client.ts   # axios 인스턴스 + 모든 API 함수
│   │   ├── pages/          # 페이지 컴포넌트 (9개)
│   │   ├── components/     # 재사용 UI 컴포넌트
│   │   ├── hooks/          # 커스텀 훅
│   │   ├── store/          # Zustand 스토어
│   │   ├── types/          # TypeScript 타입 정의
│   │   ├── utils/          # 공통 유틸리티
│   │   └── lib/
│   │       └── supabase.ts # Supabase 클라이언트 초기화
│   └── package.json
│
├── .claude/               # Claude Code 문서 (현재 파일 위치)
│   ├── context/           # 프로젝트 핵심 (stack.md, db.md)
│   ├── backend/           # 백엔드 레이어별 스펙
│   ├── frontend/          # 프론트엔드 레이어별 스펙
│   ├── domain/            # 트레이딩 도메인 지식
│   ├── rules/             # 비즈니스 규칙 (변경 시 확인 필수)
│   ├── guides/            # 개발 가이드
│   └── plans/             # 작업 계획
│
├── specs/                 # speckit 스펙 문서 (001~021)
├── logs/                  # 애플리케이션 로그 (rotation 10MB, 7일 보관)
└── CLAUDE.md              # 하네스 엔지니어링 규칙 + 문서 경로 가이드
```

---

## 서버 실행

```bash
# 백엔드 (backend/ 디렉토리에서)
source .venv/bin/activate
uvicorn app:app --reload --host 0.0.0.0 --port 8000

# 프론트엔드 (frontend/ 디렉토리에서)
pnpm dev           # 개발 서버 localhost:5173
pnpm build         # 프로덕션 빌드 → dist/ (백엔드 SPA 서빙)

# 통합 스크립트
./scripts/start.sh
```

프로덕션에서는 백엔드가 `frontend/dist/`를 SPA로 직접 서빙한다 (`app.py` 하단 StaticFiles).

---

## 환경 변수 (.env)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DATABASE_URL` | SQLite | 로컬: aiosqlite, 프로덕션: asyncpg |
| `TELEGRAM_BOT_TOKEN` | - | 선택: 미설정 시 알림 비활성화 |
| `TELEGRAM_CHAT_ID` | - | 선택 |
| `KIS_APP_KEY` | - | 선택: 미설정 시 pykrx fallback |
| `KIS_APP_SECRET` | - | 선택 |
| `KIS_ACCOUNT_NO` | - | 선택 |
| `KIS_PAPER_TRADING` | true | 모의투자 여부 |
| `SUPABASE_URL` | - | 필수 (프로덕션) |
| `SUPABASE_ANON_KEY` | - | 필수 |
| `SUPABASE_SERVICE_ROLE_KEY` | - | 필수 |
| `TV_WEBHOOK_SECRET` | - | TradingView 웹훅 검증 |
| `ALERT_COOLDOWN_MINUTES` | 30 | 알림 쿨다운 |

---

## 네이밍 컨벤션

| 대상 | 방식 |
|------|------|
| Python 파일/함수/변수 | snake_case |
| TypeScript 컴포넌트 | PascalCase |
| TypeScript 함수/변수 | camelCase |
| DB 테이블/컬럼 | snake_case |
| API 엔드포인트 | /api/kebab-case |
| 커밋 메시지 | `type: 한국어 설명 (spec번호)` |
