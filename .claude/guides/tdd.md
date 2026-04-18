---
purpose: 테스트 전략·테스트 파일 구조·실행 명령 가이드.
reader: Claude가 테스트를 추가·수정하거나 테스트 실행 방법을 확인할 때.
update-trigger: 테스트 프레임워크 변경; 테스트 디렉터리 구조 변경; 실행 명령 변경.
last-audit: 2026-04-18
---

# TDD 접근 방식

> 이 프로젝트의 테스트 전략.

---

## 테스트 디렉토리

```
backend/tests/          ← 테스트 파일 위치 (현재 신규 생성 중)
```

---

## 백엔드 테스트 전략

### 테스트 우선순위

1. **지표 계산 로직** — 핵심 비즈니스 로직, 사이드이펙트 없음
   - `indicators/bollinger.py`, `indicators/rsi.py`, `indicators/macd.py`
   - `indicators/ema.py`, `indicators/volume.py`
   - 입력 DataFrame → 출력 Series 검증

2. **신호 판정 로직** — BUY/SELL 조건 검증
   - `routes/charts.py:_simulate_signals`
   - `services/full_market_scanner.py:_analyze_ticker`
   - 알려진 패턴의 시세 데이터로 신호 발생 여부 확인

3. **API 엔드포인트** — 라우터 응답 형식 검증
   - FastAPI TestClient 활용
   - 인증 없는 엔드포인트 위주

### 테스트 파일 구조

```
backend/tests/
  conftest.py          — pytest fixtures (DB, 샘플 데이터)
  test_indicators.py   — 지표 계산 단위 테스트
  test_signals.py      — 신호 판정 로직 테스트
  test_api.py          — API 엔드포인트 통합 테스트
```

### 기본 테스트 패턴

```python
# test_indicators.py
import pandas as pd
import pytest
from indicators.rsi import calculate_rsi

def make_df(closes: list[float]) -> pd.DataFrame:
    return pd.DataFrame({"close": closes, "open": closes, "high": closes, "low": closes, "volume": [1000]*len(closes)})

def test_rsi_range():
    df = make_df([100 + i * 0.1 for i in range(50)])
    rsi = calculate_rsi(df)
    last = float(rsi.iloc[-1])
    assert 0 <= last <= 100, f"RSI out of range: {last}"

def test_rsi_overbought():
    # 계속 상승 → RSI 높아야 함
    df = make_df([100 + i * 2 for i in range(50)])
    rsi = calculate_rsi(df)
    assert float(rsi.iloc[-1]) > 60
```

### 신호 테스트 패턴

```python
# test_signals.py
from routes.charts import _simulate_signals

def test_buy_signal_on_bb_touch():
    # BB 하단 터치 + RSI 낮은 상황 재현
    ...
    markers = _simulate_signals(df, timestamps, indicators, "1d")
    buy_markers = [m for m in markers if m["text"] in ("BUY", "SQZ BUY")]
    assert len(buy_markers) > 0
```

---

## 테스트 실행

```bash
cd backend
pytest tests/ -v
pytest tests/test_indicators.py -v    # 지표만
pytest tests/ -k "test_rsi"           # 키워드 필터
pytest tests/ --tb=short              # 짧은 트레이스백
```

---

## 규칙

- DB 모킹 금지 — 실제 SQLite로 테스트 (`:memory:` 또는 `test.db`)
- 외부 API(yfinance, KIS) 호출은 픽스처로 Mock
- 각 테스트는 독립적으로 실행 가능해야 함 (순서 의존성 없음)
- 신규 비즈니스 로직 추가 시 테스트 함께 작성

---

## 현재 상태

- `backend/tests/` 디렉토리 존재 (2026-04-12 기준 신규 생성)
- 기존 테스트 파일 없음 — 지표 계산부터 단계적 추가 예정
