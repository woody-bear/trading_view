---
purpose: 프로젝트 DB 테이블·관계·마이그레이션 이력 개요(13개 테이블).
reader: Claude가 DB 스키마를 이해하거나 테이블 간 관계를 조회할 때.
update-trigger: 테이블 추가·제거; 관계/외래키 변경; 마이그레이션 정책 변경.
last-audit: 2026-04-18
---

# UBB Pro — DB 구조

> 최종 업데이트: 2026-04-12  
> 소스: `backend/models.py` + `backend/alembic/versions/`

## 환경별 DB

| 환경 | 드라이버 | 연결 |
|------|---------|------|
| 로컬 개발 | SQLite + aiosqlite | `backend/data/ubb_pro.db` |
| 프로덕션 | PostgreSQL + asyncpg | Supabase (`DATABASE_URL` 환경변수) |

- ORM: SQLAlchemy 2.0 async (`DeclarativeBase` + `Mapped`)
- 세션: `database.py` → `async_session` → FastAPI `Depends(get_session)` 주입
- 마이그레이션: `backend/alembic/` (버전 파일 18개)

---

## 현재 활성 테이블

### watchlist — 관심종목 (핵심 엔티티)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | 자동 증가 |
| user_id | UUID nullable | Supabase 사용자 (nullable=공용) |
| market | VARCHAR(10) | KR / US / CRYPTO |
| symbol | VARCHAR(20) | 005930, AAPL, BTC/USDT |
| display_name | VARCHAR(100) | 표시명 |
| timeframe | VARCHAR(5) | 기본 1h |
| data_source | VARCHAR(20) | auto / yfinance / ccxt / pykrx |
| is_active | BOOL | 활성화 여부 |
| created_at | DATETIME | |

UNIQUE: `(market, symbol)`

---

### current_signal — 최신 신호 (대시보드 빠른 조회용)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| watchlist_id | INT PK,FK | watchlist.id (1:1) |
| signal_state | VARCHAR(10) | BUY / SELL / NEUTRAL |
| confidence | FLOAT | 신호 강도 0~100 |
| price | FLOAT | 현재가 |
| change_pct | FLOAT | 등락률 % |
| rsi | FLOAT | RSI(14) |
| bb_pct_b | FLOAT | 볼린저 %B |
| bb_width | FLOAT | 볼린저 밴드폭 |
| squeeze_level | INT | 스퀴즈 레벨 0~3 |
| macd_hist | FLOAT | MACD 히스토그램 |
| volume_ratio | FLOAT | 거래량 비율 |
| ema_20/50/200 | FLOAT | EMA 값 |
| updated_at | DATETIME | 마지막 업데이트 |

---

### signal_history — 신호 전환 이력

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| watchlist_id | INT FK | watchlist.id |
| signal_state | VARCHAR(10) | BUY / SELL / NEUTRAL |
| prev_state | VARCHAR(10) | 이전 상태 |
| confidence | FLOAT | |
| timeframe | VARCHAR(5) | |
| price / rsi / bb_* / ema_* | FLOAT | 감지 시점 지표 |
| detected_at | DATETIME | |

INDEX: `(watchlist_id, detected_at)`

---

### alert_log — 텔레그램 발송 이력

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| signal_history_id | INT FK nullable | signal_history.id |
| channel | VARCHAR(20) | telegram |
| alert_type | VARCHAR(20) | realtime / scheduled_buy 등 |
| message | TEXT | 메시지 전문 |
| sent_at | DATETIME | |
| success | BOOL | |
| error_message | TEXT | |
| symbol_count | INT | 배치 발송 시 종목 수 |

INDEX: `(sent_at)`

---

### ohlcv_cache — 차트 OHLCV 캔들 캐시

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| watchlist_id | INT FK | watchlist.id |
| timeframe | VARCHAR(5) | |
| timestamp | INT | Unix timestamp |
| open/high/low/close/volume | FLOAT | 캔들 데이터 |

UNIQUE: `(watchlist_id, timeframe, timestamp)`

---

### scan_snapshot — 전체 시장 스캔 실행 기록

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| status | VARCHAR(20) | running / completed / failed |
| total_symbols | INT | 전체 대상 종목 수 |
| scanned_count | INT | 스캔 완료 수 |
| picks_count | INT | SQ 추천 종목 수 |
| max_sq_count | INT | MAX SQ 종목 수 |
| buy_count | INT | chart_buy 종목 수 |
| error_message | TEXT | |
| started_at | DATETIME | |
| completed_at | DATETIME nullable | |

---

### scan_snapshot_item — 스캔 결과 종목별 데이터

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| snapshot_id | INT FK | scan_snapshot.id |
| category | VARCHAR(20) | **picks / max_sq / chart_buy** |
| symbol | VARCHAR(20) | |
| name | VARCHAR(100) | |
| market | VARCHAR(10) | KR / US / CRYPTO |
| market_type | VARCHAR(10) | KOSPI / KOSDAQ / US / CRYPTO |
| price / change_pct | FLOAT | |
| rsi / bb_pct_b / bb_width | FLOAT | |
| squeeze_level | INT | |
| macd_hist / volume_ratio | FLOAT | |
| confidence | FLOAT | 신뢰도 점수 |
| trend | VARCHAR(10) | BULL / BEAR / NEUTRAL |
| last_signal | VARCHAR(20) | BUY / SQZ BUY (chart_buy만) |
| last_signal_date | VARCHAR(10) | YYYY-MM-DD |

