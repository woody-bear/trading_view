---
purpose: frontend/src/api/client.ts의 API 함수·axios 인터셉터·타입 설명.
reader: Claude가 API 함수를 추가·수정하거나 에러 핸들링 패턴을 조정할 때.
update-trigger: api/client.ts에 함수 추가·제거; 인터셉터 로직 변경; 환경 변수(VITE_API_URL) 변경.
last-audit: 2026-04-18
---

# Frontend — API 클라이언트 (api/client.ts)

> 소스: `frontend/src/api/client.ts`

## 구조

```typescript
const api = axios.create({ baseURL: '/api' })
```

- **베이스 URL**: `/api` (상대 경로 — Vite 프록시 또는 백엔드 직접 서빙)
- 모든 API 함수는 이 파일에 집중 (`[FE-03]` 규칙)

## 인터셉터

### Request 인터셉터 — Supabase 토큰 자동 주입

```typescript
api.interceptors.request.use(async (config) => {
  // supabase.auth.getSession() — 2초 타임아웃 보호
  // session.access_token 있으면 Authorization: Bearer 헤더 추가
})
```

### Response 인터셉터 — 401 자동 갱신

```typescript
api.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 401 && !originalRequest._retry) {
    // supabase.auth.refreshSession() → 새 토큰으로 재시도
    // 갱신 실패 시 signOut()
  }
})
```

## API 함수 목록

### 관심종목
```typescript
fetchSignals()                              // GET /signals
fetchWatchlist()                            // GET /watchlist
addSymbol(data)                             // POST /watchlist
deleteSymbol(id)                            // DELETE /watchlist/{id}
updateSymbol(id, data)                      // PUT /watchlist/{id}
```

### 차트 / 신호
```typescript
fetchChart(id, timeframe?)                  // GET /signals/{id}/chart
fetchSignalBySymbol(symbol)                 // GET /signals/by-symbol/{symbol}
fetchChartBySymbol(symbol, timeframe?)      // GET /chart/by-symbol/{symbol}
fetchQuickChart(symbol, market, timeframe?) // GET /chart/quick
fetchLatestBuy()                            // GET /signals/latest-buy
refreshLatestBuy()                          // POST /signals/latest-buy/refresh
fetchIndicatorsAt(symbol, market, date)     // GET /chart/indicators-at
```

### 시장 스캔
```typescript
runUnifiedScan()                            // POST /scan/unified
fetchUnifiedCache()                         // GET /scan/unified
fetchScanStatus()                           // GET /scan/status
fetchFullScanLatest()                       // GET /scan/full/latest
fetchFullScanStatus()                       // GET /scan/full/status
triggerFullScan()                           // POST /scan/full/trigger
fetchFullScanHistory(limit?)                // GET /scan/full/history
fetchSnapshotBuyItems(snapshotId)           // GET /scan/full/snapshot/{id}/buy-items
fetchScanSymbols()                          // GET /scan/symbols (fetch 직접 사용)
```

### 설정
```typescript
getSensitivity()                            // GET /settings/sensitivity
setSensitivity(level)                       // PUT /settings/sensitivity
getTelegram()                               // GET /settings/telegram
setTelegram(data)                           // PUT /settings/telegram
testTelegram()                              // POST /settings/telegram/test
getKIS()                                    // GET /settings/kis
setKIS(data)                               // PUT /settings/kis
testKIS()                                  // POST /settings/kis/test
```

### 시장 심리 / 환율
```typescript
fetchSentiment()                            // GET /sentiment/overview
fetchSentimentHistory(days?)                // GET /sentiment/history
fetchVIXHistory(days?)                      // GET /sentiment/vix-history
```

### 회사 정보 / 재무
```typescript
fetchCompanyInfo(symbol, market)            // GET /company/{symbol}
fetchFinancials(symbol, market)             // GET /financials/{symbol}
fetchStockDetail(symbol, market?)           // GET /stocks/{symbol}/detail
fetchOrderbook(symbol, market?)             // GET /stocks/{symbol}/orderbook
```

### 알림 / 기타
```typescript
fetchAlertHistory(type?, limit?)            // GET /alerts/history
testBuyAlert()                              // POST /alerts/buy-signal/test
fetchBatchPrices(symbols)                   // POST /prices/batch
searchSymbols(q, market?)                   // GET /search
fetchHealth()                               // GET /health
```

### 패턴 케이스
```typescript
fetchPatternCases(params?)                  // GET /pattern-cases
createPatternCase(data)                     // POST /pattern-cases
updatePatternCase(id, data)                 // PATCH /pattern-cases/{id}
deletePatternCase(id)                       // DELETE /pattern-cases/{id}
checkPatternCaseDuplicate(symbol, date)     // GET /pattern-cases/check
```

## 사용 패턴

```typescript
// React Query와 함께 사용 (권장)
const { data, isLoading } = useQuery({
  queryKey: ['signals'],
  queryFn: fetchSignals,
  refetchInterval: 10000,
})

// 직접 호출 (mutation)
const mutation = useMutation({ mutationFn: addSymbol })
mutation.mutate({ market: 'KR', symbol: '005930', timeframe: '1d' })
```

## 새 API 함수 추가 시

```typescript
// client.ts에 추가
export const myNewApi = (param: string) =>
  api.get(`/my-endpoint/${param}`).then(r => r.data)
```
