# Research — Phase 0

**Feature**: 024-trend-trading-signals
**Date**: 2026-04-16

## R1. 추세 분류 알고리즘 — 피크 검출 + 선형 회귀

- **Decision**: 최근 120봉의 OHLC `close` 가격을 입력으로
  - (a) 롤링 윈도우 기반 단순 피크 검출 (window=5)로 주요 고점·저점 인덱스 추출 — `scipy.signal.find_peaks`가 기 설치돼 있으면 그것 사용, 아니면 직접 구현
  - (b) 추출한 고점·저점 인덱스 시퀀스에 **NumPy `np.polyfit(deg=1)`** 으로 기울기·절편 계산
  - (c) 두 회귀선의 기울기 부호·크기·간격으로 4분기:
    - 둘 다 기울기 > +ε → **uptrend**
    - 둘 다 기울기 < -ε → **downtrend**
    - 둘 다 |기울기| < ε + (max-min) 변동폭이 좁음 → **sideways (박스권)**
    - 저점 > +ε AND 고점 < -ε → **triangle (삼각수렴)**
    - 그 외 → **unknown**

- **Rationale**: 고전적인 추세선 분석을 코드로 단순화한 형태. 외부 의존성 최소(numpy/scipy 기존), 결정론적 결과로 테스트·디버깅 쉬움.

- **Alternatives considered**:
  - **ML(시계열 분류)**: 정확도 가능성 있으나 학습 데이터·검증 비용·블랙박스 우려 → 본 1차 범위 초과
  - **TA-Lib 패턴 인식**: 의존성 추가, 한국 종목 검증 부족
  - **단일 기울기**: 회귀선 1개로만 판정 — 박스/삼각 분류 어려움


## R2. ε(기울기 임계) 정규화

- **Decision**: 가격 대비 정규화한 일일 변화율을 사용 — `slope_pct_per_day = slope / last_close * 100`. 임계값 ε는 다음으로 시작:
  - **ε = 0.05% / 일** — 약 6개월(120일) 누적 ≈ ±6% 이상 추세성
  - 박스권: 두 회귀 모두 `|slope_pct| < 0.05`이고 (high - low) / mean < 5% (변동폭 5% 이내)

- **Rationale**: 절대 기울기는 가격대(주가 1만원 vs 100달러)에 따라 의미가 달라 비교 불가. 정규화로 해결. 임계는 1차 디폴트, SC-002 육안 80% 매칭 기준으로 조정.

- **Alternatives**: ATR 기반·표준편차 기반 임계 → 복잡도 증가, 1차 룰 단순성 손상.


## R3. 피크 검출 윈도우 크기

- **Decision**: 윈도우 5 (양쪽 5봉 비교) — 너무 작으면 노이즈 피크, 너무 크면 주요 변곡 놓침. 120봉 데이터에서 5봉은 약 4% 폭의 의미 있는 변곡 포착 가능.

- **Rationale**: 일반적인 피크 검출 윈도우 권장값. 향후 종목 변동성에 따라 조정 가능.


## R4. 매수·매도 후보 가격 산출 (PDF 룰 매핑)

| 추세 | 매수 후보 가격 | 매도 후보 1차 | 매도 후보 2차 (강한 매도) |
|------|--------------|--------------|------------------------|
| uptrend | 지지선 회귀 오늘값 | 저항선 회귀 오늘값 | 지지선 하향이탈가 (지지선 -1%) |
| downtrend | 지지선 오늘값 (단 기울기 깊으면 "관망") | 저항선 오늘값 | 지지선 하향이탈가 |
| sideways | 박스 저점 (수평선) | 박스 고점 (수평선) | 박스 하단 -1% |
| triangle | 고점 추세선 돌파가 (저항선 +1%) | (없음) | 저점 추세선 이탈가 |
| unknown | (없음) | (없음) | (없음) |

- 모든 가격은 응답에 `current_price` 대비 거리(%)도 포함 → FR-011 강조용

- **Rationale**: PDF 4가지 추세 × 매수·매도 시점 표 그대로 매핑.


## R5. 응답 캐시 전략 (FR-009)

- **Decision**:
  - 서버: 심볼+market 키, **TTL 60초** in-memory dict
  - 프론트: React Query `staleTime: 5분`, `gcTime: 10분`
- **Rationale**: 추세 분류는 일봉 마감 기준이라 빈번 갱신 불필요. 60s/5min 캐시는 사용자가 같은 종목 페이지를 새로고침해도 서버 부담 없음. FR-009 "실시간 재계산 X"와 부합.


## R6. 데이터 소스 — `/api/chart/quick` 재사용 vs 자체 fetch

- **Decision**: 백엔드 trend_analysis 라우터가 **chart_cache의 `get_chart_data(symbol, market, '1d', limit=200)`** 을 직접 호출. 프론트가 받은 candle 데이터를 다시 보내지 않음(요청 페이로드 작게 유지).
- **Rationale**: 단일 진실원, 중복 fetch 회피, 서버 측에서 정확한 OHLC 보장.
- **Alternatives**: 프론트가 `chartData.candles`를 페이로드로 POST → 페이로드 큼 + 신뢰성↓.


## R7. FR-013 완전 격리 검증 방법

- **Decision**: 구현 후 다음 grep으로 격리 보장:
  - `rg "(full_market_scanner|chart_buy|ScanSnapshot|rules/chart-buy|rules/chart-sell|buy_signal_alert|telegram)" backend/services/trend_analysis.py backend/routes/trend_analysis.py` → empty 결과
  - 동일하게 프론트 `frontend/src/components/charts/TrendAnalysisCard.tsx`·`hooks/useTrendAnalysis.ts`도 BUY 스캔 관련 import 0건
- **Rationale**: 자동 회귀 보장. tasks.md polish 단계에 명시.


## R8. 오버레이 차트 통합 (FR-006)

- **Decision**: `IndicatorChart`에 `trendLines?: TrendLine[]` prop 추가. 비어 있으면 아무것도 안 그림. 토글 OFF 상태 = 빈 배열 전달.
- **Rationale**: 가독성 보장 + 회귀 위험 제로 + 토글 ON/OFF 즉각 반영. lightweight-charts의 LineSeries 추가/제거 패턴은 이미 EMA에서 검증됨.
- **Style**:
  - 상승 지지선/저항선: `#22c55e` 초록 점선
  - 하락 지지선/저항선: `#ef4444` 빨강 점선
  - 박스 상단/하단: `#3b82f6` 파랑 수평 점선
  - 삼각수렴: `#eab308` 노랑 점선


## R9. 라이브러리 가용성 확인

- numpy: ✅ 기존 설치
- pandas: ✅ 기존 설치
- scipy: 백엔드 requirements에 직접 명시는 안 돼 있을 수 있음 — 확인 후 없으면 단순 구현으로 대체 (성능 차 미미)
- React Query, Zustand, lightweight-charts: ✅ 022/023에서 확보


## R10. 장 상태(market_status) 통합 (옵션)

- **Decision**: 1차 범위에 미포함. 추후 확장 — `get_market_status(market)` 호출해 `pre_open`/`closed`/`holiday` 시 카드 상단에 보조 안내("⏰ 장 개장 전 — 어제 종가 기준 분석") 추가.
- **Rationale**: 핵심 가치(추세 분류·매매 시점)에 집중. 장 상태 보강은 UX 폴리시이지 본 기능 핵심 아님.
