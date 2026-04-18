# Data Model: 026-buylist-market-sentiment

**Date**: 2026-04-19

---

## DB 변경: StockMaster.sector 컬럼 추가

### Migration (Alembic)

```sql
-- 적용
ALTER TABLE stock_master ADD COLUMN sector VARCHAR(100) DEFAULT '기타';

-- 롤백
ALTER TABLE stock_master DROP COLUMN sector;
```

### 컬럼 설명

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `sector` | VARCHAR(100) | `'기타'` | 업종/섹터명. US: yfinance info.sector, KR: market_type 매핑, CRYPTO: "암호화폐" |

### KR market_type → sector 매핑 (초기값)

| market_type | sector 초기값 |
|------------|--------------|
| KOSPI | KOSPI |
| KOSDAQ | KOSDAQ |
| ETF (KR) | ETF |

> KR 종목의 실제 업종 데이터는 향후 pykrx 연동으로 보완 예정.

---

## 신규 API 응답 스키마

### GET /scan/market-sentiment 응답

```python
class EmaAlignmentStats(BaseModel):
    golden: int          # 정배열 종목 수 (EMA5>EMA10>EMA20>EMA60>EMA120)
    death: int           # 역배열 종목 수 (EMA5<EMA10<EMA20<EMA60<EMA120)
    other: int           # 기타 종목 수
    total: int           # 집계 대상 종목 수 (캔들 부족 종목 제외)
    golden_pct: float    # 정배열 비율 (0~100)
    death_pct: float     # 역배열 비율 (0~100)
    other_pct: float     # 기타 비율 (0~100)

class VolumeSpikePeriod(BaseModel):
    period_days: int     # 룩백 기간 (20 / 30 / 60)
    spike_count: int     # 급등 종목 수
    total: int           # 집계 대상 종목 수
    spike_pct: float     # 급등 비율 (0~100)
    top_sector: str      # 급등 종목 중 최다 섹터명

class VolumeSpikeStats(BaseModel):
    periods: list[VolumeSpikePeriod]  # [20일, 30일, 60일]

class MarketSentimentByMarket(BaseModel):
    ema_alignment: EmaAlignmentStats
    volume_spike: VolumeSpikeStats

class MarketSentimentResponse(BaseModel):
    KR: MarketSentimentByMarket
    US: MarketSentimentByMarket
    CRYPTO: MarketSentimentByMarket
    computed_at: str     # ISO 8601 timestamp
```

---

## 기존 API 응답 변경: market-cap-distribution

### GET /scan/symbols/market-cap-distribution 변경

기존 응답:
```json
{ "KR": {...}, "US": {...} }
```

변경 후:
```json
{ "KR": {...}, "US": {...}, "CRYPTO": {...} }
```

CRYPTO 분포 구조는 US와 동일한 `MarketCapDistribution` 타입 사용. `currency: "USD"`.

---

## Frontend 타입 추가

```typescript
// frontend/src/api/client.ts 추가

export interface EmaAlignmentStats {
  golden: number;
  death: number;
  other: number;
  total: number;
  golden_pct: number;
  death_pct: number;
  other_pct: number;
}

export interface VolumeSpikePeriod {
  period_days: number;
  spike_count: number;
  total: number;
  spike_pct: number;
  top_sector: string;
}

export interface VolumeSpikeStats {
  periods: VolumeSpikePeriod[];
}

export interface MarketSentimentByMarket {
  ema_alignment: EmaAlignmentStats;
  volume_spike: VolumeSpikeStats;
}

export interface MarketSentimentResponse {
  KR: MarketSentimentByMarket;
  US: MarketSentimentByMarket;
  CRYPTO: MarketSentimentByMarket;
  computed_at: string;
}
```
