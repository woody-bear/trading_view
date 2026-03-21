# Contract: 차트 데이터 정확성 (백엔드)

## 미완성 캔들 처리 — `chart_cache.py`

### `_strip_incomplete_candle(df, market, timeframe)`

yfinance에서 반환된 DataFrame의 마지막 캔들이 미완성인지 판단하여 제거.

```python
def _strip_incomplete_candle(df: pd.DataFrame, market: str, timeframe: str) -> pd.DataFrame:
    """장중인 경우 당일 미완성 캔들을 제거하여 반환."""
```

**판단 기준**:
| 시장 | 장 마감 | 기준 시간대 |
|------|---------|------------|
| KR/KOSPI/KOSDAQ | 15:30 | Asia/Seoul (KST, UTC+9) |
| US | 16:00 | America/New_York (ET, DST 자동) |
| CRYPTO | 00:00 | UTC |

**로직**:
1. 마지막 캔들의 날짜가 "오늘"이고
2. 현재 시각이 해당 시장 장 마감 전이면
3. → 마지막 캔들 제거

### 캐시 Freshness — `_is_cache_fresh(last_ts, market)`

```python
def _is_cache_fresh(last_ts: int, market: str) -> bool:
    """캐시의 마지막 캔들이 최신인지 시장 시간 기준으로 판단."""
```

**로직**:
- 마지막 캔들 날짜 >= `get_last_complete_date(market)` → fresh
- 그렇지 않으면 → stale

## 시장 시간 유틸리티 — `market_hours.py`

```python
def is_market_open(market: str) -> bool:
    """현재 시각에 해당 시장이 장중인지."""

def get_last_complete_date(market: str) -> date:
    """가장 최근 완성된 일봉의 날짜. 주말이면 금요일 반환."""

def is_candle_complete(candle_date: date, market: str) -> bool:
    """특정 날짜의 캔들이 완성되었는지 (장 마감이 지났는지)."""
```

## quick_chart 응답 확장

### 기존 응답 + market_open 필드

```json
{
  "symbol": "005930",
  "candles": [...],       // 미완성 캔들 제거된 상태
  "market_open": true,    // 신규: 현재 시장이 장중 → 프론트에서 실시간 당일 캔들 구성
  "indicators": {...},
  "squeeze_dots": [...],
  "markers": [...],
  "current": {...}
}
```

### 프론트엔드 동작
| market_open | 실시간 연결 | 동작 |
|-------------|------------|------|
| true | 있음 | 캔들 목록 끝에 실시간 가격으로 당일 캔들 생성 |
| true | 없음 | 완성 캔들만 표시 (당일 캔들 없음) |
| false | - | 모든 캔들이 완성 상태, 그대로 표시 |
