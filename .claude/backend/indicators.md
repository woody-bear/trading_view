---
purpose: 기술 지표(BB/RSI/MACD/Squeeze 등) 계산·민감도 프리셋·신호 엔진 설명.
reader: Claude가 지표를 추가·수정하거나 신호 판정 임계값을 조정할 때.
update-trigger: indicators/ 모듈·임계값 변경; sensitivity.json 갱신; 새 지표 추가.
last-audit: 2026-04-18
---

# Backend — 기술 지표 (indicators/)

> 소스: `backend/indicators/`

## 파일 목록

| 파일 | 지표 | 파라미터 |
|------|------|----------|
| `rsi.py` | RSI | period=14 |
| `bollinger.py` | Bollinger Bands | period=20, std=2.0 |
| `ema.py` | EMA | 20, 50, 200 |
| `macd.py` | MACD | fast=12, slow=26, signal=9 |
| `volume.py` | 거래량 비율 | 20일 평균 대비 |
| `signal_engine.py` | 신호 엔진 (관심종목) | 민감도 프리셋 |

---

## signal_engine.py — 관심종목 신호 엔진

관심종목(watchlist)에 대한 BUY/SELL 신호 판정.  
`services/scanner.py`에서 호출됨.

### 민감도 프리셋

| 설정 | 필요 조건 수 | RSI 매수 | RSI 매도 | BB 매수 | BB 매도 | 거래량 배수 |
|------|-------------|---------|---------|--------|--------|-----------|
| strict | 4/4 | < 30 | > 70 | < 0.05 | > 0.95 | × 1.2 |
| normal | 3/4 | < 35 | > 65 | < 0.15 | > 0.85 | × 1.1 |
| sensitive | 2/4 | < 40 | > 60 | < 0.25 | > 0.75 | × 1.0 |

민감도 설정은 `backend/data/settings.json`에 저장.  
설정 화면(`/settings`)에서 변경 가능.

### BUY 조건 (N개 충족)

1. BB %B ≤ 임계값 (하단 근접)
2. RSI < 임계값 (과매도)
3. MACD 히스토그램 > 이전값 (모멘텀 전환)
4. 거래량 > 임계값 × 20일 평균

### SELL 조건 (N개 충족)

1. BB %B ≥ 임계값 (상단 근접)
2. RSI > 임계값 (과매수)
3. MACD 히스토그램 < 이전값 (모멘텀 꺾임)
4. 거래량 > 임계값 × 20일 평균

### 신뢰도 등급

| 등급 | 점수 |
|------|------|
| STRONG | 90+ |
| NORMAL | 70+ |
| WEAK | 60+ |

---

## 스퀴즈 레벨 (Squeeze Pro)

`pandas_ta.squeeze_pro()` 기반 4단계 판정.

| 레벨 | 라벨 | 상태 |
|------|------|------|
| 0 | NO SQ | BB 확장 (스퀴즈 없음) |
| 1 | LOW SQ | 넓은 스퀴즈 |
| 2 | MID SQ | 보통 스퀴즈 |
| 3 | MAX SQ | 극한 압축 (폭발 임박) |

---

## 트렌드 판정 (_check_trend)

`full_market_scanner.py`의 내부 함수. signal_engine과는 별도.

```
BULL: EMA20 > EMA50 > EMA200 AND 가격 > EMA20 AND EMA20 기울기(5봉) > 0
BEAR: EMA20 < EMA50 < EMA200 AND 가격 < EMA20
NEUTRAL: 그 외
```

---

## 신뢰도 점수 계산 (picks용)

| 조건 | 점수 |
|------|------|
| 스퀴즈 레벨 × 25 | 최대 75 |
| BULL 트렌드 | +15 |
| RSI < 40 | +10 |
| BB %B < 0.3 | +5 |
| MACD > 0 | +5 |
| 거래량 비율 > 1.0 | +5 |

---

## 주의사항

- 전체 시장 스캔(`full_market_scanner.py`)과 관심종목 신호 엔진(`signal_engine.py`)은 **별도의 판정 로직**을 사용함
- 전체 스캔: Pine Script 시뮬레이션 방식 (`_check_buy_signal_precise`)
- 관심종목: 민감도 프리셋 기반 조건 합산 방식
- 차트 BUY 마커의 RSI 기준은 40 고정 (민감도 설정 미반영)
