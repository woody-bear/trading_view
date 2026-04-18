---
purpose: frontend/src/types/ TypeScript 타입 정의 목록·모듈 구조.
reader: Claude가 타입을 추가·수정하거나 API 응답 타입을 확인할 때.
update-trigger: types/ 파일 추가·제거; 공용 타입 시그니처 변경; API 응답 타입 변경.
last-audit: 2026-04-18
---

# Frontend — 타입 정의 (types/)

> 소스: `frontend/src/types/index.ts`

## 주요 타입

### 관심종목 / 신호

```typescript
interface WatchlistItem {
  id: number
  market: string          // KR / US / CRYPTO
  symbol: string
  display_name: string | null
  timeframe: string
  data_source: string
  is_active: boolean
  created_at: string
}

interface Signal {
  watchlist_id: number
  symbol: string
  display_name: string | null
  market: string
  market_type?: string
  signal_state: 'BUY' | 'SELL' | 'NEUTRAL'
  confidence: number
  signal_grade: string       // A+, A, B+ 등
  price: number
  change_pct: number
  rsi: number
  bb_pct_b: number
  bb_width: number
  squeeze_level: number
  macd_hist: number
  volume_ratio: number
  ema_20: number
  ema_50: number
  ema_200: number
  updated_at: string
}

// Note: SignalData는 더 이상 types/index.ts에 정의되지 않음.
// Signal 인터페이스가 signalStore 등에서 사용됨.
```

### 스캔 스냅샷

```typescript
interface ScanSnapshot {
  id: number
  status: string          // running / completed / failed
  total_symbols: number
  scanned_count: number
  picks_count: number
  max_sq_count: number
  buy_count: number
  started_at: string
  completed_at: string | null
}

interface ScanSnapshotItem {
  id: number
  snapshot_id: number
  category: string        // picks / max_sq / chart_buy
  symbol: string
  name: string
  market: string
  market_type: string
  price: number | null
  change_pct: number | null
  rsi: number | null
  squeeze_level: number | null
  confidence: number | null
  trend: string | null    // BULL / BEAR / NEUTRAL
  last_signal: string | null
  last_signal_date: string | null
}
```

### 회사 정보 (api/client.ts에 정의)

```typescript
interface CompanyInfo {
  name: string
  logo_url: string | null
  description: string | null
  industry: string | null
  sector: string | null
  country: string | null
  exchange: string | null
  employees: number | null
  website: string | null
}

interface InvestmentMetrics {
  per: number | null
  pbr: number | null
  roe: number | null
  roa: number | null
  eps: number | null
  bps: number | null
  dividend_yield: number | null
  market_cap: number | null
  operating_margin: number | null
  debt_to_equity: number | null
  currency: 'KRW' | 'USD'
}
```

---

## 공통 유틸 타입 패턴

```typescript
// Nullable 필드
type Nullable<T> = T | null

// API 응답 래퍼 (일부 엔드포인트)
interface ApiResponse<T> {
  status: string
  data: T
}
```

---

## utils/ 파일 목록

| 파일 | 용도 |
|------|------|
| `format.ts` | 숫자/날짜 포맷팅 (천단위, % 표시 등) |
| `buyReason.ts` | BUY 신호 이유 한줄 설명 생성 |
| `indicatorLabels.ts` | 지표 라벨/색상 매핑 |

## lib/ 파일

| 파일 | 용도 |
|------|------|
| `supabase.ts` | Supabase 클라이언트 초기화 (`createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`) |
