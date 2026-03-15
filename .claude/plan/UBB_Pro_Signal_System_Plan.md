# UBB Pro Signal System — 작업 계획 프롬프트

## 프로젝트 개요

TradingView 기술적 지표를 기반으로 한국/미국/비트코인 종목을 실시간 모니터링하고, 매매 신호 전환 시 텔레그램으로 자동 알림을 보내는 로컬 시스템을 구축한다.

---

## 시스템 아키텍처

```
[TradingView]                    [로컬 서버]                         [텔레그램]
     │                                │                                   │
     │  Pine Script 지표 적용          │                                   │
     │  → 스크리너로 종목 스캔         │                                   │
     │                                │                                   │
     ├──── Webhook (Alert) ──────────▶│  Python 백엔드 (핵심 엔진)        │
     │     (ngrok/cloudflared 경유)    │  ├─ POST /api/webhook/tradingview │
     │                                │  │  └─ 시크릿 검증 + 신호 파이프라인│
     │                                │  ├─ 10분 간격 스케줄러 (APScheduler)│
     │                                │  ├─ 시장별 장중시간 필터           │
     │                                │  │  ├─ KR: 09:00~15:30 KST       │
     │                                │  │  ├─ US: 09:30~16:00 ET        │
     │                                │  │  │   (KST 23:30~06:00 동절기) │
     │                                │  │  │   (KST 22:30~05:00 하절기) │
     │                                │  │  └─ BTC: 24시간               │
     │                                │  ├─ 데이터 수집 (yfinance/ccxt)   │
     │                                │  │  └─ fallback: pykrx, FDR      │
     │                                │  ├─ 지표 계산 + 신호 판정         │
     │                                │  ├─ 상태 비교 (current_signal)    │
     │                                │  ├─ 에러 핸들링 + 재시도          │
     │                                │  └─ 전환 감지 시 알림 발송 ──────▶│  Bot 메시지
     │                                │                                   │
     │                                │  웹 대시보드 (localhost)           │
     │                                │  ├─ 워치리스트 관리                │
     │                                │  ├─ 실시간 신호 현황               │
     │                                │  ├─ 시스템 헬스 모니터링           │
     │                                │  └─ 신호 이력 로그                │
     │                                │                                   │
```

### 단일 서버 구조

```
Python 백엔드 (모든 기능을 단일 프로세스에서 처리):
  - 스케줄링 (APScheduler), 데이터 수집, 지표 계산, 신호 판정
  - 상태 관리, DB 저장, 텔레그램 발송
  - TradingView 웹훅 직접 수신 (n8n 불필요)
  - WebSocket을 통한 대시보드 실시간 푸시
  - 프론트엔드 정적 파일 서빙 (운영 모드)

실행 환경: Python venv 가상환경 (Docker 없음)
  - 저장공간 절약, 설치/실행 간편
  - start.sh 원클릭 실행
```

---

## 1단계: 핵심 지표 엔진 (Python)

### 캔들 타임프레임

```
기본 타임프레임: 1시간봉 (1h)
  - 10분 간격 스캔과의 균형: 1h봉은 노이즈 감소 + 충분한 반응 속도
  - 너무 짧은 타임프레임(1m, 5m)은 허위 신호 과다
  - 너무 긴 타임프레임(1d)은 10분 스캔의 의미 상실

지원 타임프레임: 15m, 30m, 1h, 4h, 1d (종목별 설정 가능)
  - 워치리스트에서 종목별로 타임프레임 지정
  - 기본값: 1h
```

### 사용 지표 조합

| 지표 | 역할 | 매개변수 |
|------|------|----------|
| **볼린저밴드 (BB)** | 변동성 & 과매수/과매도 | 20기간, 2σ |
| **BB 스퀴즈 (BB vs KC)** | 변동성 압축 → 폭발 감지 | KC 1.5/2.0/3.0배수 |
| **RSI** | 모멘텀 필터 | 14기간, 30/70 |
| **MACD** | 추세 방향 & 모멘텀 | 12/26/9 |
| **이동평균 (EMA)** | 추세 확인 | 20/50/200 |
| **거래량 프로파일** | 신호 신뢰도 보강 | 20기간 평균 대비 |

### 신호 로직

