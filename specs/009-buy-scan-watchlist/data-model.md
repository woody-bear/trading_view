# Data Model: BUY 사인조회 주식목록 페이지

**Feature**: 009-buy-scan-watchlist
**Date**: 2026-03-30

---

## 기존 DB 엔티티 (변경 없음)

### StockMaster (stock_master 테이블) — 읽기 전용

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer PK | |
| symbol | String(20) | 종목코드 (예: 005930, AAPL) |
| name | String(100) | 종목명 |
| market | String(10) | KR 또는 US |
| market_type | String(10) | KOSPI / KOSDAQ / NASDAQ / NYSE |
| is_etf | Boolean | ETF 여부 |
| updated_at | DateTime | 최종 갱신 시각 |

**현재 데이터**: 총 3,779개 (KOSPI 934 / KOSPI ETF 870 / KOSDAQ 1,784 / NASDAQ 107 / NYSE ETF 84)

### ScanSnapshot / ScanSnapshotItem — 읽기 전용

기존 전체 시장 스캔 결과 저장 테이블. 상황판에서 history 조회 시 사용.

**`/api/scan/full/history` 응답 구조**:
```json
{
  "history": [
    {
      "id": 1,
      "status": "completed",
      "total_symbols": 3779,
      "scanned_count": 3776,
      "picks_count": 15,
      "buy_count": 4,
      "error_message": null,
      "started_at": "2026-03-30T09:30:12",
      "completed_at": "2026-03-30T09:58:43",
      "elapsed_seconds": 1711
    }
  ]
}
```

**`/api/scan/full/status` 응답 구조**:
```json
{
  "running": false,
  "progress_pct": 100,
  "elapsed_seconds": 1711,
  "scanned_count": 3776,
  "total_symbols": 3779,
  "last_completed_at": "2026-03-30T09:58:43"
}
```

---

## 신규 API 응답 모델

### GET /api/scan/symbols 응답

```json
{
  "total": 3779,
  "breakdown": {
    "kospi": 934,
    "kospi_etf": 870,
    "kosdaq": 1784,
    "nasdaq": 107,
    "nyse_etf": 84
  },
  "symbols": [
    {
      "symbol": "005930",
      "name": "삼성전자",
      "market": "KR",
      "market_type": "KOSPI",
      "is_etf": false
    }
  ]
}
```

**DB 스키마 변경 없음** — stock_master 테이블 읽기만 수행.

---

## 프론트엔드 상태 모델

### BuyListPage 컴포넌트 상태

```typescript
// 종목 데이터
interface StockSymbol {
  symbol: string
  name: string
  market: 'KR' | 'US'
  market_type: 'KOSPI' | 'KOSDAQ' | 'NASDAQ' | 'NYSE'
  is_etf: boolean
}

interface SymbolBreakdown {
  kospi: number
  kospi_etf: number
  kosdaq: number
  nasdaq: number
  nyse_etf: number
  total: number
}

// 스캔 슬롯
interface ScanSlot {
  time: string        // "09:30"
  label: string       // 표시용 레이블
  market: 'KR' | 'US'
  status: 'completed' | 'running' | 'pending'
  completedAt?: string
  scannedCount?: number
  buyCount?: number
  elapsedSeconds?: number
}

// 상태
const [symbols, setSymbols] = useState<StockSymbol[]>([])
const [breakdown, setBreakdown] = useState<SymbolBreakdown | null>(null)
const [scanSlots, setScanSlots] = useState<ScanSlot[]>([])
const [scanStatus, setScanStatus] = useState<{ running: boolean; ... } | null>(null)
const [searchQuery, setSearchQuery] = useState('')
const [activeTab, setActiveTab] = useState<'KR' | 'US'>('KR')
const [loading, setLoading] = useState(true)
```

### 스캔 슬롯 하드코딩 정의

```typescript
const SCAN_SCHEDULE: { time: string; label: string; market: 'KR' | 'US' }[] = [
  { time: '09:30', label: '09:30', market: 'KR' },
  { time: '10:30', label: '10:30', market: 'KR' },
  { time: '11:30', label: '11:30', market: 'KR' },
  { time: '12:30', label: '12:30', market: 'KR' },
  { time: '13:30', label: '13:30', market: 'KR' },
  { time: '14:30', label: '14:30', market: 'KR' },
  { time: '15:30', label: '15:30', market: 'KR' },
  { time: '19:50', label: '19:50', market: 'US' },
  { time: '03:50', label: '03:50', market: 'US' },
]
```

슬롯 매핑: history의 `started_at` → KST 변환 → HH:mm 추출 → 슬롯 time과 ±15분 범위 매핑.
