# UBB Pro Signal System

TradingView 기술적 지표 기반 한국/미국/암호화폐 종목 실시간 모니터링 + 텔레그램 자동 알림 시스템.

> **Live**: https://www.asst.kr

## Architecture

```
[Browser] ──HTTP/WS──→ [FastAPI :8000] ──→ [SQLite WAL]
                            │
                    ┌───────┼───────┐
                    │       │       │
              [Scheduler] [KIS WS] [SSE Stream]
              10분 스캔    실시간    1초 가격
                    │       │       │
              ┌─────┴───┐   │   ┌───┴────┐
              │yfinance  │   │   │한투 REST│
              │pykrx     │   │   │        │
              │ccxt      │   │   │        │
              └──────────┘   │   └────────┘
                    │        │
              [Telegram Bot] │
              BUY/SELL 알림  │
                             │
                    [한국투자증권 WebSocket]
                    실시간 체결가 (40종목)
```

| 계층 | 기술 |
|------|------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS + lightweight-charts v5 |
| **Backend** | Python 3.12 + FastAPI + Uvicorn + SQLAlchemy 2.0 async |
| **Database** | SQLite (WAL mode) — `backend/data/ubb_pro.db` |
| **Scheduler** | APScheduler (embedded, 10분 크론) |
| **Realtime** | 한국투자증권 Open API (WebSocket + REST), SSE |
| **Alert** | Telegram Bot API |
| **Infra** | Cloudflare Tunnel (`cloudflared`) — Mac Mini 로컬 서버 |

## Features

### Home (/)
- 관심종목 실시간 모니터링 (WebSocket + 한투 API)
- 종목 검색 (한국 3,590개 + 미국 113개 + 암호화폐 30개)
- 전체 시장 스캔 — 추천 종목 / MAX SQ 폭발 임박 / 차트 BUY 신호 (PC)
- 10초 간격 배치 가격 갱신 + 가격 변동 깜빡임 효과

### Signal Detail (/:symbol)
- UBB Pro 차트 (볼린저밴드 + 스퀴즈 도트 + BUY/SELL 마커)
- 1초 실시간 가격 (SSE) + 차트 마지막 캔들 실시간 갱신
- 6개 지표 게이지 (RSI, %B, BBW, MACD, Volume, Squeeze)
- 매수 조건 체크리스트 (4개 조건, 민감도 조절)
- 연간/분기 실적 차트 (매출, 순이익)
- 관심종목/미등록 종목 동일 화면

### Scan (/scan) — Mobile
- 전체 시장 스캔 (코스피 54 + 코스닥 30 + 미국 65 + 코인 10 = 159종목)
- 추천 종목 (MID/MAX SQ + 상승추세, 시장별 Top 3)
- MAX SQ 폭발 임박 (시장별 Top 5)
- 차트 BUY 신호 (일봉 3일 이내, 한국 2 + 미국 2)

### Forex (/forex)
- 적정환율 분석 (4개 게이지 + 매수 판정)
- 환율추이 차트 (USDKRW + DXY + 복합)

### Settings (/settings)
- 신호 민감도 (엄격/보통/민감)
- 차트 봉 단위 (15m ~ 1w)
- 텔레그램 알림 설정
- 한국투자증권 API 설정

## Quick Start

```bash
# Backend
cd backend
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
mkdir -p data && alembic upgrade head

# Frontend
cd ../frontend && pnpm install && pnpm build

# Environment
cp .env.example .env  # Edit with your keys

# Run (production - single port)
cd ../backend && uvicorn app:app --host 0.0.0.0 --port 8000

# Run (development - two terminals)
cd backend && uvicorn app:app --reload --port 8000
cd frontend && pnpm dev  # localhost:3000 → proxy to :8000
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram bot token for alerts |
| `TELEGRAM_CHAT_ID` | Optional | Telegram chat ID |
| `KIS_APP_KEY` | Optional | Korea Investment Securities API key |
| `KIS_APP_SECRET` | Optional | Korea Investment Securities API secret |
| `KIS_ACCOUNT_NO` | Optional | Account number (00000000-01) |
| `KIS_PAPER_TRADING` | Optional | `true`=paper, `false`=live (default: false) |
| `DATABASE_URL` | Auto | SQLite path (default: `sqlite+aiosqlite:///./data/ubb_pro.db`) |

