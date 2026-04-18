# Research: BUY 사인조회 주식목록 페이지

**Feature**: 009-buy-scan-watchlist
**Date**: 2026-03-30

---

## 1. 종목 데이터 소스

**Decision**: 기존 `stock_master` DB 테이블을 직접 활용. 새 API 엔드포인트 `/api/scan/symbols` 추가.

**실제 종목 수 (DB 확인 완료)**:

| market_type | is_etf | 수량 |
|-------------|--------|------|
| KOSPI       | False  | 934  |
| KOSPI       | True   | 870  |
| KOSDAQ      | False  | 1,784 |
| NASDAQ      | False  | 107  |
| NYSE        | True   | 84   |
| **합계**    |        | **3,779** |

**StockMaster 모델 컬럼**: id, symbol, name, market(KR/US), market_type(KOSPI/KOSDAQ/NASDAQ/NYSE), is_etf, updated_at

**Rationale**: DB에 이미 전 종목이 있으므로 추가 다운로드 불필요. 별도 API 엔드포인트 1개만 추가하면 됨.

**Alternatives considered**: yfinance/pykrx 실시간 조회 → 너무 느림, 불필요.

---

## 2. 스캔 스케줄 현황

**Decision**: 기존 `/api/scan/full/history` + `/api/scan/full/status` API 재사용.

**실제 스케줄 (scheduler.py 확인)**:

| Job ID | 실행 시각(KST) | 대상 시장 | 실행 요일 |
|--------|--------------|-----------|----------|
| full_market_scan | 9:30, 10:30, 11:30, 12:30, 13:30, 14:30, 15:30 | KR | 평일 |
| full_market_scan_us_evening | 19:50 | US | 평일 |
| full_market_scan_us_dawn | 03:50 | US | 화-토 |

**총 9개 스케줄 슬롯** (KR 7회 + US 2회)

**상황판 표시 방법**: history API에서 오늘 날짜 기준 실행 기록 필터링. 완료 시각 기준으로 해당 슬롯에 매핑.

**Rationale**: 새 폴링 없이 기존 API로 충분. 상황판은 페이지 로드 시 1회 조회 + 진행중일 때만 5초 폴링.

---

## 3. 종목 목록 성능 (3,779개)

**Decision**: 클라이언트 사이드 필터링 + 가상화 없이 DOM 렌더링. 단, 카테고리별로 분할 렌더링.

**Rationale**: 3,779개는 React DOM 한계(~10만개)에 한참 미달. 카테고리별 토글 접기/펼치기로 초기 렌더링 부담 분산. 검색 필터는 브라우저 메모리 내 O(n) 검색으로 충분(< 1ms).

**Alternatives considered**: 가상 스크롤 → 구현 복잡도 대비 효과 미미한 규모.

---

## 4. 신규 API 엔드포인트

**Decision**: `/api/scan/symbols` (GET) 1개만 추가.

```
GET /api/scan/symbols
Response: {
  "total": 3779,
  "breakdown": {
    "kospi": 934,
    "kospi_etf": 870,
    "kosdaq": 1784,
    "nasdaq": 107,
    "nyse_etf": 84
  },
  "symbols": [
    { "symbol": "005930", "name": "삼성전자", "market": "KR", "market_type": "KOSPI", "is_etf": false },
    ...
  ]
}
```

**Rationale**: 기존 `search_master`는 검색용이라 limit 있음. 전체 조회 전용 엔드포인트 필요. 인증 불필요 (공개 종목 목록).

---

## 5. 네비게이션 추가

**Decision**: PC 상단 헤더에 링크 추가 + 모바일 하단탭에 6번째 탭 추가.

**현재 모바일 탭 5개**: 홈/스캔/환율/추천/설정
**추가 후 6개**: 홈/스캔/환율/추천/BUY조회/설정

**모바일 레이아웃**: 6탭이 되면 각 탭 너비가 16.7%. 아이콘 크기 22→20, 라벨 10px 유지. iPhone SE(320px)에서도 충분.

**PC 헤더**: 기존 `추천`, `환율` 링크 옆에 `BUY조회` 링크 추가 (cyan 색상, 기존 gold/emerald와 구분).

**Route**: `/buy-list` (기존 `/:symbol` 동적 라우트와 충돌 방지를 위해 명시적 경로)

---

## 6. 스캔 상황판 슬롯 매핑 로직

**Decision**: 프론트엔드에서 슬롯 목록을 하드코딩 후 history API 결과로 상태 채움.

```
SCAN_SLOTS = [
  { time: "09:30", label: "09:30", market: "KR" },
  { time: "10:30", label: "10:30", market: "KR" },
  { time: "11:30", label: "11:30", market: "KR" },
  { time: "12:30", label: "12:30", market: "KR" },
  { time: "13:30", label: "13:30", market: "KR" },
  { time: "14:30", label: "14:30", market: "KR" },
  { time: "15:30", label: "15:30", market: "KR" },
  { time: "19:50", label: "19:50", market: "US" },
  { time: "03:50", label: "03:50+1", market: "US" },
]
```

history의 `started_at` 또는 `completed_at`을 KST로 변환 후 HH:mm이 슬롯 time과 ±10분 이내이면 매핑.

---

## 7. 기존 패턴 재사용

- Settings.tsx의 `scanHistory`/`scanStatus` 상태 관리 패턴 그대로 사용
- Dashboard.tsx의 `MarketScanBox` 레이아웃 참고
- TopPicks.tsx의 `PickSection` 카드 패턴 참고
- `fetchFullScanHistory`, `fetchFullScanStatus` API 함수 재사용 (client.ts에 이미 있음)
