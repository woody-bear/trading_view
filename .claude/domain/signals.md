---
purpose: BUY/SELL 신호 판정 조건·쿨다운·민감도 프리셋의 의미와 계산 근거.
reader: Claude가 신호 판정 규칙을 조정하거나 파라미터 의미를 이해할 때.
update-trigger: 판정 조건(BB/RSI/Squeeze 등) 변경; 쿨다운 봉 수 변경; 민감도 프리셋 값 변경.
last-audit: 2026-04-18
---

# Domain — 신호 엔진 동작 방식

> 소스: `backend/indicators/signal_engine.py`, `backend/routes/charts.py`

## 두 가지 신호 판정 시스템

| 시스템 | 위치 | 용도 |
|--------|------|------|
| **Pine Script 시뮬레이션** | `routes/charts.py:_simulate_signals` | 차트 BUY/SELL 마커, 전체 스캔 판정 |
| **신호 엔진 프리셋** | `indicators/signal_engine.py` | 관심종목 신호 상태 (BUY/SELL/NEUTRAL) |

---

## Pine Script 시뮬레이션 (_simulate_signals)

TradingView Pine Script 전략을 Python으로 재현한 로직.  
**차트 마커**와 **전체 스캔 chart_buy 판정**에 사용.

### BUY 신호 조건

```python
# Regular BUY
close <= lower_band AND RSI < 40
OR
전봉 close < lower_band AND 현봉 close > lower_band AND RSI < 40  # 하단 복귀

# SQZ BUY
직전봉 squeeze > 0 AND 현재봉 squeeze == 0  # 스퀴즈 해제
AND MACD 히스토그램 > 0  # 양수 모멘텀
```

### SELL 신호 조건

```python
# Regular SELL
close >= upper_band AND RSI > 60
OR
전봉 close > upper_band AND 현봉 close < upper_band AND RSI > 60  # 상단 복귀

# SQZ SELL
직전봉 squeeze > 0 AND 현재봉 squeeze == 0
AND MACD 히스토그램 < 0  # 음수 모멘텀
```

### 쿨다운

- 동일 방향 신호 **5봉** 이내 중복 방지
- 예: BUY 신호 후 5봉 이내에는 BUY 신호 재발생 안 함

### RSI 기준

- 차트 마커의 RSI 기준: **40 고정** (민감도 설정 미반영)
- 관심종목 신호 엔진의 RSI: 민감도 프리셋에 따라 30~40 가변

---

## 스퀴즈 레벨 판정

`pandas_ta.squeeze_pro()` 4단계:

| 레벨 | 의미 | 색상 |
|------|------|------|
| 0 (NO SQ) | BB 확장 (에너지 방출 중) | 회색 |
| 1 (LOW SQ) | 넓은 스퀴즈 | 노랑 |
| 2 (MID SQ) | 보통 스퀴즈 | 주황 |
| 3 (MAX SQ) | 극한 압축 (폭발 임박) | 빨강 |

---

## EMA 기반 추가 필터

### Dead Cross 필터

```python
def _is_dead_cross(ema: dict) -> bool:
    return float(ema["ema_20"].iloc[-1]) < float(ema["ema_50"].iloc[-1])
# Dead Cross이면 chart_buy 전체 스킵
```

---

## 지표 파라미터 요약

| 지표 | 파라미터 |
|------|----------|
| Bollinger Bands | period=20, std=2.0 |
| RSI | period=14 |
| MACD | fast=12, slow=26, signal=9 |
| EMA | 20, 50, 200 |
| Squeeze Pro | pandas_ta 기본값 |
| 거래량 평균 기간 | 5거래일 |
| 거래량 배수 | 1.5× |

---

## 주의사항

- `_simulate_signals`(차트 마커)와 `signal_engine`(관심종목)은 **별도 로직**
- 차트에 표시되는 BUY 마커 ≠ 관심종목 신호 상태 변경의 트리거가 아님
- 관심종목 신호는 30분마다 `signal_engine`이 계산 → `current_signal` 테이블 업데이트
- 차트 마커는 차트 조회 시 `_simulate_signals`가 실시간 계산 → DB에 저장 안 됨