## Signal Logic

| Condition | Strict (4/4) | Normal (3/4) | Sensitive (2/4) |
|-----------|-------------|-------------|----------------|
| BB %B | <= 0.05 | <= 0.15 | <= 0.25 |
| RSI | < 30 | < 35 | < 40 |
| MACD Histogram | Rising | Rising | Rising |
| Volume Ratio | > 1.2x | > 1.1x | > 1.0x |

## Project Structure

```
backend/
  app.py                  # FastAPI app + lifespan
  config.py               # Pydantic settings (.env)
  models.py               # SQLAlchemy models (9 tables)
  database.py             # Async session factory
  scheduler.py            # APScheduler (10min cron)
  routes/                 # API endpoints
    signals.py            #   /api/signals
    watchlist.py          #   /api/watchlist
    charts.py             #   /api/signals/{id}/chart
    quick_chart.py        #   /api/chart/quick (cached)
    prices.py             #   /api/prices/batch, /stream/{symbol}
    financials.py         #   /api/financials/{symbol}
    search.py             #   /api/search
    market_scan.py        #   /api/scan/market
    settings.py           #   /api/settings/*
    forex.py              #   /api/forex/*
    websocket.py          #   /ws
    webhook.py            #   /api/webhook/tradingview
    system.py             #   /api/system/*
  services/
    scanner.py            # Signal scan orchestration
    unified_scanner.py    # Batch market scan (159 stocks)
    chart_cache.py        # SQLite chart data cache
    stock_master.py       # KIS master file download (3,700+ stocks)
    price_feed.py         # Background price feed (5s)
    kis_client.py         # Korea Investment Securities REST
    kis_websocket.py      # Korea Investment Securities WebSocket
    telegram_bot.py       # Telegram alert sender
    forex_analyzer.py     # USD/KRW fair value analysis
  indicators/
    signal_engine.py      # BUY/SELL/NEUTRAL judgment
    bollinger.py          # Bollinger Bands + squeeze detection
    rsi.py                # RSI (14)
    macd.py               # MACD (12, 26, 9)
    ema.py                # EMA (20, 50, 200)
    volume.py             # Volume ratio
  fetchers/
    base.py               # Base fetcher with fallback chain
    kr_fetcher.py         # Korean stocks (pykrx → yfinance)
    us_fetcher.py         # US stocks (yfinance)
    crypto_fetcher.py     # Crypto (ccxt → yfinance)

frontend/src/
  App.tsx                 # Router + layout (PC header / mobile bottom nav)
  main.tsx                # Entry point
  api/client.ts           # Axios API client (30+ endpoints)
  pages/
    Dashboard.tsx          # Home (watchlist + market scan)
    Scan.tsx               # Market scan (mobile tab)
    SignalDetail.tsx        # Stock detail (unified view)
    TopPicks.tsx            # Squeeze picks
    Forex.tsx               # Forex analysis
    Settings.tsx            # Settings
  components/
    SignalCard.tsx           # Watchlist stock card
    BottomNav.tsx            # Mobile bottom tab bar
    charts/
      IndicatorChart.tsx     # TradingView lightweight-charts
      FinancialChart.tsx     # Revenue/income bar chart
      SqueezeGuide.tsx       # Squeeze 4-level guide
      SignalGuide.tsx        # BUY/SELL signal guide
      UBBPanel.tsx           # Current indicator panel
  hooks/
    useWebSocket.ts          # WS connection + signal store sync
    useRealtimePrice.ts      # SSE 1-second price stream
    usePriceFlash.ts         # Price change flash animation
  stores/
    signalStore.ts           # Zustand signal state
```

## Operations

### Cloudflare Tunnel

```bash
# Service management (launchd)
launchctl start com.ubb-pro.backend
launchctl stop com.ubb-pro.backend
launchctl start com.cloudflare.cloudflared

# Logs
tail -f ~/Library/Logs/ubb-pro-backend.err.log

# Frontend rebuild + restart
cd frontend && pnpm build
launchctl stop com.ubb-pro.backend && launchctl start com.ubb-pro.backend
```

## License

Private — All rights reserved.
