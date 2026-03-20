# 기술 리서치: UBB Pro Signal System

**피처**: `001-ubb-pro-signal-system` | **날짜**: 2026-03-16

## 1. 지표 계산 라이브러리: pandas-ta

### 결정: pandas-ta-classic (pandas-ta 커뮤니티 포크)

### 근거
- 순수 Python — C 바인딩(ta-lib) 설치 불필요, `pip install`만으로 완료
- 200+ 지표 내장 — BB, RSI, MACD, EMA, KC(켈트너채널) 모두 지원
- pandas DataFrame 직접 연산 — 별도 데이터 변환 불필요
- 10분 간격 스캔에서 ta-lib 대비 속도 차이 무의미 (수십ms 수준)

### 주의: 원본 pandas-ta 프로젝트 상태
- 원본 pandas-ta(@twopirllc)는 유지보수 중단/이전됨, PyPI 이력 초기화됨
- **pandas-ta-classic** (`pip install pandas-ta-classic`): 커뮤니티 포크, 활발히 유지보수 중
- pandas-ta-openbb: NumPy 2.x 호환 포크
- **결정: pandas-ta-classic 사용** — requirements.txt에 `pandas-ta-classic` 기재

### 대안 검토
- **ta-lib**: C 바인딩으로 빠르지만 `brew install ta-lib` 필요, 크로스플랫폼 설치 복잡
- **ta (Technical Analysis Library)**: 경량이지만 KC 미지원, 스퀴즈 직접 구현 필요
- **tulipy**: C 기반, pandas-ta보다 적은 지표 수

### BB 스퀴즈 구현 방법
pandas-ta는 `squeeze_pro()` 함수를 제공하며, 이것으로 4단계 스퀴즈를 직접 판별 가능:
- `squeeze_pro()`는 KC 배수 3단계(narrow=1.0, normal=1.5, wide=2.0)를 사용
- 출력 컬럼: `SQZPRO_ON_WIDE`, `SQZPRO_ON_NORMAL`, `SQZPRO_ON_NARROW`, `SQZPRO_OFF`
- 4단계 매핑:
  - **NO (0)**: `SQZPRO_OFF` — BB가 모든 KC 밖, 변동성 정상
  - **LOW (1)**: `SQZPRO_ON_WIDE`만 true — 약한 압축
  - **MID (2)**: `SQZPRO_ON_NORMAL` true — 중간 압축
  - **HIGH (3)**: `SQZPRO_ON_NARROW` true — 강한 압축 (폭발 임박)
- 별도로 `ta.kc()` 함수로 켈트너채널 독립 계산도 가능

### NaN 처리 주의사항
- pandas-ta 지표는 시리즈 초반에 NaN을 생성 (BB: 19개, RSI: ~15개, MACD: 33개, EMA200: 200개)
- 최소 캔들 데이터 200개 이상 필요 (EMA200 기준)
- 지표 계산 후 NaN 체크 필수 — NaN 발견 시 해당 종목 NEUTRAL 유지
- 입력 OHLCV 데이터의 NaN/결측값은 지표 계산 전에 forward-fill 처리 필요

---

## 2. 데이터 수집: 시장별 소스

### 결정: yfinance(1차) + pykrx/ccxt(fallback)

### 한국 주식 (yfinance → pykrx → FDR)
- **yfinance**: 티커 형식 `005930.KS`, 15분 지연 데이터
  - 장점: 글로벌 통합 인터페이스, 설치 간편
  - 단점: 비공식 API, rate limit 존재, 간헐적 서비스 불안정
  - rate limit: 2024년 이후 대폭 강화됨, 개별 티커 순차 호출 시 429 에러 빈번
  - **핵심**: `yf.download(tickers=[...], group_by="ticker")`로 배치 다운로드 필수 — 50종목 단일 호출로 rate limit 회피
- **pykrx**: 한국거래소(KRX) 직접 조회
  - 장점: 공식 데이터, yfinance 대비 안정적
  - 단점: 한국 주식 전용, OHLCV 외 지표 직접 계산 필요
- **FinanceDataReader**: 최종 fallback, 다소 느리지만 안정적

### 미국 주식 (yfinance)
- yfinance로 실시간 데이터 (지연 없음)
- 미국 주식은 yfinance가 가장 안정적 — 별도 fallback 우선순위 낮음
- TradingView 웹훅을 보조 소스로 활용 가능

