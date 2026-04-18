# API Contracts: BUY 사인조회 주식목록

**Feature**: 009-buy-scan-watchlist
**Date**: 2026-03-30

---

## 신규 엔드포인트

### GET /api/scan/symbols

전체 스캔 대상 종목 목록 + 카테고리별 집계 반환.

**인증**: 불필요 (공개 종목 정보)

**Request**: 없음 (쿼리 파라미터 없음)

**Response 200**:
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
    },
    {
      "symbol": "SPY",
      "name": "SPDR S&P 500 ETF",
      "market": "US",
      "market_type": "NYSE",
      "is_etf": true
    }
  ]
}
```

**정렬**: market_type 오름차순 → symbol 오름차순

**오류 케이스**:
- stock_master 비어있으면: `{"total": 0, "breakdown": {...zeros}, "symbols": []}`

---

## 기존 엔드포인트 재사용 (변경 없음)

### GET /api/scan/full/history?limit=20

스캔 이력 조회. 상황판 슬롯 매핑에 사용.

**사용 방법**: `limit=20` 으로 오늘 포함 최근 이력 충분히 확보 후 프론트엔드에서 오늘 날짜 필터링.

### GET /api/scan/full/status

현재 스캔 진행 상태. 진행중일 때 5초 폴링에 사용.

---

## 프론트엔드 라우트 계약

### 신규 라우트: /buy-list

```
Path: /buy-list
Component: BuyList (frontend/src/pages/BuyList.tsx)
Auth: 불필요
```

**`/:symbol` 동적 라우트보다 앞에 선언** 필요 (App.tsx route 순서):
```tsx
<Route path="/buy-list" element={<BuyList />} />
<Route path="/:symbol" element={<SignalDetail />} />
```

### 종목 클릭 → 상세 이동

```
클릭 시: navigate(`/${symbol}?market=${market}`)
KR 종목: market = market_type (KOSPI 또는 KOSDAQ)
US 종목: market = market_type (NASDAQ 또는 NYSE)
```

---

## 네비게이션 변경 계약

### PC 상단 헤더 (App.tsx)

```tsx
// 기존
<a href="/picks">추천</a>
<a href="/forex">환율</a>

// 변경 후
<a href="/picks">추천</a>
<a href="/forex">환율</a>
<a href="/buy-list">BUY조회</a>  // 추가
```

### 모바일 BottomNav (BottomNav.tsx)

```tsx
// 기존 탭 배열 (5개)
{ path: '/', icon: Home, label: '홈' },
{ path: '/scan', icon: BarChart3, label: '스캔' },
{ path: '/forex', icon: DollarSign, label: '환율' },
{ path: '/picks', icon: Star, label: '추천' },
{ path: '/settings', icon: Settings, label: '설정' },

// 변경 후 (6개) — 추천 다음에 삽입
{ path: '/', icon: Home, label: '홈' },
{ path: '/scan', icon: BarChart3, label: '스캔' },
{ path: '/forex', icon: DollarSign, label: '환율' },
{ path: '/picks', icon: Star, label: '추천' },
{ path: '/buy-list', icon: TrendingUp, label: 'BUY조회' },  // 추가
{ path: '/settings', icon: Settings, label: '설정' },
```