```
매수 신호 조건 (필수 4개 + 선택 1개):
  [필수]
  1. 가격이 BB 하단 터치 또는 이탈 후 복귀
  2. RSI < 30 (과매도 영역)
  3. MACD 히스토그램 상승 전환
  4. 거래량 > 20일 평균의 1.2배
  [선택 — 충족 시 신호 강도 가산]
  5. 스퀴즈 해제 + 모멘텀 상승 방향

매도 신호 조건 (필수 4개 + 선택 1개):
  [필수]
  1. 가격이 BB 상단 터치 또는 이탈 후 복귀
  2. RSI > 70 (과매수 영역)
  3. MACD 히스토그램 하락 전환
  4. 거래량 > 20일 평균의 1.2배
  [선택 — 충족 시 신호 강도 가산]
  5. 스퀴즈 해제 + 모멘텀 하락 방향

NEUTRAL 복귀 조건 (다음 중 하나 충족 시):
  BUY → NEUTRAL:
    - RSI > 50 (과매도 해소) AND 가격 > BB 중간선 (SMA20)
    - 또는 MACD 히스토그램 하락 전환 (모멘텀 소진)
  SELL → NEUTRAL:
    - RSI < 50 (과매수 해소) AND 가격 < BB 중간선 (SMA20)
    - 또는 MACD 히스토그램 상승 전환 (모멘텀 소진)

신호 상태: BUY / SELL / NEUTRAL
전환 = 이전 상태 ≠ 현재 상태 → 텔레그램 알림 발송
```

### 신호 강도 (Confidence Score)

```
점수 산정 (0~100):
  필수 조건 충족 여부 (각 20점, 총 80점):
    - BB 조건 충족: +20
    - RSI 조건 충족: +20
    - MACD 조건 충족: +20
    - 거래량 조건 충족: +20

  선택 조건 보너스 (최대 +20점):
    - 스퀴즈 해제 + 방향 일치: +15
    - EMA 정배열/역배열 확인: +5

  RSI 극단치 가산 (최대 +10점):
    - 매수: RSI < 20이면 +10, RSI < 25이면 +5
    - 매도: RSI > 80이면 +10, RSI > 75이면 +5

  최종 점수 = min(100, 합산)

신호 등급:
  90~100: STRONG (강력)
  70~89:  NORMAL (일반)
  60~69:  WEAK (약한 신호 — 알림은 보내되 등급 표시)
  < 60:   신호 미발생 (조건 불충족)

알림 필터링:
  - 기본: WEAK 이상 알림
  - 설정에서 최소 신호 등급 변경 가능 (STRONG만 받기 등)
```

### 데이터 소스 및 Fallback 전략

```
한국 주식: KRX (종목번호로 조회, 예: 005930)
  1차: yfinance (티커: "005930.KS") — 15분 지연
  2차: pykrx (한국거래소 직접 조회) — yfinance 장애 시 fallback
  3차: FinanceDataReader — pykrx도 실패 시 최종 fallback
  ※ 주의: yfinance는 비공식 API로 Rate limit/서비스 중단 리스크 존재

미국 주식: NYSE/NASDAQ (티커로 조회, 예: AAPL)
  1차: yfinance — 실시간 (15분 지연 없음)
  2차: TradingView Webhook (유료 플랜 시)

비트코인: 거래소 API (Binance/Upbit)
  1차: ccxt (예: BTC/USDT) — 실시간
  2차: yfinance (BTC-USD) — ccxt 장애 시 fallback

Fallback 로직:
  - 1차 소스 호출 실패 시 자동으로 2차 소스 시도
  - 모든 소스 실패 시 해당 종목 스킵 + 에러 로그 기록
  - 연속 3회 실패 시 텔레그램으로 시스템 에러 알림 발송
```

---

## 2단계: 스케줄링 및 웹훅 설계

### Python 스케줄러 (APScheduler)

```
Python 백엔드에서 APScheduler로 직접 스케줄링:
  - 시장별 장중시간 판별 후 활성 종목만 스캔
  - DB에서 워치리스트 조회 → 지표 계산 → 상태 비교 → 알림 발송
  - 모든 핵심 로직이 단일 프로세스에서 동작 (디버깅 용이)
```

### 크론 스케줄

