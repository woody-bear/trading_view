# Research: 종목 상세 — 투자 지표 및 회사 정보 패널

**Feature**: 018-stock-detail-info  
**Date**: 2026-04-08

---

## Decision 1: 데이터 소스 — yfinance ticker.info

**Decision**: yfinance `ticker.info` dict를 단일 소스로 사용

**Rationale**: 이미 backend에 설치·사용 중 (`financials.py`, `quick_chart.py`). KIS 없이 동작하는 유일한 무료 옵션. US 주식은 대부분의 필드가 채워지고, KR 주식은 일부 지표만 제공되는 한계를 "-" 표시로 허용.

**Fields available in ticker.info**:
| Field | 용도 |
|-------|------|
| `longBusinessSummary` | 사업 개요 |
| `industry` | 업종 |
| `sector` | 섹터 |
| `country` | 국가 |
| `exchange` | 거래소 |
| `fullTimeEmployees` | 직원 수 |
| `website` | 웹사이트 |
| `logo_url` | 로고 URL |
| `trailingPE` | PER (TTM) |
| `priceToBook` | PBR |
| `returnOnEquity` | ROE |
| `returnOnAssets` | ROA |
| `trailingEps` | EPS (TTM) |
| `bookValue` | BPS |
| `dividendYield` | 배당수익률 |
| `marketCap` | 시가총액 |
| `operatingMargins` | 영업이익률 |
| `debtToEquity` | 부채비율 |

**Revenue segments**: `ticker.revenue_by_product` (pandas DataFrame, US 대형주에만 존재). None/empty이면 섹션 미표시.

**Alternatives considered**:
- KIS API: KIS 설정 필요 → FR-001 위반
- DART API: 국내 전용 + 별도 인증 필요
- Financial Modeling Prep: 유료

---

## Decision 2: 한국 종목 티커 포맷

**Decision**: `financials.py`와 동일 패턴 사용 — KOSDAQ → `.KQ`, KR/KOSPI → `.KS`

**Rationale**: 기존 코드베이스 일관성. `chart_cache.py`는 stock_master DB 조회를 추가하지만, 신규 endpoint는 단순성 우선 — market 파라미터를 직접 사용.

**Pattern**:
```python
if market == "KOSDAQ":
    ticker_sym = f"{symbol}.KQ"
elif market in ("KR", "KOSPI"):
    ticker_sym = f"{symbol}.KS"
else:
    ticker_sym = symbol  # US direct, CRYPTO skip
```

---

## Decision 3: 캐시 전략

**Decision**: 모듈 레벨 dict + 1시간 TTL (financials.py와 동일 패턴)

**Rationale**: 동일 패턴이 이미 두 곳에서 사용됨(`financials.py`, `prices.py`). DB 없이 동작, 서버 재시작 시 자동 초기화. yfinance ticker.info는 하루 단위 변동 → 1시간 TTL로 충분.

**Pattern**:
```python
_cache: dict[str, dict] = {}
_CACHE_TTL = 3600

cache_key = f"{market}:{symbol}"
if cache_key in _cache and time.time() - _cache[cache_key]["_ts"] < _CACHE_TTL:
    return _cache[cache_key]["data"]
# ... fetch ...
_cache[cache_key] = {"data": data, "_ts": time.time()}
```

---

## Decision 4: 신규 엔드포인트 분리

**Decision**: 기존 `/stocks/{symbol}/detail` (KIS 전용)을 건드리지 않고 새 엔드포인트 `GET /api/company/{symbol}` 추가

**Rationale**: 기존 KIS endpoint는 StockFundamentals 컴포넌트가 의존 — SC-003(회귀 없음) 준수. 관심사 분리: KIS 데이터 vs yfinance 회사 정보.

**Alternatives considered**: 기존 endpoint에 조건 분기 추가 — KIS 미설정 시 yfinance fallback — 복잡도 증가, 테스트 어려움 → 기각.

---

## Decision 5: 프론트엔드 컴포넌트 구조

**Decision**: 3개 컴포넌트 분리 — `CompanyInfoPanel`, `InvestmentMetricsPanel`, `RevenueSegmentChart`

**Rationale**: 각 섹션이 독립적으로 로딩/실패 처리 가능 (FR-012). 단, 데이터는 단일 API 호출로 가져와 prop drilling 방지.

**Mobile Accordion Pattern**: `useState(false)` + `md:block` / `md:hidden` — AlertHistory.tsx에서 이미 사용된 패턴.

**Card styling** (기존 코드베이스 일치):
```tsx
<div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3 mb-4">
```

---

## Decision 6: Revenue Segments 도넛 차트 라이브러리

**Decision**: SVG 직접 렌더링 (recharts/chart.js 미설치)

**Rationale**: 프로젝트에 recharts/chart.js 없음. 간단한 도넛 차트는 SVG `<circle>` + `strokeDasharray`로 구현 가능. 의존성 추가 불필요.

**Alternatives considered**: recharts 설치 — P2 기능에 새 패키지 추가는 과도한 비용 → SVG로 대체.
