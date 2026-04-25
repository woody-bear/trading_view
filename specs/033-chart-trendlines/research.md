# Research: 차트 추세선 채널 (033-chart-trendlines)

## 1. 스윙 포인트 감지 알고리즘

**Decision**: 기존 `trend_analysis.py`의 롤링 윈도우 방식 그대로 재사용  
**Rationale**: scipy 미설치 환경에 최적화된 순수 numpy 구현. window=5가 일봉 기준 주별 고점/저점 탐색에 적합.  
**Alternatives considered**: scipy `find_peaks` (scipy 설치 필요, 불필요), ZigZag 알고리즘 (복잡도 대비 이득 없음)

```python
def _find_local_peaks(arr: np.ndarray, window: int = 5) -> np.ndarray:
    for i in range(window, n - window):
        if arr[i] == max(arr[i-window : i+window+1]):
            peaks.append(i)
```

## 2. 채널 평행선 계산

**Decision**: 두 기준 스윙 포인트 사이 구간에서 반대 극값을 찾아 수직 오프셋으로 평행 이동  
**Rationale**: 채널 이론의 표준 방식. 선형 기울기를 유지하면서 채널 폭을 일정하게 유지.  
**Algorithm**:
- 하락채널 평행선: `parallel_price(t) = main_price(t) + vertical_offset`
  where `vertical_offset = min(lows[i1:i2]) - main_line_value(t_min_low)`
- 상승채널 평행선: `parallel_price(t) = main_price(t) + vertical_offset`
  where `vertical_offset = max(highs[i1:i2]) - main_line_value(t_max_high)`

## 3. 선형 연장 (Line Extension)

**Decision**: numpy polyfit slope + intercept로 임의 시점의 가격을 `slope * t + intercept`로 계산  
**Rationale**: 두 점만 있으면 외삽 가능. 현재 날짜까지 연장해 API 응답의 `end.time`을 오늘로 설정.

## 4. 5단계 판정 — 히스토리 스캔 방식

**Decision**: 전체 기간 캔들을 앞에서 순차 스캔하여 단계 완료 여부 판정  
**Rationale**: 실시간성보다 정확성 우선. 단계는 한번 완료되면 되돌릴 수 없는 단방향 진행.  
**Stage completion rules**:
1. `close > downtrend_main(t)` — 최소 1봉
2. `abs(low - downtrend_parallel(t)) / downtrend_parallel(t) ≤ 0.02` AND `close > open` — 최소 1봉
3. `close > downtrend_parallel(t)` — 최소 1봉
4. `abs(low - uptrend_main(t)) / uptrend_main(t) ≤ 0.02` AND `close > open` — 최소 1봉
5. `close > uptrend_parallel(t)` — 최소 1봉

## 5. 거래량 배율 계산

**Decision**: `volume_ratio = stage_candle_volume / mean(prior_5_nonzero_volumes)`  
**Rationale**: 기존 `full_market_scanner.py`의 `_passes_volume_filter` 패턴과 동일. 5일 평균이 일봉 기준 1주일 거래량 대비로 적합.  
**Edge case**: 5일 내 유효 거래량 없으면 ratio = None (표시 생략)

## 6. 차트 기간 전환 (lightweight-charts)

**Decision**: `chart.timeScale().setVisibleRange({ from: unixTs, to: unixTs })` 사용  
**Rationale**: logical range는 인덱스 기반이라 candle 수가 달라지면 맞지 않음. time-based range가 더 명확.  
**Sync**: RSI/MACD 서브차트는 기존 `subscribeVisibleLogicalRangeChange` 자동 동기화로 처리.

## 7. 볼륨 바 하이라이트

**Decision**: HistogramSeries per-bar `color` 필드에 노란색(`rgba(251,191,36,0.8)`) 적용  
**Rationale**: lightweight-charts가 이미 per-bar color를 지원(기존 코드 확인). 별도 시리즈 불필요.  
**Normal bar colors**: 상승봉 `rgba(255,75,106,0.30)`, 하락봉 `rgba(66,133,244,0.28)` (기존 유지)

## 8. 데이터 기간 — 연장 불필요 확인

**Confirmed**: `kr_fetcher.py` / `us_fetcher.py`가 이미 `period="2y"` (약 500 거래일)을 수신.  
`chart_cache`의 limit=260 요청으로 12개월 충분히 커버.  
스캔(`period="1y"` = 250 거래일)에서는 추세선 미계산 — 상세 화면 on-demand만.

## 9. 캐시 전략

**Decision**: 서버 in-memory `{(symbol, market): (timestamp, result)}` dict, TTL=60s  
**Frontend**: React Query `staleTime: 60_000, refetchInterval: false`  
**Rationale**: 추세선은 일봉 기준이므로 분 단위 변화 없음. 60초 캐시로 반복 접근 최적화.
