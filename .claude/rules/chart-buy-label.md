---
purpose: 차트 BUY 라벨 표시 기준·RSI 민감도 프리셋·거래량 필터 — 보호된 규칙.
reader: Claude가 BUY 라벨 조건을 조정하기 전(사용자 승인 필수).
update-trigger: BUY 판정 조건·임계값 변경; 민감도 프리셋 값 변경; 거래량 필터 배수 변경.
last-audit: 2026-04-18
requires-approval: true
protected-since: 2026-04-12
---

# Rules — 차트 BUY 라벨 표시 기준

> ⚠️ **이 파일은 보호된 비즈니스 규칙입니다.**  
> 수정 시 반드시 사용자에게 확인 후 진행하세요.

소스: `backend/routes/charts.py:_simulate_signals`, `backend/services/full_market_scanner.py:_analyze_ticker`

---

## 두 가지 BUY 표시 시스템

| 위치 | 로직 | 용도 |
|------|------|------|
| 차트 마커 (BUY ↑) | `routes/charts.py:_simulate_signals` | 차트 캔들 아래 초록 화살표 |
| 전체 스캔 chart_buy | `full_market_scanner.py:_analyze_ticker` | 스캔 결과 목록 표시 |

---

## 1. 차트 마커 BUY 조건 (_simulate_signals)

### Regular BUY

```python
# BB 터치/돌파 + RSI 필터 + 모멘텀 상승
(bb_buy_touch AND rsi_buy_filter AND mom_rising)
OR
(bb_buy_reverse AND rsi_buy_filter)
```

| 조건 | 설명 |
|------|------|
| `bb_buy_touch` | `low <= BB하단` 또는 `close가 BB하단을 위→아래로 관통` |
| `bb_buy_reverse` | `close가 BB하단을 아래→위로 복귀 (전봉 close ≤ BB하단, 현봉 close > BB하단)` |
| `rsi_buy_filter` | `RSI < rsi_buy_threshold` (민감도 프리셋: strict=30, normal=35, sensitive=40) |
| `mom_rising` | `MACD 모멘텀(EMA12-EMA26) > 이전봉` |

### SQZ BUY

```python
sqz_fired AND mom_bull AND mom_rising
```

| 조건 | 설명 |
|------|------|
| `sqz_fired` | `현봉 squeeze==0 AND 전봉 squeeze>0` (스퀴즈 해제) |
| `mom_bull` | `모멘텀(EMA12-EMA26) > 0` |
| `mom_rising` | `모멘텀 > 이전봉 모멘텀` |

### 쿨다운 규칙

- 쿨다운 기간: **5봉**
- BUY/SQZ BUY 신호 후 5봉 이내 BUY 재발생 없음
- BUY → SELL 전환은 쿨다운과 무관하게 즉시 허용

### 민감도 프리셋별 RSI 기준

| 설정 | RSI Buy Threshold |
|------|------------------|
| strict | < 30 |
| normal | < 35 |
| sensitive | < 40 |

> 민감도는 `backend/indicators/sensitivity.json` 파일로 관리.  
> `load_sensitivity()` 함수로 읽어서 프리셋 적용.

---

## 2. 전체 스캔 chart_buy 분류 기준 (_analyze_ticker)

### 판정 파이프라인

```
[1] _is_dead_cross(ema)
    → EMA5 < EMA10 < EMA20 < EMA60 < EMA120 (5선 전체 역배열) 이면 즉시 None 반환 (전체 스킵)

[2] _check_buy_signal_precise(df, last_rsi, last_sq)
    → Pine Script 시뮬레이션(_simulate_signals) 실행
    → 마지막 마커가 BUY 또는 SQZ BUY
    → 신호 발생일이 10거래일 이내

[2.5] _is_pullback(ema) — 눌림목 필터
    → EMA20 > EMA60 > EMA120 (장기 상승추세)
    → EMA5 현재값 < 직전값 (단기 눌림)
    → 두 조건 모두 불충족 시 chart_buy 제외

[3] _passes_volume_filter(df, buy_date)
    → 신호 발생일 거래량 > 직전 5거래일 평균 × 1.5
    → 거래량 데이터 없거나 신규상장 등 → True (필터 패스)

모두 통과 → "chart_buy" 카테고리
```

### 사전 필터 (제외 조건)

```python
# 1. 캔들 수 부족 → 분석 자체 제외
len(df) < 60  → _extract()에서 None 반환

# 2. RSI 과열 + 스퀴즈 없음 → 신호 탐색 스킵
last_rsi >= 80 AND last_sq == 0  → (None, None) 반환
```

### 거래량 필터 관용 조건

`_passes_volume_filter()`는 아래 경우 **True 반환** (필터 통과 처리):
- 신호일을 데이터에서 찾을 수 없는 경우
- 신호가 첫 번째 봉인 경우 (비교 대상 없음)
- 직전 5일 중 거래량 > 0인 봉이 없는 경우
- 신호일 거래량이 0인 경우 (신규상장, 거래정지 후 재개 등)

### 세부 조건

#### Dead Cross 체크 (5선 전체 역배열)
```python
EMA5 < EMA10 < EMA20 < EMA60 < EMA120  → True면 전체 스킵
```

#### 눌림목 체크 (_is_pullback)
```python
# 장기 상승추세
EMA20 > EMA60 > EMA120
# 단기 눌림
ema_5.iloc[-1] < ema_5.iloc[-2]
# 둘 다 True여야 chart_buy 포함
```

#### 신호 탐색 범위
```python
# 10거래일 이내 (주말/공휴일 자동 제외)
trading_days_since = len(df) - 1 - signal_bar_index
signal_valid = trading_days_since <= 10
```

#### 거래량 필터
```python
avg_vol = prior_5day_nonzero_volumes.mean()
signal_day_vol > avg_vol * 1.5  → True면 통과
```

#### 데이터 신선도 체크 (스캔에서만)
```python
# 마지막 봉이 7일 이상 오래됐으면 stale → 신호 탐색 스킵
(today_utc - last_bar_date).days > 7  → (None, None) 반환
```

---

## 라벨 표시 형식

| 라벨 | 위치 | 색상 | 모양 |
|------|------|------|------|
| BUY | 봉 아래 | #22c55e (초록) | ↑ arrowUp |
| SQZ BUY | 봉 아래 | #22c55e (초록) | ↑ arrowUp |

---

## 주의사항

- 차트 마커는 차트 조회 시 실시간 계산 — DB에 저장 안 됨
- 전체 스캔 chart_buy는 DB 스냅샷에 저장 (`scan_snapshot_items` 테이블)
- 차트 마커의 BUY ≠ 전체 스캔 chart_buy (타이밍 차이 가능)
- RSI 기준은 민감도 설정에 따라 다름 (차트/스캔 모두 동일 `load_sensitivity()` 사용)