### 암호화폐 (ccxt → yfinance)
- **ccxt**: 100+ 거래소 통합, Binance 기본
  - 장점: 실시간 OHLCV, 세분화된 타임프레임 지원
  - 단점: API 키 필요 (Binance), 거래소별 rate limit 상이
  - Binance rate limit: 1,200 요청/분 — 충분
- **yfinance**: BTC-USD 등 주요 코인만 지원, 1분 최소 간격
  - fallback 용도로 적합

### 대안 검토
- **Alpha Vantage**: API 키 필수, 무료 5 요청/분으로 50종목 처리 불가
- **polygon.io**: 유료, 로컬 개인 프로젝트에 과도

---

## 3. 스케줄러: APScheduler

### 결정: APScheduler 3.x + AsyncIOScheduler

### 근거
- FastAPI 프로세스 내 임베디드 가능 — 별도 워커/큐 불필요
- cron 표현식 지원 — 시장별 스케줄 설정 유연
- 동적 job 추가/삭제 — 종목 워치리스트 변경 시 실시간 반영
- `max_instances=1` 설정으로 중복 실행 방지

### AsyncIOScheduler vs BackgroundScheduler
- **AsyncIOScheduler**: FastAPI의 asyncio 이벤트 루프 공유, async 함수 직접 스케줄 가능
- **BackgroundScheduler**: 별도 스레드, sync 함수만 실행
- **결정: AsyncIOScheduler** — FastAPI async 생태계와 자연스러운 통합, DB 접근 시 async 세션 활용

### 중복 실행 방지
```text
방법 1: max_instances=1 (APScheduler 내장)
  → 이전 job 미완료 시 새 job 스킵, 경고 로그 기록

방법 2: coalesce=True
  → 앱 다운 중 놓친 실행이 쌓여도 1회만 실행

방법 3: misfire_grace_time=60
  → 60초 이상 늦은 실행은 무시

방법 4: 플래그 기반 (직접 구현)
  → scanner.py에 _scanning_lock 플래그 → 이중 보호
```
- 방법 1~3 조합 적용 + 방법 4로 이중 보호

### FastAPI 통합 패턴
- FastAPI lifespan 컨텍스트에서 scheduler.start() / scheduler.shutdown()
- `--workers 1` 필수 (다중 워커 시 스케줄러 중복 실행)
- CPU 집약 지표 계산이 이벤트 루프를 차단하지 않도록 주의 — pandas-ta는 I/O가 아닌 CPU 작업이지만 50종목 처리 시간이 짧아(수초) asyncio 기본 executor로 충분

### 대안 검토
- **Celery**: Redis/RabbitMQ 의존, 단일 프로세스에 과도
- **Dramatiq**: 경량이지만 여전히 별도 브로커 필요
- **asyncio.create_task + sleep**: 단순하지만 cron 표현식 미지원, 에러 복구 불편

---

## 4. 데이터베이스: SQLite + SQLAlchemy async

### 결정: SQLite WAL 모드 + SQLAlchemy 2.0 async + aiosqlite

### 근거
- 1인 로컬 시스템 — 동시 사용자 없음, SQLite로 충분
- WAL(Write-Ahead Logging) 모드 — 읽기/쓰기 동시 가능
- 파일 1개로 백업 간편 (`cp` 명령어로 완료)
- SQLAlchemy 레이어 덕분에 향후 PostgreSQL 전환 시 드라이버만 교체

### WAL 모드 설정
- `engine.sync_engine`에 대해 `event.listens_for("connect")`로 PRAGMA 설정
- WAL 모드는 DB 파일에 영속 저장되지만, 방어적으로 연결마다 설정 권장
- `PRAGMA journal_mode=WAL` + `PRAGMA synchronous=NORMAL` + `PRAGMA busy_timeout=5000`

### aiosqlite 버전 주의
- aiosqlite v0.22.0에서 연결 클래스 내부 변경 → SQLAlchemy와 연결 정리 행(hang) 문제 발생
- SQLAlchemy issue #13039 참조 — 테스트된 버전으로 고정 필요
- 권장: `aiosqlite>=0.19,<0.22` 또는 SQLAlchemy 최신 패치 확인

### Alembic 마이그레이션
- Alembic은 async 엔진을 직접 지원하지 않음 — `alembic init -t async` 템플릿 사용
- `async_engine_from_config()` + `connection.run_sync(do_run_migrations)` 패턴
- alembic.ini에 `sqlalchemy.url = sqlite+aiosqlite:///./data/ubb_pro.db` 설정
- FastAPI lifespan 내에서 프로그래밍 방식 마이그레이션 시 `asyncio.run()` 대신 `await connection.run_sync()` 사용