```yaml
한국 주식:
  cron: "*/10 9-15 * * 1-5"     # 월~금 09:00~15:50 KST, 10분 간격
  timezone: Asia/Seoul
  추가조건: 15:30 이후 스캔 중단 (장마감)
  주의: 공휴일 체크 미포함 (향후 휴장일 캘린더 연동 고려)

미국 주식:
  # 동절기 (11월 첫째 일요일 ~ 3월 둘째 일요일): ET = KST-14
  cron_winter: "*/10 23,0-6 * * 1-5"  # KST 기준 23:30~06:00
  # 하절기 (서머타임, 3월 둘째 일요일 ~ 11월 첫째 일요일): ET = KST-13
  cron_summer: "*/10 22-23,0-5 * * 1-5"  # KST 기준 22:30~05:00
  timezone: Asia/Seoul
  서머타임 판별: pytz로 현재 US/Eastern 오프셋 자동 감지
  요일 보정:
    - KST 기준 화~토 새벽이 미국 월~금 장 마감
    - 월요일 새벽(KST)에는 미국 장 없음 (일요일이므로)
    - 실제 크론: "*/10 22-23 * * 1-4; */10 0-6 * * 2-5" 또는
      Python 코드에서 미국 현지 요일 기반 필터링 (권장)

비트코인:
  cron: "*/10 * * * *"            # 매일 24시간, 10분 간격
  timezone: Asia/Seoul
```

### TradingView 웹훅 수신 (FastAPI 직접 처리)

```
FastAPI 엔드포인트: POST /api/webhook/tradingview
  - TV_WEBHOOK_SECRET 헤더 검증
  - 수신 데이터 파싱 → signal_engine 파이프라인 합류
  - 수신 로그를 system_log 테이블에 기록
  - Swagger UI에서 디버깅 가능

외부 노출 (TradingView Alert가 로컬 서버에 접근하려면):
  - ngrok: ngrok http 8000 → 임시 공개 URL (무료)
  - cloudflared: cloudflared tunnel --url http://localhost:8000 (무료, 안정적)
  - TradingView Alert URL에 공개 URL + /api/webhook/tradingview 입력
```

---

## 3단계: 웹 대시보드 (로컬)

### 기술 스택

```
프론트엔드: React 18 + TypeScript + Vite + Shadcn/ui + Tailwind CSS
상태관리: Zustand + TanStack Query
차트: TradingView Lightweight Charts
백엔드: FastAPI + Uvicorn (Python 3.12)
ORM: SQLAlchemy 2.0 (async) + Alembic
DB: SQLite (WAL 모드) + aiosqlite
스케줄러: APScheduler
지표계산: pandas-ta + pandas + numpy
데이터수집: yfinance + ccxt + pykrx (fallback)
텔레그램: python-telegram-bot v20+
실시간: WebSocket (FastAPI 내장)
인프라: Python venv + Node.js 로컬 (Docker 없음)
웹훅: FastAPI 직접 수신 + ngrok/cloudflared (외부 노출 시)
개발도구: uv (Python) + pnpm (Node) + Ruff + ESLint

→ 상세: UBB_Pro_Tech_Stack.md 참조
```

### 페이지 구성

```
1. 대시보드 (메인)
   ├─ 워치리스트 종목 카드 (시장별 그룹)
   │  ├─ 종목명, 현재가, 등락률
   │  ├─ 현재 신호 상태 (BUY/SELL/NEUTRAL 배지)
   │  ├─ 신호 강도 (STRONG/NORMAL/WEAK 표시)
   │  ├─ 스퀴즈 단계 (●●●● 4단계 도트)
   │  ├─ RSI / %B / BBW 미니 게이지
   │  └─ 마지막 신호 전환 시각
   ├─ 시장 상태 헤더 (장중/장마감 표시)
   └─ 시스템 헬스 (마지막 스캔 시각, 에러 카운트)

2. 종목 추가/관리
   ├─ 시장 선택 (한국/미국/비트코인)
   ├─ 한국: 종목번호 입력 (예: 005930 → 삼성전자)
   ├─ 미국: 티커 입력 (예: AAPL → Apple)
   ├─ 비트코인: 심볼 선택 (BTC, ETH 등)
   ├─ 타임프레임 선택 (15m/30m/1h/4h/1d, 기본 1h)
   └─ 종목 검증 후 워치리스트 추가

3. 신호 상세 뷰
   ├─ TradingView 미니 차트 위젯 임베드
   ├─ 지표별 현재 값 상세 표시
   ├─ 신호 전환 이력 타임라인
   └─ 텔레그램 알림 발송 이력

4. 설정
   ├─ 텔레그램 봇 토큰 & 채팅 ID
   ├─ 지표 매개변수 커스텀
   ├─ 알림 쿨다운 설정 (중복 방지, 기본 30분)
   ├─ 최소 신호 등급 필터 (WEAK/NORMAL/STRONG)
   └─ 시스템 에러 알림 on/off
```

