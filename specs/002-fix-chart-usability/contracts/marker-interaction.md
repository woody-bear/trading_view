# Contract: 마커 호버 & 매수지점 기록

## 마커 호버 색상 강조 (US9)

### 구현 API

```typescript
// IndicatorChart 내부
const markersPlugin = createSeriesMarkers(candleSeries, markersWithIds)

mainChart.subscribeCrosshairMove((param) => {
  if (!param.time) { restoreColors(); return }
  const matched = markersWithIds.find(m => m.time === param.time)
  if (matched) highlightMarker(matched.id)
  else restoreColors()
})
```

### 색상 매핑

| 상태 | BUY 색상 | SELL 색상 |
|------|----------|-----------|
| 기본 | `#22c55e` | `#ef4444` |
| 호버 | `#4ade80` | `#f87171` |

### 모바일 비활성화

```typescript
const hasHover = window.matchMedia('(hover: hover)').matches
if (hasHover) { mainChart.subscribeCrosshairMove(...) }
```

## 매수지점 기록 (US10)

### useBuyPoint Hook

```typescript
interface BuyPoint {
  symbol: string
  price: number
  date: string        // ISO date
  markerTime: number  // Unix timestamp
}

interface UseBuyPointReturn {
  buyPoint: BuyPoint | null
  setBuyPoint: (point: BuyPoint) => void
  removeBuyPoint: () => void
  toggleBuyPoint: (point: BuyPoint) => void  // 같은 마커면 삭제, 다른 마커면 대체
}

function useBuyPoint(symbol: string): UseBuyPointReturn
```

### localStorage 키

- 패턴: `buyPoints:{symbol}` (예: `buyPoints:005930`, `buyPoints:AAPL`)
- 값: JSON.stringify(BuyPoint)
- 종목당 1개만 저장

### 차트 시각화 — createPriceLine

```typescript
const priceLine = candleSeries.createPriceLine({
  price: buyPoint.price,
  color: '#22c55e',
  lineWidth: 1,
  lineStyle: 2,  // Dashed
  axisLabelVisible: true,
  title: `매수 ₩${buyPoint.price.toLocaleString()} (+${profitPct}%)`,
})
```

### 클릭 감지 — subscribeClick

```typescript
mainChart.subscribeClick((param) => {
  if (!param.time) return
  const clickedBuy = markersWithIds.find(
    m => m.time === param.time && m.text === 'BUY'
  )
  if (clickedBuy) {
    const point = { symbol, price: candleAtTime.close, date: ..., markerTime: clickedBuy.time }
    toggleBuyPoint(point)
  }
})
```

### 수익률 라벨 업데이트

실시간 가격 변경 시 priceLine의 title을 업데이트:
```typescript
useEffect(() => {
  if (!buyPoint || !realtimePrice || !priceLineRef.current) return
  const pct = ((realtimePrice.price - buyPoint.price) / buyPoint.price * 100).toFixed(1)
  const sign = pct >= 0 ? '+' : ''
  priceLineRef.current.applyOptions({
    title: `매수 ₩${buyPoint.price.toLocaleString()} (${sign}${pct}%)`
  })
}, [realtimePrice, buyPoint])
```
