# API Contract: Market Sentiment

**Feature**: 026-buylist-market-sentiment  
**Date**: 2026-04-19

---

## 신규 엔드포인트

### GET /scan/market-sentiment

시장분위기 집계 데이터를 반환한다. KR/US/CRYPTO 시장별로 EMA 정배열/역배열 비율과 거래량 급등 비율을 제공한다.

**인증**: 기존 인증 미들웨어 그대로 적용  
**캐시**: 서버 in-memory 30분 TTL  
**응답 시간**: 캐시 hit 시 < 100ms, cold start 시 < 10s (백그라운드 사전 계산 권장)

#### Response 200

```json
{
  "KR": {
    "ema_alignment": {
      "golden": 120,
      "death": 80,
      "other": 270,
      "total": 470,
      "golden_pct": 25.5,
      "death_pct": 17.0,
      "other_pct": 57.4
    },
    "volume_spike": {
      "periods": [
        { "period_days": 20, "spike_count": 45, "total": 465, "spike_pct": 9.7, "top_sector": "반도체" },
        { "period_days": 30, "spike_count": 67, "total": 465, "spike_pct": 14.4, "top_sector": "바이오" },
        { "period_days": 60, "spike_count": 98, "total": 465, "spike_pct": 21.1, "top_sector": "2차전지" }
      ]
    }
  },
  "US": { "...same structure..." },
  "CRYPTO": { "...same structure..." },
  "computed_at": "2026-04-19T08:30:00Z"
}
```

#### 계산 정의

**EMA 정배열 (golden)**:  
`EMA5 > EMA10 > EMA20 > EMA60 > EMA120` 모두 충족

**EMA 역배열 (death)**:  
`EMA5 < EMA10 < EMA20 < EMA60 < EMA120` 모두 충족

**EMA 집계 제외 조건**:  
캔들 수 < 120개인 종목

**거래량 급등 (spike)**:  
최근 N영업일 중 하루라도 `당일 거래량 > (직전 20영업일 평균 거래량 × 3.0)` 조건 충족

**거래량 집계 제외 조건**:  
거래량 데이터가 전무한 종목

**top_sector 결정**:  
60일 룩백 기준 급등 종목 중 `sector` 컬럼 기준 최다 종목 섹터

---

## 기존 엔드포인트 변경

### GET /scan/symbols/market-cap-distribution

#### 변경 사항

응답에 `CRYPTO` 키 추가. 기존 `KR`, `US` 키 및 `MarketCapDistribution` 구조 유지.

```json
{
  "KR": { "currency": "KRW", "total_count": 470, "tertiles": [...], ... },
  "US": { "currency": "USD", "total_count": 718, "tertiles": [...], ... },
  "CRYPTO": { "currency": "USD", "total_count": 10, "tertiles": [...], ... }
}
```

CRYPTO 시총 분류 기준: 대형 > $10B / 중형 $1B~$10B / 소형 < $1B (US ETF 기준 동일 적용)