---

## 4단계: 텔레그램 알림 포맷

```
🟢 매수 신호 전환 — 삼성전자 (005930.KS)
━━━━━━━━━━━━━━━━━━
📊 현재가: 72,500원 (+2.1%)
📈 신호: NEUTRAL → BUY
💪 강도: 85/100 (NORMAL)

지표 상세:
  BB: 하단밴드 터치 후 반등
  RSI: 28.5 (과매도)
  MACD: 상승 전환
  스퀴즈: LOW → 에너지 축적중
  거래량: 평균 대비 1.8배
  EMA: 20 < 50 < 200 (역배열)

⏰ 감지 시각: 2026-03-15 10:30 KST
📐 타임프레임: 1h
🔗 TradingView에서 보기

━━━━━━━━━━━━━━━━━━
⚠️ 본 알림은 참고용이며 투자 권유가 아닙니다.
```

### 알림 쿨다운 정책

```
동일 종목 동일 방향 알림 중복 방지:
  - 기본 쿨다운: 30분 (설정에서 변경 가능)
  - 예: BUY 알림 발송 후 30분 내 동일 종목 BUY 재발생 → 알림 스킵
  - 방향 전환(BUY→SELL, SELL→BUY)은 쿨다운 무시 (즉시 발송)
  - NEUTRAL 전환은 알림 발송하지 않음 (설정에서 변경 가능)
```

---

## 5단계: DB 스키마

```sql
-- 워치리스트
CREATE TABLE watchlist (
    id INTEGER PRIMARY KEY,
    market TEXT NOT NULL,              -- 'KR', 'US', 'CRYPTO'
    symbol TEXT NOT NULL,              -- '005930', 'AAPL', 'BTC/USDT'
    display_name TEXT,                 -- '삼성전자', 'Apple', 'Bitcoin'
    timeframe TEXT DEFAULT '1h',       -- 지표 계산 타임프레임
    data_source TEXT DEFAULT 'auto',   -- 'yfinance', 'ccxt', 'pykrx', 'auto'
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 현재 신호 상태 캐시 (빠른 대시보드 조회용)
CREATE TABLE current_signal (
    watchlist_id INTEGER PRIMARY KEY REFERENCES watchlist(id),
    signal_state TEXT NOT NULL,        -- 'BUY', 'SELL', 'NEUTRAL'
    confidence REAL,                   -- 신호 강도 0~100
    price REAL,
    rsi REAL,
    bb_pct_b REAL,
    bb_width REAL,
    squeeze_level INTEGER,             -- 0~3
    macd_hist REAL,
    volume_ratio REAL,
    ema_20 REAL,
    ema_50 REAL,
    ema_200 REAL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 신호 이력
CREATE TABLE signal_history (
    id INTEGER PRIMARY KEY,
    watchlist_id INTEGER REFERENCES watchlist(id),
    signal_state TEXT NOT NULL,        -- 'BUY', 'SELL', 'NEUTRAL'
    prev_state TEXT,
    confidence REAL,                   -- 신호 강도 0~100
    timeframe TEXT,                    -- 어떤 타임프레임 기반 신호인지
    price REAL,
    rsi REAL,
    bb_pct_b REAL,
    bb_width REAL,
    squeeze_level INTEGER,             -- 0~3
    macd_hist REAL,
    volume_ratio REAL,
    ema_20 REAL,
    ema_50 REAL,
    ema_200 REAL,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 알림 발송 이력
CREATE TABLE alert_log (
    id INTEGER PRIMARY KEY,
    signal_history_id INTEGER REFERENCES signal_history(id),
    channel TEXT NOT NULL,             -- 'telegram'
    message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT 1,
    error_message TEXT                 -- 실패 시 에러 내용
);

-- 시스템 에러 로그
CREATE TABLE system_log (
    id INTEGER PRIMARY KEY,
    level TEXT NOT NULL,               -- 'INFO', 'WARN', 'ERROR'
    source TEXT,                       -- 'fetcher', 'indicator', 'telegram', 'scheduler'
    message TEXT NOT NULL,
    details TEXT,                      -- JSON 형태 상세 정보
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_signal_history_watchlist ON signal_history(watchlist_id, detected_at DESC);
CREATE INDEX idx_alert_log_sent ON alert_log(sent_at DESC);
CREATE INDEX idx_system_log_level ON system_log(level, created_at DESC);
```

---

## 6단계: 프로젝트 디렉토리 구조

