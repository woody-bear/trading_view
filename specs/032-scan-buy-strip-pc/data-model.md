# Data Model: PC 스캔 화면 최상단 BUY 신호 5개 스트립

**Feature**: 032-scan-buy-strip-pc  
**Date**: 2026-04-23

## Summary

신규 테이블 없음. 기존 스캔 스냅샷 API 응답 형식을 그대로 소비.

---

## 기존 API 응답 형식 (`/signals/latest-buy`)

```typescript
// GET /signals/latest-buy
interface LatestBuyResponse {
  items: ScanItem[]
  scan_time: string | null
  count: number
}

interface ScanItem {
  symbol: string
  display_name: string
  market: string            // "KR" | "US" | "CRYPTO"
  last_signal: string       // "BUY" | "SQZ BUY"
  last_signal_date: string  // "YYYY-MM-DD"
  price: number
  change_pct: number
  rsi: number | null
  squeeze_level: number | null
  bb_pct_b: number | null   // 0~100 범위 (백분율)
  volume_ratio: number | null
  macd_hist: number | null
  trend: string | null      // "BULL" | "BEAR" | null
}
```

## `fetchFullScanLatest()` 반환 형식

```typescript
// frontend/src/api/client.ts
// fetchFullScanLatest() 반환값
interface FullScanLatestResponse {
  chart_buy: {
    items: ScanItem[]
    count: number
  }
  // 기타 카테고리 (pullback_buy 등) 포함 가능
  completed_at: string | null
}
```

## PcBuyStrip 컴포넌트 데이터 흐름

```
fetchFullScanLatest()
  └── data.chart_buy.items.slice(0, 5)
      └── BuyCard × max 5
          ├── item: ScanItem
          └── livePrice: livePrices[item.symbol] (선택적)
```

## 제약 조건

- `items.slice(0, 5)`: 최대 5개로 제한
- `items.length === 0`: 컴포넌트 전체 null 반환 (빈 영역 없음)
- `livePrice`: `undefined`여도 `BuyCard`는 `item.price` fallback 사용

## 변경 없는 테이블

| 테이블 | 변경 여부 |
|--------|----------|
| `scan_snapshot_items` | 변경 없음 |
| `watchlist` | 변경 없음 |
| `current_signals` | 변경 없음 |
