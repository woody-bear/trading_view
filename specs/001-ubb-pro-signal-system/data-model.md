# 데이터 모델: UBB Pro Signal System

**피처**: `001-ubb-pro-signal-system` | **날짜**: 2026-03-16

## 엔티티 관계도

```text
watchlist (1) ──── (1) current_signal
    │
    ├── (1) ──── (N) signal_history
    │                    │
    │                    └── (1) ──── (0..1) alert_log
    │
    └── (1) ──── (N) ohlcv_cache       ← 차트 데이터용 캔들 캐시

system_log (독립 — 다른 엔티티와 관계 없음)
```

## 엔티티 상세

### 1. 워치리스트 (Watchlist)

모니터링 대상 종목을 관리하는 핵심 엔티티.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | 정수 (PK) | O | 자동 증가 기본키 |
| market | 문자열 | O | 시장 구분: 'KR', 'US', 'CRYPTO' |
| symbol | 문자열 | O | 종목 식별자: '005930', 'AAPL', 'BTC/USDT' |
| display_name | 문자열 | X | 표시명: '삼성전자', 'Apple', 'Bitcoin' |
| timeframe | 문자열 | O | 분석 타임프레임. 기본값 '1h'. 허용: '15m', '30m', '1h', '4h', '1d' |
| data_source | 문자열 | O | 데이터 소스 설정. 기본값 'auto'. 허용: 'auto', 'yfinance', 'ccxt', 'pykrx' |
| is_active | 불리언 | O | 활성화 여부. 기본값 true |
| created_at | 타임스탬프 | O | 생성 시각. 자동 기록 |

**제약 조건**:
- (market, symbol) 조합은 유일해야 함
- market은 'KR', 'US', 'CRYPTO' 중 하나
- timeframe은 '15m', '30m', '1h', '4h', '1d' 중 하나

**검증 규칙**:
- KR 시장: symbol은 6자리 숫자 (예: '005930')
- US 시장: symbol은 1~5자 영문 대문자 (예: 'AAPL')
- CRYPTO 시장: symbol은 '기호/기호' 형식 (예: 'BTC/USDT')
- 종목 추가 시 데이터 소스를 통한 유효성 검증 필수

---

### 2. 현재 신호 (Current Signal)

각 워치리스트 종목의 최신 신호 상태 캐시. 대시보드 빠른 조회용.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| watchlist_id | 정수 (PK, FK) | O | watchlist.id 참조. 1:1 관계 |
| signal_state | 문자열 | O | 현재 신호 상태: 'BUY', 'SELL', 'NEUTRAL' |
| confidence | 실수 | X | 신호 강도 점수 0~100 |
| price | 실수 | X | 현재가 |
| change_pct | 실수 | X | 등락률 (%) |
| rsi | 실수 | X | RSI 값 |
| bb_pct_b | 실수 | X | 볼린저밴드 %B 값 |
| bb_width | 실수 | X | 볼린저밴드 폭 |
| squeeze_level | 정수 | X | 스퀴즈 단계 0~3 (NO/LOW/MID/HIGH) |
| macd_hist | 실수 | X | MACD 히스토그램 값 |
| volume_ratio | 실수 | X | 거래량 비율 (20일 평균 대비) |
| ema_20 | 실수 | X | EMA 20 값 |
| ema_50 | 실수 | X | EMA 50 값 |
| ema_200 | 실수 | X | EMA 200 값 |
| updated_at | 타임스탬프 | O | 마지막 업데이트 시각 |

**상태 전이 규칙**:
```text
          ┌─────────────────────┐
          │                     │
          ▼                     │
    ┌──────────┐          ┌──────────┐
    │ NEUTRAL  │◄────────►│   BUY    │
    └──────────┘          └──────────┘
          ▲                     ▲
          │                     │
          ▼                     │
    ┌──────────┐                │
    │   SELL   │◄───────────────┘
    └──────────┘
    (모든 방향 전환 가능)
```

- NEUTRAL → BUY: 매수 필수 조건 4개 모두 충족 + confidence ≥ 60
- NEUTRAL → SELL: 매도 필수 조건 4개 모두 충족 + confidence ≥ 60
- BUY → NEUTRAL: RSI > 50 AND 가격 > BB 중간선, 또는 MACD 하락 전환
- SELL → NEUTRAL: RSI < 50 AND 가격 < BB 중간선, 또는 MACD 상승 전환
- BUY → SELL: 매도 조건 충족 시 직접 전환 (NEUTRAL 경유 없이)
- SELL → BUY: 매수 조건 충족 시 직접 전환 (NEUTRAL 경유 없이)

---

### 3. 신호 이력 (Signal History)