```
ubb-pro-signal/
├── backend/
│   ├── .venv/                    # Python 가상환경 (uv venv으로 생성)
│   ├── data/
│   │   └── ubb_pro.db           # SQLite DB 파일 (venv 내부에서 관리)
│   ├── app.py                    # FastAPI 메인 + APScheduler 초기화
│   ├── config.py                 # 환경설정 (API키, 봇토큰)
│   ├── models.py                 # SQLAlchemy 모델
│   ├── database.py               # SQLite 연결 (data/ubb_pro.db)
│   ├── scheduler.py              # APScheduler 스케줄 정의 + 시장시간 판별
│   ├── indicators/
│   │   ├── bollinger.py          # BB, BB스퀴즈 4단계
│   │   ├── rsi.py                # RSI 계산
│   │   ├── macd.py               # MACD 계산
│   │   ├── ema.py                # EMA 20/50/200 계산
│   │   ├── volume.py             # 거래량 분석
│   │   └── signal_engine.py      # 종합 신호 판정 + 강도 계산 엔진
│   ├── data/
│   │   ├── base_fetcher.py       # Fetcher 공통 인터페이스 + 재시도 로직
│   │   ├── kr_fetcher.py         # 한국 주식 (yfinance → pykrx → FDR fallback)
│   │   ├── us_fetcher.py         # 미국 주식 (yfinance)
│   │   └── crypto_fetcher.py     # 비트코인 (ccxt → yfinance fallback)
│   ├── services/
│   │   ├── scanner.py            # 종목 스캐너 (신호 기반)
│   │   ├── monitor.py            # 모니터링 루프 (스케줄러가 호출)
│   │   ├── telegram_bot.py       # 텔레그램 발송 + 재시도
│   │   ├── webhook_handler.py    # TradingView 웹훅 수신 + 시크릿 검증
│   │   └── health.py             # 시스템 헬스체크 (스캔 성공률, API 상태)
│   └── routes/
│       ├── watchlist.py          # 워치리스트 CRUD API
│       ├── signals.py            # 신호 조회 API (current_signal 기반)
│       ├── settings.py           # 설정 API
│       └── system.py             # 헬스체크 / 시스템 로그 API
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx     # 메인 대시보드
│   │   │   ├── AddSymbol.jsx     # 종목 추가
│   │   │   ├── SignalDetail.jsx  # 신호 상세
│   │   │   └── Settings.jsx      # 설정
│   │   ├── components/
│   │   │   ├── SignalCard.jsx    # 종목별 신호 카드
│   │   │   ├── SqueezeDots.jsx  # 스퀴즈 4단계 도트
│   │   │   ├── MiniGauge.jsx    # RSI/%B 미니 게이지
│   │   │   ├── ConfidenceBadge.jsx # 신호 강도 배지
│   │   │   └── MarketHeader.jsx # 시장 상태 헤더
│   │   └── hooks/
│   │       └── useWebSocket.js  # 실시간 업데이트
│   └── package.json
│
├── tradingview/
│   └── UBB_Pro_v6.pine           # 트레이딩뷰 Pine Script 지표
│
├── scripts/
│   ├── start.sh                  # 원클릭 실행 (빌드 + 서버 기동)
│   └── setup.sh                  # 초기 환경 설정 (venv + pnpm install)
│
├── logs/                         # 서버 로그 (Loguru 출력)
├── .env.example                  # 환경변수 템플릿
├── requirements.txt              # Python 의존성
└── README.md                     # 설치 & 실행 가이드
```

---

## 7단계: 에러 핸들링 및 재시도 전략

### 데이터 수집 재시도

```
재시도 정책 (base_fetcher.py):
  - 최대 재시도: 3회
  - 재시도 간격: 2초, 4초, 8초 (지수 백오프)
  - 1차 소스 3회 실패 → 2차 소스(fallback)로 전환
  - 모든 소스 실패 → 해당 종목 스킵, system_log에 ERROR 기록

연속 실패 에스컬레이션:
  - 동일 종목 연속 3회 스캔 실패 → 텔레그램 시스템 에러 알림 발송
  - 동일 소스 연속 5회 실패 → 해당 소스 30분간 비활성화 (fallback 우선)
```

### 텔레그램 발송 재시도

```
재시도 정책 (telegram_bot.py):
  - 최대 재시도: 3회 (2초, 4초, 8초)
  - 실패 시 alert_log에 success=0, error_message 기록
  - Rate limit (429) → 대기 후 재시도
  - 연속 5회 발송 실패 → system_log에 WARN 기록
```

