# Research: 시장 방향성 대시보드

**Date**: 2026-03-24 | **Branch**: `005-market-sentiment-dashboard`

## R-001: Fear & Greed Index 데이터 소스

**Decision**: VIX 기반 합성 공포/탐욕 지수 (0~100) 자체 계산

**Rationale**:
- CNN Fear & Greed API(`production.dataviz.cnn.io`)가 CORS/인증으로 차단됨
- 외부 유료 API(Alpha Vantage 등)는 추가 비용 + API 키 의존
- VIX(변동성 지수)는 yfinance로 무료 조회 가능하며 시장 공포와 높은 상관관계
- 자체 계산이므로 투명하고, 외부 서비스 장애에 독립적

**합성 공포지수 계산 로직**:
```
VIX 수준 → Fear/Greed 점수 매핑:
  VIX >= 35 → 0~10 (Extreme Fear)
  VIX 25~35 → 10~30 (Fear)
  VIX 18~25 → 30~50 (Neutral)
  VIX 12~18 → 50~75 (Greed)
  VIX <= 12 → 75~100 (Extreme Greed)

보정: S&P500 20일 수익률, 시장 모멘텀 반영
```

**Alternatives Considered**:
- CNN API 직접 호출: 차단됨
- alternative.me Crypto Fear & Greed: 암호화폐 전용, 주식 시장에 부적합
- 유료 API: 불필요한 비용, 단일 장애점

## R-002: 시장 지수 데이터 소스

**Decision**: yfinance로 전체 조회 (추가 의존성 0개)

**확인된 티커**:
| 지표 | yfinance 티커 | 확인 |
|------|--------------|------|
| VIX | `^VIX` | OK |
| 코스피 | `^KS11` | OK |
| S&P 500 | `^GSPC` | OK |
| 나스닥 | `^IXIC` | OK |
| USD/KRW | `USDKRW=X` | OK (기존 forex에서 사용 중) |

**패턴**: 기존 `forex_analyzer.py`의 `asyncio.to_thread(_fetch)` 패턴 재사용

## R-003: 프론트엔드 배치

**Decision**: Dashboard.tsx에 임베드 — 검색 바 아래, 관심종목 위에 배치

**Rationale**:
- 별도 페이지(`/sentiment`)보다 메인화면 통합이 사용자 동선에 적합
- 기존 Dashboard에 `MarketScanBox` 컴포넌트가 이미 임베드되어 있는 패턴
- SentimentPanel 컴포넌트를 분리하여 Dashboard에서 import

## R-004: 시장 분위기 요약 판정 로직

**Decision**: 단순 규칙 기반 — 합성 공포지수 + 주요 지수 등락률 조합

**로직**:
```
if 공포지수 < 25 and (S&P500 < -1% or 코스피 < -1%):
    "위험 회피 분위기" (빨강)
elif 공포지수 > 60 and (S&P500 > 0.5% or 코스피 > 0.5%):
    "낙관적 분위기" (초록)
else:
    "혼조세" (회색)
```