### 대안 검토
- **PostgreSQL**: 별도 서버 프로세스 필요, 1인 사용에 과도
- **DuckDB**: 분석용 OLAP, OLTP 워크로드에 부적합
- **TinyDB**: ORM 미지원, 마이그레이션 불가

---

## 5. 텔레그램: python-telegram-bot v20+

### 결정: python-telegram-bot v20+

### 근거
- 공식 Telegram Bot API 래퍼
- v20+은 async/await 네이티브 지원 — FastAPI async 생태계와 호환
- 타입 힌트 완비
- 알림 전용 단방향 사용 (추후 양방향 명령어 확장 가능)

### 발송 방식
- `Bot.send_message()` async 호출
- HTML 파싱 모드로 포맷팅 (이모지 + 볼드 + 코드블록)
- rate limit: 초당 30메시지 (동일 채팅), 프로젝트 규모에 문제 없음

### 대안 검토
- **aiogram**: 더 경량이지만 커뮤니티 규모 작음
- **직접 HTTP 호출**: httpx로 Telegram API 직접 호출 가능하나 래퍼 사용이 안전

---

## 6. 프론트엔드: React 18 + Vite + Shadcn/ui

### 결정: React 18 + TypeScript + Vite 5 + Shadcn/ui + Tailwind CSS

### 근거
- Vite: 빠른 HMR, 경량 번들, React 표준 빌드 도구
- Shadcn/ui: 복사 방식(의존성 아님), 커스텀 자유도 높음, 다크모드 내장
- Zustand: 1.1KB 경량, WebSocket 상태 관리에 적합
- TanStack Query: API 캐싱, 자동 재요청, 로딩/에러 상태 관리

### SPA 배포
- 개발: `pnpm dev` → Vite dev server (localhost:3000)
- 운영: `pnpm build` → `dist/` → FastAPI `StaticFiles` 마운트
- catch-all 라우트: `SPAStaticFiles` 커스텀 클래스 사용
  - `StaticFiles`를 상속, `get_response()`에서 404 발생 시 `index.html` 반환
  - API 라우트와 WebSocket을 먼저 등록한 후 SPA를 마지막에 마운트 (순서 중요)
  - `html=True` 옵션으로 디렉토리 요청 시 index.html 자동 서빙

### Next.js 미채택 이유
- SSR/SSG 불필요 (로컬 대시보드, SEO 무관)
- API Routes 불필요 (FastAPI가 백엔드 전담)
- 파일 기반 라우팅은 이 규모에서 오버엔지니어링

---

## 7. WebSocket: FastAPI 내장

### 결정: FastAPI 내장 WebSocket + 커스텀 ConnectionManager

### 근거
- FastAPI가 WebSocket을 네이티브 지원 — 외부 라이브러리 불필요
- ConnectionManager 패턴으로 다중 클라이언트 브로드캐스트 구현
- 프론트엔드는 네이티브 WebSocket API + 커스텀 훅(useWebSocket)으로 구현

### 대안 검토
- **Socket.IO**: 양방향 이벤트 기반이지만 추가 의존성, 이 규모에 과도
- **SSE (Server-Sent Events)**: 단방향만 지원, WebSocket보다 제한적

---

## 8. 설정 관리: Pydantic Settings v2

### 결정: pydantic-settings v2

### 근거
- `.env` 파일 자동 로드
- 타입 검증 + 기본값 설정
- FastAPI와 자연스러운 통합 (BaseSettings → Depends 주입)
- 선택적 설정(TELEGRAM_BOT_TOKEN 등)은 `Optional[str] = None`으로 처리

---

## 9. 시장 시간 + 서머타임 판별

### 결정: zoneinfo (Python 표준) + pytz (호환성)

### 근거
- Python 3.9+의 `zoneinfo` 모듈로 타임존 처리
- `US/Eastern` 오프셋을 조회하면 서머타임 자동 반영
- 현재 시각이 시장 거래 시간 범위 내인지 판별하는 유틸 함수 구현
- 한국 공휴일은 초기 버전에서 미지원 (평일만 필터링)

### 미국 시장 시간 판별 로직
```text
1. 현재 시각을 US/Eastern 타임존으로 변환
2. 평일(월~금) AND 09:30~16:00 ET 범위인지 확인
3. 서머타임은 zoneinfo가 자동 처리 (수동 판별 불필요)
```