### 신호 계산 안전장치

```
데이터 검증:
  - 캔들 데이터 부족 시 (< 200개) → 해당 종목 신호 계산 스킵
  - NaN/None 지표 값 → NEUTRAL 유지, 신호 전환 없음
  - 가격 데이터 타임스탬프가 너무 오래된 경우 (> 1시간) → 스킵 + 경고 로그
```

---

## 8단계: 구현 우선순위

```
Phase 1a — 최소 동작 MVP (2~3일)
  ✅ 단일 시장(한국 주식) 지표 엔진 (bollinger, rsi, macd, signal_engine)
  ✅ 단일 데이터 fetcher (yfinance)
  ✅ 신호 강도 점수 산정
  ✅ NEUTRAL 복귀 로직
  ✅ 텔레그램 봇 연동 (신호 전환 알림)
  ✅ CLI 모니터링 스크립트 (하드코딩 워치리스트)

Phase 1b — MVP 확장 (2~3일)
  ✅ 3개 시장 데이터 fetcher (yfinance + ccxt)
  ✅ Fallback 데이터 소스 (pykrx, FDR)
  ✅ SQLite DB + 워치리스트 관리
  ✅ APScheduler 기반 스케줄링 (시장시간 필터)
  ✅ 에러 핸들링 + 재시도 로직
  ✅ 알림 쿨다운

Phase 2 — 웹 대시보드 (1주)
  ✅ FastAPI 백엔드 API
  ✅ current_signal 테이블 기반 빠른 조회
  ✅ React 프론트엔드 (대시보드 + 종목 추가)
  ✅ 신호 강도 배지 + 시스템 헬스 표시
  ✅ WebSocket 실시간 업데이트
  ✅ TradingView 미니차트 임베드

Phase 3 — TradingView 웹훅 연동 (1~2일)
  ✅ FastAPI 웹훅 수신 엔드포인트
  ✅ 웹훅 시크릿 검증 로직
  ✅ ngrok/cloudflared 터널 설정 가이드

Phase 4 — 고도화 (지속)
  ○ TradingView 스크리너 연동 (신호 기반 종목 자동 발견)
  ○ 백테스트 기능
  ○ 알림 커스텀 (조건별 필터)
  ○ 모바일 PWA
  ○ 한국 휴장일 캘린더 연동
```

---

## 9단계: 필수 환경변수 (.env)

```bash
# 텔레그램
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# TradingView (웹훅 시크릿)
TV_WEBHOOK_SECRET=your_secret_key

# 데이터 소스 (선택)
BINANCE_API_KEY=your_key
BINANCE_SECRET=your_secret

# 서버
HOST=0.0.0.0
PORT=8000
DATABASE_URL=sqlite:///./data/ubb_pro.db  # backend/data/ 내부에 저장

# 알림 설정
ALERT_COOLDOWN_MINUTES=30
MIN_SIGNAL_GRADE=WEAK          # WEAK, NORMAL, STRONG
SYSTEM_ERROR_ALERT=true        # 시스템 에러 텔레그램 알림
```

---

## 참고: TradingView 연동 방법 (2가지)

### 방법 A: Webhook Alert (TradingView Pro 이상)

TradingView에서 UBB Pro 지표를 적용하고 Alert를 설정하면, 신호 발생 시 FastAPI 웹훅 엔드포인트로 직접 전송된다.

```
장점: 정확한 Pine Script 지표 기반, 실시간
단점: TradingView 유료 필요, Alert 개수 제한, 외부 터널(ngrok 등) 필요
보안: FastAPI에서 TV_WEBHOOK_SECRET 헤더 직접 검증
```

### 방법 B: 로컬 지표 계산 (무료)

Python으로 동일한 지표를 로컬에서 계산한다. yfinance/ccxt로 데이터를 가져와 pandas-ta로 지표를 산출한다.

```
장점: 무료, 종목 수 무제한, 커스텀 자유
단점: 데이터 지연 가능 (한국주식 15분 지연), Pine Script와 미세 차이
대안: 한국 주식은 pykrx/FDR로 보완 가능
```

### 권장: A + B 하이브리드

핵심 종목 → TradingView Webhook (실시간, 정확)
나머지 종목 → 로컬 계산 (무료, 대량 스캔)

---

> ⚠️ 본 시스템은 기술적 분석 보조 도구이며, 투자 판단의 최종 책임은 사용자에게 있습니다.
