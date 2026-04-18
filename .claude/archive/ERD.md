# UBB Pro Signal System — ERD

## 엔티티 관계 다이어그램

```mermaid
erDiagram
    watchlist {
        int id PK "자동 증가"
        string market "KR, US, CRYPTO"
        string symbol "005930, AAPL, BTC/USDT"
        string display_name "삼성전자, Apple, Bitcoin"
        string timeframe "15m, 30m, 1h, 4h, 1d"
        string data_source "auto, yfinance, ccxt, pykrx"
        boolean is_active "활성화 여부"
        datetime created_at "생성 시각"
    }

    current_signal {
        int watchlist_id PK,FK "watchlist.id (1:1)"
        string signal_state "BUY, SELL, NEUTRAL"
        float confidence "신호 강도 0~100"
        float price "현재가"
        float change_pct "등락률 %"
        float rsi "RSI(14)"
        float bb_pct_b "볼린저 %B"
        float bb_width "볼린저 밴드폭"
        int squeeze_level "스퀴즈 0~3"
        float macd_hist "MACD 히스토그램"
        float volume_ratio "거래량 비율"
        float ema_20 "EMA 20"
        float ema_50 "EMA 50"
        float ema_200 "EMA 200"
        datetime updated_at "마지막 업데이트"
    }

    signal_history {
        int id PK "자동 증가"
        int watchlist_id FK "watchlist.id"
        string signal_state "BUY, SELL, NEUTRAL"
        string prev_state "이전 상태"
        float confidence "신호 강도"
        string timeframe "타임프레임"
        float price "감지 시점 가격"
        float rsi "RSI"
        float bb_pct_b "%B"
        float bb_width "BBW"
        int squeeze_level "스퀴즈"
        float macd_hist "MACD"
        float volume_ratio "거래량"
        float ema_20 "EMA20"
        float ema_50 "EMA50"
        float ema_200 "EMA200"
        datetime detected_at "감지 시각"
    }

    alert_log {
        int id PK "자동 증가"
        int signal_history_id FK "signal_history.id"
        string channel "telegram"
        text message "메시지 전문"
        datetime sent_at "발송 시각"
        boolean success "성공 여부"
        text error_message "에러 내용"
    }

    ohlcv_cache {
        int id PK "자동 증가"
        int watchlist_id FK "watchlist.id"
        string timeframe "캔들 타임프레임"
        int timestamp "Unix timestamp"
        float open "시가"
        float high "고가"
        float low "저가"
        float close "종가"
        float volume "거래량"
    }

    daily_top_pick {
        int id PK "자동 증가"
        string scan_date "YYYY-MM-DD"
        string market_type "KOSPI, KOSDAQ, US"
        int rank "1, 2, 3"
        string symbol "종목코드"
        string name "종목명"
        float price "가격"
        float change_pct "등락률"
        string signal_state "SQUEEZE"
        float confidence "종합 점수"
        string grade "SQ Lv3"
        float rsi "RSI"
        float bb_pct_b "%B"
        int squeeze_level "스퀴즈 레벨"
        float macd_hist "MACD"
        float volume_ratio "거래량"
        datetime created_at "기록 시각"
    }

    trade_record {
        int id PK "자동 증가"
        int watchlist_id FK "watchlist.id"
        string status "ACTIVE, SOLD, CANCELLED"
        string start_signal "BUY, SQZ_BUY"
        float start_price "매수 시작 시점 가격"
        string start_date "매수 시작 일시"
        string sell_signal_date "SELL 신호 발생 일시"
        float sell_price "매도 시점 가격"
        string sell_date "매도 완료 일시"
        text memo "메모"
        datetime created_at "생성 시각"
    }

    trade_entry {
        int id PK "자동 증가"
        int trade_record_id FK "trade_record.id"
        int entry_no "매수 회차 1,2,3..."
        float price "매수 시점 가격"
        string entry_date "매수 일시"
        text memo "메모"
        datetime created_at "생성 시각"
    }

    system_log {
        int id PK "자동 증가"
        string level "INFO, WARN, ERROR"
        string source "fetcher, indicator, telegram, scheduler, webhook"
        text message "로그 메시지"
        text details "JSON 상세 정보"
        datetime created_at "발생 시각"
    }

    watchlist ||--o| current_signal : "1:1 최신 상태 캐시"
    watchlist ||--o{ signal_history : "1:N 신호 이력"
    watchlist ||--o{ ohlcv_cache : "1:N 캔들 캐시"
    watchlist ||--o{ trade_record : "1:N 매수 기록"
    signal_history ||--o| alert_log : "1:0..1 알림 기록"
    trade_record ||--o{ trade_entry : "1:N 분할매수 회차"
```

## 테이블 관계 요약

| 관계 | 카디널리티 | 설명 |
|------|-----------|------|
| `watchlist` → `current_signal` | 1:1 | 종목별 최신 신호 상태 (대시보드 빠른 조회용) |
| `watchlist` → `signal_history` | 1:N | 모든 신호 전환 이력 |
| `watchlist` → `ohlcv_cache` | 1:N | 차트 렌더링용 캔들 데이터 캐시 |
| `watchlist` → `trade_record` | 1:N | 종목별 매수 기록 (ACTIVE는 최대 1개) |
| `trade_record` → `trade_entry` | 1:N | 매수 기록별 분할매수 회차 |
| `signal_history` → `alert_log` | 1:0..1 | 신호 전환 시 텔레그램 발송 기록 |
| `daily_top_pick` | 독립 | 일일 시장 스캔 Top 종목 (코스피/코스닥/미국) |
| `system_log` | 독립 | 시스템 운영 이벤트 로그 |

## CASCADE 삭제

```
watchlist 삭제 시:
  → current_signal   CASCADE
  → signal_history   CASCADE
    → alert_log      CASCADE (signal_history 경유)
  → ohlcv_cache      CASCADE
  → trade_record     CASCADE
    → trade_entry    CASCADE (trade_record 경유)
```

## 인덱스

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| `watchlist` | UNIQUE(market, symbol) | 중복 종목 방지 |
| `signal_history` | (watchlist_id, detected_at DESC) | 종목별 최신 이력 |
| `ohlcv_cache` | UNIQUE(watchlist_id, timeframe, timestamp) | 캔들 UPSERT |
| `alert_log` | (sent_at DESC) | 최근 발송 이력 |
| `system_log` | (level, created_at DESC) | 레벨별 로그 |
| `daily_top_pick` | (scan_date, market_type) | 날짜별 추천 조회 |
| `trade_record` | (watchlist_id, status) | 종목별 활성 매수 기록 조회 |
