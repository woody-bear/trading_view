---
purpose: 차트 SELL 라벨 표시 기준·RSI 고정값(60)·BB 복귀 판정 — 보호된 규칙.
reader: Claude가 SELL 라벨 조건을 조정하기 전(사용자 승인 필수).
update-trigger: SELL 판정 조건 변경; RSI 고정값 변경; 쿨다운 봉 수 변경.
last-audit: 2026-04-18
requires-approval: true
protected-since: 2026-04-12
---

# Rules — 차트 SELL 라벨 표시 기준

> ⚠️ **이 파일은 보호된 비즈니스 규칙입니다.**  
> 수정 시 반드시 사용자에게 확인 후 진행하세요.

소스: `backend/routes/charts.py:_simulate_signals`

---

## SELL 마커 조건 (_simulate_signals)

### Regular SELL

```python
(bb_sell_touch AND rsi_sell_filter AND mom_falling)
OR
(bb_sell_reverse AND rsi_sell_filter)
```

| 조건 | 설명 |
|------|------|
| `bb_sell_touch` | `high >= BB상단` 또는 `close가 BB상단을 아래→위로 관통` |
| `bb_sell_reverse` | `close가 BB상단을 위→아래로 복귀 (전봉 close ≥ BB상단, 현봉 close < BB상단)` |
| `rsi_sell_filter` | `RSI > 60` (고정값 — 민감도 설정 미반영) |
| `mom_falling` | `모멘텀(EMA12-EMA26) < 이전봉 모멘텀` |

### SQZ SELL

```python
sqz_fired AND mom_bear AND mom_falling
```

| 조건 | 설명 |
|------|------|
| `sqz_fired` | `현봉 squeeze==0 AND 전봉 squeeze>0` (스퀴즈 해제) |
| `mom_bear` | `모멘텀(EMA12-EMA26) ≤ 0` |
| `mom_falling` | `모멘텀 < 이전봉 모멘텀` |

---

## BB 상단 조건 상세

```python
# crossover(close, upperBB) = close가 아래→위로 관통
bb_cross_over = close_now > bbu and close_prev <= bbu_prev

# 상단 터치 = high가 BB상단 이상 OR crossover
bb_sell_touch = high_now >= bbu or bb_cross_over

# 상단 복귀 = close가 위→아래로 복귀
bb_sell_reverse = close_now < bbu and close_prev >= bbu_prev
```

---

## 쿨다운 규칙

- BUY와 동일: **5봉** 쿨다운
- 마지막 신호 방향이 SELL이면 SELL 재발생 없음
- SELL → BUY 전환은 쿨다운과 무관하게 허용 (방향 전환이므로)

---

## RSI 기준 비대칭

| 방향 | RSI 기준 | 민감도 반영 |
|------|---------|-----------|
| BUY | < 30/35/40 (프리셋별) | ✅ 반영 |
| SELL | > 60 | ❌ 고정값 |

> SELL RSI 기준(60)은 민감도 설정과 무관하게 항상 고정.

---

## 라벨 표시 형식

| 라벨 | 위치 | 색상 | 모양 |
|------|------|------|------|
| SELL | 봉 위 | #ef4444 (빨강) | ↓ arrowDown |
| SQZ SELL | 봉 위 | #ef4444 (빨강) | ↓ arrowDown |

---

## 지표 파라미터

| 지표 | 파라미터 |
|------|----------|
| Bollinger Bands | period=20, std=2.0 |
| RSI | period=14 |
| 모멘텀 | EMA12 - EMA26 (MACD 모멘텀선) |
| 스퀴즈 | pandas_ta.squeeze_pro() 기본값 |

---

## 전체 스캔에서 SELL 미사용

> 전체 스캔(`full_market_scanner.py`)은 SELL 카테고리를 사용하지 않음.  
> SELL 신호 탐지는 차트 마커 표시용으로만 사용되며, 스캔 결과에 영향 없음.
