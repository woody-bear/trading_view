# Tasks: UBB Pro Signal System

**입력**: `/specs/001-ubb-pro-signal-system/`의 설계 문서
**필수**: plan.md, spec.md | **참조**: data-model.md, contracts/, research.md, quickstart.md

**테스트**: 명시적 요청 없으므로 테스트 태스크 미포함. 필요 시 각 Phase 체크포인트에서 수동 검증.

**구성**: 유저 스토리별 그룹화 — 각 스토리는 독립적으로 구현/테스트/배포 가능.

## 형식: `[ID] [P?] [Story] 설명`

- **[P]**: 병렬 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 해당 유저 스토리 (예: US1, US2, US3)
- 모든 태스크에 정확한 파일 경로 포함

---

## Phase 1: 프로젝트 초기 설정

**목적**: 프로젝트 디렉토리 구조 생성 및 의존성 설치

- [x] T001 plan.md의 소스 코드 구조에 따라 backend/ 및 frontend/ 디렉토리 트리 생성
- [x] T002 backend/requirements.txt 작성 — research.md 기반 (pandas-ta-classic, aiosqlite>=0.19<0.22 등 버전 고정 포함)
- [x] T003 [P] backend/ 에서 uv venv 생성 및 의존성 설치, backend/data/ 디렉토리 생성
- [x] T004 [P] frontend/ 에서 pnpm create vite (React + TypeScript 템플릿) 초기화 및 package.json 의존성 설정 ⚠️ Node.js/pnpm 미설치 — Phase 6에서 처리
- [x] T005 [P] 프로젝트 루트에 .env.example 생성 — spec.md 환경변수 섹션 기반
- [x] T006 [P] .gitignore 설정 — backend/.venv/, backend/data/*.db, frontend/node_modules/, frontend/dist/, logs/, .env
- [x] T007 [P] scripts/start.sh 및 scripts/setup.sh 원클릭 스크립트 작성

---

## Phase 2: 기반 인프라 (모든 유저 스토리의 전제조건)

**목적**: DB, ORM 모델, 설정 관리, 로깅 — 모든 스토리가 공유하는 핵심 인프라

**주의**: 이 Phase가 완료되어야 유저 스토리 작업 시작 가능

- [x] T008 backend/config.py — Pydantic Settings v2 기반 환경설정 클래스 구현 (TELEGRAM_BOT_TOKEN Optional, DATABASE_URL 기본값 등)
- [x] T009 backend/database.py — SQLAlchemy 2.0 async 엔진 + 세션 팩토리 구현 (WAL 모드 PRAGMA 이벤트 리스너, sqlite+aiosqlite 다이얼렉트)
- [x] T010 backend/models.py — data-model.md 기반 전체 ORM 모델 정의 (Watchlist, CurrentSignal, SignalHistory, AlertLog, SystemLog, OHLCVCache 6개 엔티티)
- [x] T011 backend/alembic/ 초기화 — alembic init -t async, env.py async 패턴 설정, alembic.ini URL 설정
- [x] T012 Alembic 초기 마이그레이션 생성 및 실행 — alembic revision --autogenerate + alembic upgrade head
- [x] T013 [P] backend/app.py — FastAPI 앱 골격 구현 (lifespan 컨텍스트, 라우터 등록, CORS 설정, 로깅 초기화)
- [x] T014 [P] Loguru 기반 로깅 설정 — backend/app.py 내 loguru 구성 (파일 로테이션, 포맷 설정, logs/ 출력)

**체크포인트**: `uvicorn app:app --reload` 실행 시 서버 기동 + DB 파일 생성 + Swagger UI 접근 가능

---

## Phase 3: 유저 스토리 1 — 자동 매매 신호 알림 수신 (P1) MVP

**목표**: 단일 종목(하드코딩)의 시세 수집 → 지표 계산 → 신호 판정 → 텔레그램 알림 발송 전체 파이프라인 동작

**독립 테스트**: 시스템 시작 → 하드코딩 종목 수동 스캔 → BUY/SELL 신호 전환 시 텔레그램 메시지 수신 확인

### 지표 엔진 구현

- [x] T015 [P] [US1] backend/indicators/bollinger.py — BB(20, 2σ) 계산 + %B + BBW 반환 함수 구현 (pandas-ta-classic 사용)
- [x] T010 [P] [US1] backend/indicators/rsi.py — RSI(14) 계산 함수 구현
- [x] T010 [P] [US1] backend/indicators/macd.py — MACD(12/26/9) 라인 + 시그널 + 히스토그램 계산 함수 구현
- [x] T010 [P] [US1] backend/indicators/ema.py — EMA 20/50/200 계산 함수 구현
- [x] T010 [P] [US1] backend/indicators/volume.py — 거래량 분석 (20일 평균 대비 비율) 계산 함수 구현
- [x] T020 [P] [US1] backend/indicators/bollinger.py 내 squeeze_detect() — squeeze_pro() 기반 4단계 스퀴즈 판별 (NO/LOW/MID/HIGH) 구현
- [x] T020 [US1] backend/indicators/signal_engine.py — 전체 지표 통합 신호 판정 엔진 구현:
  - calculate_indicators(): 모든 지표 일괄 계산
  - judge_signal(): BUY/SELL/NEUTRAL 판정 (필수 4조건 충족 검사)
  - calculate_confidence(): 0~100 점수 산정 (FR-004 로직)
  - judge_neutral_return(): NEUTRAL 복귀 판정 (FR-006 로직)
  - NaN 안전 처리: 지표 값 NaN 시 NEUTRAL 유지
- [x] T020 [US1] backend/indicators/__init__.py — 패키지 초기화 및 공개 API 정의

### 데이터 수집 (단일 소스)

- [x] T020 [US1] backend/fetchers/base.py — BaseFetcher 추상 클래스 정의 (fetch_ohlcv 메서드 시그니처, 공통 데이터 검증: 최소 200캔들, 타임스탬프 신선도 1시간)
- [x] T020 [US1] backend/fetchers/kr_fetcher.py — 한국 주식 fetcher 구현 (yfinance 단일 소스, 005930.KS 형식, yf.download 배치 호출)
- [x] T020 [P] [US1] backend/fetchers/us_fetcher.py — 미국 주식 fetcher 구현 (yfinance, AAPL 형식)
- [x] T020 [P] [US1] backend/fetchers/crypto_fetcher.py — 암호화폐 fetcher 구현 (ccxt Binance, BTC/USDT 형식)
- [x] T020 [US1] backend/fetchers/__init__.py — 시장 타입별 fetcher 라우팅 함수 (get_fetcher(market) → 적절한 fetcher 반환)

### 텔레그램 알림

- [x] T020 [US1] backend/services/telegram_bot.py — 텔레그램 봇 발송 서비스 구현:
  - send_signal_alert(): 신호 전환 알림 발송 (FR-016 메시지 포맷: 종목명/현재가/등락률/신호방향/강도/지표상세/시각/타임프레임)
  - 토큰 미설정 시 graceful skip (경고 로그만)
  - HTML 파싱 모드 포맷팅

### 스캐너 (수동 실행)

- [x] T020 [US1] backend/services/scanner.py — 핵심 스캔 파이프라인 구현:
  - scan_symbol(): 단일 종목 스캔 (fetch → calculate → judge → compare → notify)
  - current_signal 테이블과 이전 상태 비교
  - 상태 전환 시 signal_history 기록 + 텔레그램 발송
  - ohlcv_cache 테이블에 캔들 데이터 저장 (최대 500개 유지)
  - 에러 발생 시 system_log 기록 + 해당 종목 스킵

### 수동 스캔 API

- [x] T030 [US1] backend/routes/signals.py — GET /api/signals (현재 신호 전체 조회), GET /api/signals/{watchlist_id} (단일 상세) 구현
- [x] T030 [US1] backend/routes/__init__.py — 라우터 통합 및 app.py에 등록
- [x] T030 [US1] POST /api/scan/trigger 수동 스캔 엔드포인트 구현 (backend/routes/signals.py 내) — 활성 워치리스트 전체 또는 지정 종목 즉시 스캔

**체크포인트**: DB에 테스트 종목 수동 INSERT → POST /api/scan/trigger → current_signal 업데이트 + 조건 충족 시 텔레그램 알림 수신

---

## Phase 4: 유저 스토리 2 — 워치리스트 관리 (P2)

**목표**: 웹 API를 통해 한국/미국/비트코인 종목을 동적으로 추가/제거/수정하고, 유효성을 자동 검증

**독립 테스트**: API로 종목 추가 → GET /api/watchlist로 조회 → POST /api/scan/trigger로 스캔 시 해당 종목 포함 확인

### 백엔드

- [x] T033 [US2] backend/routes/watchlist.py — 워치리스트 CRUD API 구현:
  - POST /api/watchlist: 종목 추가 (유효성 검증 + 종목명 자동 조회)
  - GET /api/watchlist: 전체 조회 (market/is_active 필터)
  - PATCH /api/watchlist/{id}: 부분 수정 (timeframe, is_active 등)
  - DELETE /api/watchlist/{id}: 삭제 (관련 signal_history, ohlcv_cache CASCADE)
- [x] T034 [US2] backend/services/symbol_validator.py — 종목 유효성 검증 서비스 구현:
  - validate_kr(): 6자리 숫자 형식 + yfinance 조회로 존재 확인 + display_name 반환
  - validate_us(): 1~5자 영문 대문자 + yfinance 조회
  - validate_crypto(): 기호/기호 형식 + ccxt 심볼 목록 확인
- [x] T035 [US2] backend/routes/watchlist.py에 app.py 라우터 등록

**체크포인트**: POST /api/watchlist로 3개 시장 종목 각 1개 추가 → GET /api/watchlist 조회 → 스캔 시 3종목 모두 처리

---

## Phase 5: 유저 스토리 3 — 시장별 자동 스케줄링 (P3)

**목표**: 시스템 시작 시 APScheduler가 10분 간격으로 자동 스캔하며, 시장별 거래 시간에 맞춰 장중 종목만 처리

**독립 테스트**: 시스템 시작 → 로그에서 10분 간격 스캔 실행 확인 → 장외 시간 시장 종목 스킵 로그 확인

- [x] T036 [US3] backend/scheduler.py — APScheduler AsyncIOScheduler 설정 구현:
  - 10분 interval job 등록 (max_instances=1, coalesce=True, misfire_grace_time=60)
  - app.py lifespan에서 scheduler.start() / shutdown()
  - 중복 실행 방지 _scanning_lock 플래그
- [x] T037 [US3] backend/scheduler.py 내 market_hours 모듈 구현:
  - is_market_open(market): 시장 개장 여부 판별
  - KR: 09:00~15:30 KST 평일
  - US: 09:30~16:00 ET 평일 (zoneinfo로 서머타임 자동 처리)
  - CRYPTO: 항상 True
  - get_active_markets(): 현재 개장 중인 시장 목록 반환
- [x] T038 [US3] backend/services/scanner.py에 run_scheduled_scan() 추가 — 활성 워치리스트 중 장중 종목만 필터링하여 순차 스캔
- [x] T039 [US3] 알림 쿨다운 로직 구현 (backend/services/scanner.py 내):
  - 동일 종목 동일 방향 알림 30분 쿨다운 (alert_log 조회)
  - 방향 전환(BUY↔SELL)은 쿨다운 무시 즉시 발송

**체크포인트**: uvicorn 시작 → 10분 대기 → 로그에서 자동 스캔 실행 + 시장시간 필터링 확인

---

## Phase 6: 유저 스토리 4 — 웹 대시보드 + 지표 차트 (P4)

**목표**: 로컬 브라우저에서 전체 종목 신호 현황 카드 + 종목별 인터랙티브 지표 차트(캔들스틱+BB/RSI/MACD/EMA/거래량/스퀴즈+신호마커) 확인, 실시간 WebSocket 업데이트

**독립 테스트**: localhost:8000 접속 → 시장별 종목 카드 확인 → 종목 클릭 시 TradingView 동일 차트 표시 → 스캔 후 실시간 업데이트

### 백엔드 API

- [x] T040 [US4] backend/routes/charts.py — GET /api/signals/{watchlist_id}/chart 구현:
  - ohlcv_cache에서 캔들 데이터 조회
  - signal_engine으로 전체 지표 계산 (BB상단/중간/하단, EMA20/50/200, RSI, MACD선/시그널/히스토그램, 거래량평균, 스퀴즈)
  - signal_history에서 해당 종목 신호 마커 조회
  - Lightweight Charts 호환 JSON 형식으로 반환 (time/value 배열, markers 배열)
- [x] T041 [US4] backend/routes/signals.py에 GET /api/signals/{watchlist_id}/history 추가 (신호 전환 이력 페이지네이션)
- [x] T042 [US4] backend/routes/system.py — GET /api/system/health (헬스), GET /api/system/logs (로그 조회) 구현
- [x] T043 [US4] backend/routes/websocket.py — WebSocket 엔드포인트 구현:
  - ConnectionManager 클래스 (connect/disconnect/broadcast)
  - ws://localhost:8000/ws 엔드포인트
  - ping/pong 하트비트
- [x] T044 [US4] backend/services/scanner.py에서 스캔 완료 시 WebSocket broadcast 연동:
  - signal_update 메시지 (종목별 신호 변경)
  - scan_complete 메시지 (스캔 주기 완료 요약)

### 프론트엔드 기반

- [x] T045 [P] [US4] frontend/ Vite + React + TypeScript 프로젝트 설정:
  - Tailwind CSS + Shadcn/ui 초기화
  - React Router v6 라우팅 설정 (/, /add, /signal/:id, /settings)
  - Axios + TanStack Query 설정 (frontend/src/api/client.ts)
  - 다크모드 지원 설정 (Tailwind dark 클래스)
- [x] T046 [P] [US4] frontend/src/types/index.ts — TypeScript 타입 정의 (contracts/rest-api.md 및 contracts/websocket.md 기반)
- [x] T047 [P] [US4] frontend/src/stores/signalStore.ts — Zustand 스토어 구현 (신호 목록 상태, WebSocket 메시지 처리)
- [x] T048 [P] [US4] frontend/src/hooks/useWebSocket.ts — WebSocket 커스텀 훅 구현 (자동 재연결 지수 백오프, 30초 ping, 메시지 타입별 디스패치)

### 대시보드 페이지

- [x] T049 [US4] frontend/src/components/SignalCard.tsx — 종목 신호 카드 컴포넌트 (종목명/현재가/등락률/신호배지/강도/스퀴즈도트/RSI·%B 미니게이지/마지막전환시각)
- [x] T050 [P] [US4] frontend/src/components/SqueezeDots.tsx — 스퀴즈 4단계 도트 컴포넌트 (NO=회색, LOW=노랑, MID=주황, HIGH=빨강)
- [x] T051 [P] [US4] frontend/src/components/MiniGauge.tsx — RSI/%B 미니 게이지 바 컴포넌트
- [x] T052 [P] [US4] frontend/src/components/ConfidenceBadge.tsx — 신호 강도 배지 컴포넌트 (STRONG=보라, NORMAL=파랑, WEAK=회색)
- [x] T053 [P] [US4] frontend/src/components/MarketHeader.tsx — 시장 상태 헤더 컴포넌트 (시장명/개장·폐장 상태/다음 전환 시각)
- [x] T054 [US4] frontend/src/pages/Dashboard.tsx — 메인 대시보드 페이지 (시장별 그룹 + SignalCard 목록 + 시스템 헬스 표시)

### 지표 차트

- [x] T055 [US4] frontend/src/components/charts/useChartData.ts — 차트 데이터 fetch 훅 (GET /api/signals/{id}/chart + 타임프레임 전환)
- [x] T056 [US4] frontend/src/components/charts/CandlestickPane.tsx — 메인 캔들스틱 차트 구현:
  - TradingView Lightweight Charts createChart() + CandlestickSeries
  - BB 밴드 3개 라인 오버레이 (상단=빨강 점선, 중간=회색, 하단=파랑 점선)
  - EMA 3개 라인 오버레이 (20=노랑, 50=주황, 200=빨강)
  - BUY/SELL 신호 마커 (setMarkers)
  - 줌/스크롤/크로스헤어 인터랙션
- [x] T057 [P] [US4] frontend/src/components/charts/RSIPane.tsx — RSI 서브차트 (LineSeries + 과매수70/과매도30 수평선)
- [x] T058 [P] [US4] frontend/src/components/charts/MACDPane.tsx — MACD 서브차트 (MACD선 + 시그널선 LineSeries + 히스토그램 HistogramSeries 양/음 색상 + 스퀴즈 도트 행)
- [x] T059 [P] [US4] frontend/src/components/charts/VolumePane.tsx — 거래량 서브차트 (HistogramSeries 양봉=초록/음봉=빨강 + 20일 평균 LineSeries)
- [x] T060 [US4] frontend/src/components/charts/IndicatorChart.tsx — 전체 차트 컨테이너 (4개 Pane 세로 배치, 타임프레임 전환 버튼, 차트 시간축 동기화)

### 상세/추가/설정 페이지

- [x] T061 [US4] frontend/src/pages/SignalDetail.tsx — 종목 상세 페이지 (IndicatorChart + 지표 현재값 패널 + 신호 전환 이력 타임라인 + 알림 발송 이력)
- [x] T062 [US4] frontend/src/pages/AddSymbol.tsx — 종목 추가 페이지 (시장 선택 → 심볼 입력 → 유효성 검증 → 타임프레임 선택 → 추가)
- [x] T063 [US4] frontend/src/pages/Settings.tsx — 설정 페이지 (텔레그램 설정 상태, 쿨다운 시간, 최소 신호 등급 필터)
- [x] T064 [US4] frontend/src/App.tsx — 전체 앱 레이아웃 (사이드바 네비게이션, React Router Outlet, WebSocket 연결 초기화)

### SPA 서빙

- [x] T065 [US4] backend/app.py에 SPAStaticFiles 클래스 구현 및 마운트:
  - StaticFiles 상속 + 404 시 index.html fallback
  - API/WebSocket 라우트 먼저 등록 → SPA 마지막 마운트
  - frontend/dist/ 경로 참조 (운영 모드)

**체크포인트**: pnpm build → uvicorn 시작 → localhost:8000 접속 → 대시보드에서 종목 카드 확인 → 종목 클릭 → 캔들스틱+BB+RSI+MACD+거래량 차트 표시 → 스캔 후 카드 실시간 업데이트

---

## Phase 7: 유저 스토리 5 — 데이터 수집 안정성 (P5)

**목표**: 1차 소스 장애 시 자동 fallback, 재시도 로직, 연속 실패 시 시스템 에러 알림

**독립 테스트**: 1차 소스 의도적 차단 → fallback 자동 전환 확인 → 모든 소스 실패 시 텔레그램 에러 알림 수신

- [x] T066 [US5] backend/fetchers/base.py에 재시도 로직 추가:
  - 최대 3회 재시도 (지수 백오프 2초/4초/8초)
  - 연속 실패 카운터 관리
  - 동일 소스 5회 연속 실패 시 30분 비활성화
- [x] T067 [US5] backend/fetchers/kr_fetcher.py에 fallback chain 구현:
  - 1차 yfinance 실패 → 2차 pykrx → 3차 FinanceDataReader
  - 각 소스 전환 시 system_log 기록
- [x] T068 [P] [US5] backend/fetchers/crypto_fetcher.py에 fallback 구현:
  - 1차 ccxt 실패 → 2차 yfinance (BTC-USD)
- [x] T069 [US5] backend/services/scanner.py에 에러 에스컬레이션 구현:
  - 동일 종목 연속 3회 스캔 실패 시 텔레그램 시스템 에러 알림 발송
  - 에러 알림은 신호 알림과 별도 포맷
- [x] T070 [US5] backend/services/telegram_bot.py에 send_system_error() 메서드 추가 — 시스템 에러 전용 알림 포맷
- [x] T071 [US5] backend/services/telegram_bot.py에 발송 재시도 로직 추가:
  - 최대 3회 재시도 (2초/4초/8초)
  - 실패 시 alert_log에 success=False + error_message 기록

**체크포인트**: 네트워크 차단 시뮬레이션 → fallback 전환 로그 확인 → 3회 연속 실패 시 텔레그램 에러 알림 수신

---

## Phase 8: 유저 스토리 6 — TradingView 웹훅 수신 (P6)

**목표**: TradingView Alert 웹훅을 FastAPI 엔드포인트로 직접 수신하고, 시크릿 검증 후 신호 파이프라인에 합류

**독립 테스트**: curl로 웹훅 테스트 페이로드 전송 → 시크릿 검증 → 신호 파이프라인 처리 → 알림 발송

- [x] T072 [US6] backend/services/webhook_handler.py — 웹훅 처리 서비스 구현:
  - validate_secret(): TV_WEBHOOK_SECRET 헤더 검증
  - parse_payload(): TradingView Alert JSON 파싱
  - process_webhook(): 파싱된 데이터를 signal_engine 파이프라인에 합류
- [x] T073 [US6] backend/routes/webhook.py — POST /api/webhook/tradingview 엔드포인트 구현:
  - X-TV-Webhook-Secret 헤더 검증
  - 유효: 200 + 처리 결과 반환
  - 시크릿 불일치: 401 + 보안 로그 기록
  - 페이로드 오류: 422
  - 수신 로그를 system_log에 기록
- [x] T074 [US6] app.py에 webhook 라우터 등록

**체크포인트**: curl -X POST localhost:8000/api/webhook/tradingview -H "X-TV-Webhook-Secret: test" -d '{"symbol":"005930","signal":"BUY",...}' → 200 응답 + 알림 발송

---

## Phase 9: 설정 API + 마무리

**목적**: 시스템 설정 API, 알림 이력 조회, 전체 통합 검증

- [x] T075 backend/routes/settings.py — GET/PATCH /api/settings 구현 (쿨다운 시간, 최소 신호 등급, 시스템 에러 알림 on/off, NEUTRAL 알림 on/off)
- [x] T076 backend/routes/alerts.py — GET /api/alerts 알림 발송 이력 조회 API 구현 (페이지네이션, success 필터)
- [x] T077 backend/services/health.py — 시스템 헬스체크 서비스 구현 (마지막 스캔 시각, 다음 스캔 시각, 활성 종목 수, 시장 상태, 에러 카운트, 텔레그램 설정 여부, 업타임)
- [x] T078 frontend/src/pages/Settings.tsx와 backend/routes/settings.py 연동 완성
- [x] T079 [P] scripts/start.sh 테스트 — --build 옵션으로 프론트엔드 빌드 + 백엔드 시작 통합 검증
- [x] T080 quickstart.md 기반 전체 흐름 검증 — 초기 설치 → 종목 등록 → 첫 스캔 → 알림 수신 → 대시보드 확인

---

## 의존성 및 실행 순서

### Phase 의존성

- **Phase 1 (설정)**: 의존성 없음 — 즉시 시작
- **Phase 2 (기반)**: Phase 1 완료 필요 — **모든 유저 스토리 차단**
- **Phase 3 (US1 MVP)**: Phase 2 완료 필요 — 다른 스토리 의존성 없음
- **Phase 4 (US2)**: Phase 2 완료 필요 — US1과 독립적이나 US1 완료 후 순차 진행 권장
- **Phase 5 (US3)**: Phase 3 완료 필요 — scanner.py에 자동 스케줄링 추가
- **Phase 6 (US4)**: Phase 3 완료 필요 — 백엔드 API + 신호 데이터 필요
- **Phase 7 (US5)**: Phase 3 완료 필요 — fetcher에 fallback 추가
- **Phase 8 (US6)**: Phase 2 완료 필요 — 독립적 구현 가능
- **Phase 9 (마무리)**: 모든 유저 스토리 완료 후

### 유저 스토리 의존성

```text
Phase 1 → Phase 2 → ┬─ Phase 3 (US1 MVP) ──→ Phase 5 (US3)
                     │                    ──→ Phase 6 (US4)
                     │                    ──→ Phase 7 (US5)
                     ├─ Phase 4 (US2) ────────────┘
                     └─ Phase 8 (US6) ────────────┘
                                                   → Phase 9 (마무리)
```

### 각 유저 스토리 내 순서

- 모델 → 서비스 → 엔드포인트 → 통합
- [P] 표시 태스크는 동일 Phase 내 병렬 실행 가능
- 스토리 완료 후 체크포인트에서 독립 검증

### 병렬 실행 기회

- Phase 1: T003~T007 전부 병렬
- Phase 2: T013, T014 병렬
- Phase 3: T015~T020 (6개 지표 모듈) 전부 병렬, T024~T026 (3개 fetcher) 병렬
- Phase 6: T045~T048 (프론트엔드 기반) 병렬, T049~T053 (UI 컴포넌트) 병렬, T057~T059 (서브차트) 병렬

---

## 병렬 실행 예시: 유저 스토리 1

```bash
# 지표 모듈 6개 동시 실행:
T015: backend/indicators/bollinger.py
T016: backend/indicators/rsi.py
T017: backend/indicators/macd.py
T018: backend/indicators/ema.py
T019: backend/indicators/volume.py
T020: backend/indicators/bollinger.py (squeeze)

# → 완료 후 통합:
T021: backend/indicators/signal_engine.py

# fetcher 3개 동시 실행:
T024: backend/fetchers/kr_fetcher.py
T025: backend/fetchers/us_fetcher.py
T026: backend/fetchers/crypto_fetcher.py
```

---

## 병렬 실행 예시: 유저 스토리 4

```bash
# 프론트엔드 기반 4개 동시:
T045: Vite + Tailwind + Shadcn 초기화
T046: TypeScript 타입 정의
T047: Zustand 스토어
T048: WebSocket 훅

# → 완료 후 UI 컴포넌트 5개 동시:
T049: SignalCard
T050: SqueezeDots
T051: MiniGauge
T052: ConfidenceBadge
T053: MarketHeader

# → 완료 후 차트 서브패인 3개 동시:
T057: RSIPane
T058: MACDPane
T059: VolumePane
```

---

## 구현 전략

### MVP 우선 (유저 스토리 1만)

1. Phase 1: 프로젝트 설정 완료
2. Phase 2: 기반 인프라 완료 (**필수 — 모든 스토리 차단**)
3. Phase 3: US1 완료 (지표 엔진 + 단일 소스 데이터 수집 + 텔레그램 알림)
4. **중단 및 검증**: 하드코딩 종목으로 전체 파이프라인 동작 확인
5. 즉시 사용 가능한 MVP 완성

### 점진적 배포

1. Setup + Foundational → 기반 완성
2. US1 → 독립 검증 → **MVP 릴리스** (텔레그램 알림 동작)
3. US2 → 독립 검증 → 워치리스트 동적 관리 추가
4. US3 → 독립 검증 → 자동 스케줄링 추가 (set-and-forget)
5. US4 → 독립 검증 → 대시보드 + 지표 차트 추가
6. US5 → 독립 검증 → 운영 안정성 확보
7. US6 → 독립 검증 → TradingView 하이브리드 연동
8. Phase 9 → 전체 통합 마무리

---

## 비고

- [P] 태스크 = 다른 파일, 의존성 없음 → 병렬 실행 가능
- [Story] 라벨 = 해당 유저 스토리 추적용
- 각 유저 스토리는 독립적으로 완료 및 테스트 가능
- 각 태스크 또는 논리적 그룹 완료 후 커밋 권장
- 체크포인트에서 중단하여 스토리 독립 검증 가능