모든 신호 판정 기록. 시간순 이력 추적용.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | 정수 (PK) | O | 자동 증가 기본키 |
| watchlist_id | 정수 (FK) | O | watchlist.id 참조 |
| signal_state | 문자열 | O | 판정된 신호: 'BUY', 'SELL', 'NEUTRAL' |
| prev_state | 문자열 | X | 이전 신호 상태 |
| confidence | 실수 | X | 신호 강도 점수 0~100 |
| timeframe | 문자열 | X | 분석 타임프레임 |
| price | 실수 | X | 감지 시점 가격 |
| rsi | 실수 | X | RSI 값 |
| bb_pct_b | 실수 | X | %B 값 |
| bb_width | 실수 | X | BBW 값 |
| squeeze_level | 정수 | X | 스퀴즈 단계 |
| macd_hist | 실수 | X | MACD 히스토그램 |
| volume_ratio | 실수 | X | 거래량 비율 |
| ema_20 | 실수 | X | EMA 20 |
| ema_50 | 실수 | X | EMA 50 |
| ema_200 | 실수 | X | EMA 200 |
| detected_at | 타임스탬프 | O | 신호 감지 시각. 자동 기록 |

**인덱스**: (watchlist_id, detected_at DESC) — 종목별 최신 이력 조회 최적화

---

### 4. 알림 로그 (Alert Log)

텔레그램 발송 기록.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | 정수 (PK) | O | 자동 증가 기본키 |
| signal_history_id | 정수 (FK) | O | signal_history.id 참조 |
| channel | 문자열 | O | 발송 채널: 'telegram' |
| message | 문자열 | X | 발송 메시지 전문 |
| sent_at | 타임스탬프 | O | 발송 시각. 자동 기록 |
| success | 불리언 | O | 발송 성공 여부. 기본값 true |
| error_message | 문자열 | X | 실패 시 에러 내용 |

**인덱스**: (sent_at DESC) — 최근 발송 이력 조회 최적화

---

### 5. 시스템 로그 (System Log)

운영 이벤트 기록. 다른 엔티티와 관계 없는 독립 테이블.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | 정수 (PK) | O | 자동 증가 기본키 |
| level | 문자열 | O | 로그 레벨: 'INFO', 'WARN', 'ERROR' |
| source | 문자열 | X | 발생 출처: 'fetcher', 'indicator', 'telegram', 'scheduler', 'webhook' |
| message | 문자열 | O | 로그 메시지 |
| details | 문자열 | X | JSON 형태 상세 정보 |
| created_at | 타임스탬프 | O | 발생 시각. 자동 기록 |

**인덱스**: (level, created_at DESC) — 레벨별 최신 로그 조회 최적화

---

### 6. OHLCV 캐시 (OHLCV Cache)

차트 렌더링을 위한 캔들 데이터 캐시. 매 스캔 시 수집된 OHLCV 데이터를 저장하여 차트 API 호출 시 외부 데이터 소스 재호출 없이 즉시 응답.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | 정수 (PK) | O | 자동 증가 기본키 |
| watchlist_id | 정수 (FK) | O | watchlist.id 참조 |
| timeframe | 문자열 | O | 캔들 타임프레임: '15m', '30m', '1h', '4h', '1d' |
| timestamp | 정수 | O | 캔들 시작 시각 (Unix timestamp) |
| open | 실수 | O | 시가 |
| high | 실수 | O | 고가 |
| low | 실수 | O | 저가 |
| close | 실수 | O | 종가 |
| volume | 실수 | O | 거래량 |

**제약 조건**:
- (watchlist_id, timeframe, timestamp) 조합은 유일해야 함 (UPSERT로 업데이트)

**인덱스**: (watchlist_id, timeframe, timestamp DESC) — 종목별 최신 캔들 조회 최적화

**데이터 관리**:
- 종목당 최대 500개 캔들 유지 (오래된 캔들 자동 정리)
- 차트 API에서 이 캐시를 읽어 지표를 실시간 계산하여 반환 (지표 값은 캐시하지 않음)

---

## 신호 강도 (Confidence) 계산 모델

```text
점수 산정 (0~100):

  필수 조건 (각 20점, 최대 80점):
    ├─ BB 조건 충족 (하단/상단 터치): +20
    ├─ RSI 조건 충족 (<30 또는 >70): +20
    ├─ MACD 히스토그램 전환: +20
    └─ 거래량 > 20일 평균 1.2배: +20

  선택 보너스 (최대 +20점):
    ├─ 스퀴즈 해제 + 방향 일치: +15
    └─ EMA 정배열(매수)/역배열(매도): +5

  RSI 극단치 가산 (최대 +10점):
    ├─ 매수: RSI < 20 → +10, RSI < 25 → +5
    └─ 매도: RSI > 80 → +10, RSI > 75 → +5

  최종 점수 = min(100, 합산)

등급 분류:
  90~100: STRONG (강력)
  70~89:  NORMAL (일반)
  60~69:  WEAK (약한 신호)
  < 60:   미발생 (조건 불충족)
```

## 스퀴즈 단계 모델

```text
BB 밴드폭과 KC(켈트너채널) 밴드폭 비교로 4단계 판별:

  KC 배수별 밴드:
    KC_LOW  = KC(20, 1.5배)
    KC_MID  = KC(20, 2.0배)
    KC_HIGH = KC(20, 3.0배)

  스퀴즈 판정:
    0 (NO):   BB 밴드가 KC_LOW 밖 — 변동성 정상
    1 (LOW):  BB 밴드가 KC_LOW 안, KC_MID 밖 — 약한 압축
    2 (MID):  BB 밴드가 KC_MID 안, KC_HIGH 밖 — 중간 압축
    3 (HIGH): BB 밴드가 KC_HIGH 안 — 강한 압축 (폭발 임박)
```
