# ERD (엔티티 관계 다이어그램): UBB Pro Signal System

**피처**: `001-ubb-pro-signal-system` | **날짜**: 2026-03-16

## 전체 ERD

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          watchlist                                   │
├─────────────────────────────────────────────────────────────────────┤
│ PK  id              INTEGER  AUTO INCREMENT                         │
│     market           TEXT     NOT NULL  ('KR','US','CRYPTO')        │
│     symbol           TEXT     NOT NULL                               │
│     display_name     TEXT     NULLABLE                               │
│     timeframe        TEXT     DEFAULT '1h'                           │
│     data_source      TEXT     DEFAULT 'auto'                         │
│     is_active        BOOLEAN  DEFAULT TRUE                          │
│     created_at       DATETIME DEFAULT CURRENT_TIMESTAMP              │
├─────────────────────────────────────────────────────────────────────┤
│ UQ  (market, symbol)                                                │
└──────────┬──────────────────┬──────────────────┬────────────────────┘
           │ 1:1              │ 1:N              │ 1:N
           ▼                  ▼                  ▼
┌──────────────────┐ ┌────────────────────┐ ┌────────────────────────┐
│  current_signal   │ │  signal_history     │ │     ohlcv_cache        │
├──────────────────┤ ├────────────────────┤ ├────────────────────────┤
│PK watchlist_id INT│ │PK id         INT   │ │PK id           INT     │
│FK →watchlist(id)  │ │FK watchlist_id INT │ │FK watchlist_id INT     │
│                   │ │   →watchlist(id)   │ │   →watchlist(id)       │
│   signal_state TXT│ │                    │ │                        │
│   confidence REAL │ │   signal_state TXT │ │   timeframe     TEXT   │
│   price      REAL │ │   prev_state  TXT  │ │   timestamp     INT    │
│   change_pct REAL │ │   confidence  REAL │ │   open          REAL   │
│   rsi        REAL │ │   timeframe   TXT  │ │   high          REAL   │
│   bb_pct_b   REAL │ │   price       REAL │ │   low           REAL   │
│   bb_width   REAL │ │   rsi         REAL │ │   close         REAL   │
│   squeeze_lvl INT │ │   bb_pct_b    REAL │ │   volume        REAL   │
│   macd_hist  REAL │ │   bb_width    REAL │ ├────────────────────────┤
│   volume_ratio REAL│ │   squeeze_lvl INT │ │UQ (watchlist_id,       │
│   ema_20     REAL │ │   macd_hist   REAL │ │    timeframe,          │
│   ema_50     REAL │ │   volume_ratio REAL│ │    timestamp)          │
│   ema_200    REAL │ │   ema_20      REAL │ │IDX (watchlist_id,      │
│   updated_at DT   │ │   ema_50      REAL │ │     timeframe,         │
└──────────────────┘ │   ema_200     REAL │ │     timestamp DESC)    │
                      │   detected_at DT   │ └────────────────────────┘
                      ├────────────────────┤
                      │IDX (watchlist_id,   │
                      │     detected_at DESC)│
                      └─────────┬──────────┘
                                │ 1:0..1
                                ▼
                      ┌────────────────────┐
                      │    alert_log        │
                      ├────────────────────┤
                      │PK id           INT │
                      │FK signal_history_id│
                      │   →signal_history  │
                      │   (id)             │
                      │                    │
                      │   channel     TEXT  │
                      │   message     TEXT  │
                      │   sent_at     DT   │
                      │   success     BOOL  │
                      │   error_msg   TEXT  │
                      ├────────────────────┤
                      │IDX (sent_at DESC)  │
                      └────────────────────┘


┌─────────────────────────────────────────┐
│            system_log (독립)             │
├─────────────────────────────────────────┤
│ PK  id          INTEGER  AUTO INCREMENT │
│     level        TEXT     NOT NULL       │
│     source       TEXT     NULLABLE       │
│     message      TEXT     NOT NULL       │
│     details      TEXT     NULLABLE (JSON)│
│     created_at   DATETIME DEFAULT NOW    │
├─────────────────────────────────────────┤
│ IDX (level, created_at DESC)            │
└─────────────────────────────────────────┘
```

## 관계 요약

| 관계 | 카디널리티 | 설명 |
|------|-----------|------|
| watchlist → current_signal | 1:1 | 각 종목의 최신 신호 상태 캐시 |
| watchlist → signal_history | 1:N | 종목별 모든 신호 판정 이력 |
| watchlist → ohlcv_cache | 1:N | 종목별 캔들 데이터 캐시 (차트용) |
| signal_history → alert_log | 1:0..1 | 신호 전환 시 알림 발송 기록 (NEUTRAL 전환은 미발송) |
| system_log | 독립 | 시스템 운영 이벤트, 다른 테이블과 FK 없음 |

## 인덱스 전략

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| watchlist | UQ (market, symbol) | 중복 종목 방지 |
| signal_history | (watchlist_id, detected_at DESC) | 종목별 최신 이력 조회 |
| ohlcv_cache | UQ (watchlist_id, timeframe, timestamp) | 캔들 UPSERT + 중복 방지 |
| ohlcv_cache | (watchlist_id, timeframe, timestamp DESC) | 차트 데이터 조회 최적화 |
| alert_log | (sent_at DESC) | 최근 발송 이력 조회 |
| system_log | (level, created_at DESC) | 레벨별 최신 로그 조회 |

## CASCADE 삭제 정책

```text
watchlist 삭제 시:
  → current_signal   CASCADE 삭제
  → signal_history   CASCADE 삭제
    → alert_log      CASCADE 삭제 (signal_history 경유)
  → ohlcv_cache      CASCADE 삭제
```

## 상태 전이 다이어그램 (current_signal.signal_state)

```text
                    매수 조건 4개 충족
                    confidence ≥ 60
              ┌────────────────────────┐
              │                        │
              ▼                        │
        ┌──────────┐            ┌──────────┐
   ┌───►│ NEUTRAL  │◄──────────│   BUY    │
   │    └──────────┘  RSI>50 & └──────────┘
   │         │        Price>BB     ▲    │
   │         │        중간선       │    │
   │         │        또는 MACD    │    │
   │         │        하락전환     │    │
   │         │                    │    │
   │    매도 조건     매수 조건    │    매도 조건
   │    4개 충족     4개 충족     │    4개 충족
   │    conf≥60     conf≥60      │    conf≥60
   │         │                    │    │
   │         ▼                    │    ▼
   │    ┌──────────┐              │
   └────│   SELL   │──────────────┘
 RSI<50 └──────────┘  매수 조건 4개 충족
 &Price                (직접 전환)
 <BB중간
 또는 MACD
 상승전환
```

## 데이터 생명주기

```text
1. 종목 등록 (워치리스트)
   watchlist INSERT → is_active=TRUE

2. 스캔 주기마다 (10분 간격)
   ┌─ ohlcv_cache UPSERT (최대 500캔들 유지)
   ├─ current_signal UPSERT (최신 지표값 + 신호 상태)
   ├─ signal_history INSERT (상태 전환 시에만)
   └─ alert_log INSERT (텔레그램 발송 시에만)

3. 종목 삭제
   watchlist DELETE → CASCADE로 모든 관련 데이터 삭제

4. 정리 작업
   ohlcv_cache: 종목당 500캔들 초과 시 오래된 데이터 DELETE
   system_log: 보존 기간 정책 없음 (로컬 시스템, 수동 정리)
```
