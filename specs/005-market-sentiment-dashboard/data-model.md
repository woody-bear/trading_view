# Data Model: 시장 방향성 대시보드

**Date**: 2026-03-24 | **Branch**: `005-market-sentiment-dashboard`

## 프론트엔드 상태 모델

### SentimentOverview (API 응답)

| Field | Type | Description |
|-------|------|-------------|
| fear_greed | number | 합성 공포/탐욕 지수 (0~100) |
| fear_greed_label | string | "Extreme Fear" / "Fear" / "Neutral" / "Greed" / "Extreme Greed" |
| sentiment_summary | string | "위험 회피 분위기" / "낙관적 분위기" / "혼조세" |
| vix | MarketIndex | VIX 현재값 + 변동 |
| kospi | MarketIndex | 코스피 현재값 + 변동 |
| sp500 | MarketIndex | S&P500 현재값 + 변동 |
| nasdaq | MarketIndex | 나스닥 현재값 + 변동 |
| usdkrw | MarketIndex | USD/KRW 현재값 + 변동 |
| updated_at | string | 마지막 갱신 시각 (ISO) |

### MarketIndex

| Field | Type | Description |
|-------|------|-------------|
| name | string | 지표명 (예: "VIX", "코스피") |
| value | number | 현재값 |
| change | number | 전일 대비 변동 (절대값) |
| change_pct | number | 전일 대비 변동률 (%) |
| direction | "up" \| "down" \| "flat" | 변동 방향 |

### FearGreedHistory (추이 차트용)

| Field | Type | Description |
|-------|------|-------------|
| dates | array | 날짜 배열 (30일) |
| values | array | 공포지수 배열 (0~100) |

## DB 변경 없음

모든 데이터는 yfinance에서 실시간 조회. 별도 테이블 불필요.