INDEX: `(snapshot_id, market_type, category)`

---

### stock_master — 종목 마스터 (검색용)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| symbol | VARCHAR(20) | |
| name | VARCHAR(100) | |
| market | VARCHAR(10) | KR / US |
| market_type | VARCHAR(10) | KOSPI/KOSDAQ/NASDAQ/NYSE/AMEX |
| is_etf | BOOL | ETF 여부 |
| updated_at | DATETIME | |

UNIQUE: `(market, symbol)` / INDEX: `(market, name)`

---

### user_profiles — Supabase 사용자 공개 정보

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | Supabase auth user id |
| email | VARCHAR(255) | |
| display_name | VARCHAR(100) nullable | |
| avatar_url | TEXT nullable | |
| created_at / last_seen_at | DATETIME(tz) | |

---

### user_alert_config — 사용자별 텔레그램 설정

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| user_id | UUID UNIQUE | |
| telegram_bot_token | TEXT nullable | |
| telegram_chat_id | VARCHAR(50) nullable | |
| is_active | BOOL | |
| created_at | DATETIME(tz) | server_default=now() |
| updated_at | DATETIME(tz) | onupdate=now() |

---

### user_position_state — 포지션 가이드 분할매수 상태

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| user_id | UUID | |
| symbol | VARCHAR(20) | |
| market | VARCHAR(10) | |
| completed_stages | JSONB | 완료된 단계 배열 |
| updated_at | DATETIME(tz) | |

UNIQUE: `(user_id, symbol, market)`

---

### pattern_case — BUY 신호 우수 사례 스크랩

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| title | VARCHAR(200) | |
| symbol / stock_name / market | VARCHAR | |
| pattern_type | VARCHAR(30) | custom 등 |
| signal_date | VARCHAR(10) | YYYY-MM-DD |
| entry_price / exit_price / result_pct | FLOAT | |
| hold_days | INT | |
| market_type | VARCHAR(20) nullable | ETF / STOCK 등 |
| rsi / bb_pct_b / bb_width / macd_hist / volume_ratio | FLOAT nullable | 지표 값 |
| ema_alignment | VARCHAR(10) nullable | EMA 정렬 상태 |
| squeeze_level | INT nullable | 스퀴즈 레벨 |
| conditions_met | INT nullable | 충족 조건 수 |
| tags / notes | TEXT nullable | |
| source | VARCHAR(20) | manual / auto |
| user_id | UUID nullable | |
| created_at / updated_at | DATETIME | |

INDEX: `(signal_date)`, `(pattern_type)`

---

### system_log — 시스템 이벤트 로그

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| level | VARCHAR(10) | INFO / WARN / ERROR |
| source | VARCHAR(30) | |
| message | TEXT | |
| details | TEXT | |
| created_at | DATETIME | |

INDEX: `(level, created_at)`

---

## 테이블 관계

```
watchlist ──┬── 1:1 ──► current_signal
            ├── 1:N ──► signal_history ── 1:0..1 ──► alert_log
            └── 1:N ──► ohlcv_cache

scan_snapshot ── 1:N ──► scan_snapshot_item

user_profiles ──► user_alert_config (user_id)
user_profiles ──► user_position_state (user_id)
user_profiles ──► watchlist.user_id (nullable)
```

## CASCADE 삭제

```
watchlist 삭제 시:
  → current_signal   CASCADE
  → signal_history   CASCADE → alert_log CASCADE
  → ohlcv_cache      CASCADE

scan_snapshot 삭제 시:
  → scan_snapshot_item  CASCADE
```

---

## 마이그레이션 이력 (주요)

| 파일 | 내용 |
|------|------|
| `761d49d4c43e_initial_schema.py` | 초기 스키마 |
| `1ac8ad4cd49b_add_scan_snapshot.py` | scan_snapshot 추가 |
| `37b24d3153b6_add_stock_master.py` | stock_master 추가 |
| `009_add_user_profiles.py` | Supabase 인증 연동 |
| `014_add_pattern_case.py` | 패턴 케이스 스크랩 |
| `78b47ebbdeb0_drop_daily_top_pick.py` | TopPicks 기능 제거 |
| `818ee1012c69_drop_trade_tables.py` | 매수 기록 테이블 제거 |

---

## 스키마 변경 시 주의사항

- 변경 전: `alembic revision --autogenerate -m "설명"`으로 마이그레이션 파일 생성
- NOT NULL 컬럼 추가 시 반드시 DEFAULT 값 지정
- SQLite는 `ALTER TABLE DROP COLUMN` 미지원 → Alembic batch 모드 사용
- PostgreSQL ↔ SQLite 양쪽 호환 확인 (JSONB → JSON 차이 등)
