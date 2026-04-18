# Implementation Plan: 종목 상세 — 투자 지표 및 회사 정보 패널

**Branch**: `018-stock-detail-info` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)

---

## Summary

yfinance `ticker.info`를 사용해 KIS 설정 없이도 종목 상세에서 회사 소개·확장 투자 지표·매출 구성을 표시.

- **Backend**: 새 엔드포인트 `GET /api/company/{symbol}` — yfinance ticker.info에서 CompanyInfo + InvestmentMetrics + RevenueSegments 반환, 1시간 메모리 캐시.
- **Frontend**: `CompanyInfoPanel`, `InvestmentMetricsPanel`, `RevenueSegmentChart` 3개 컴포넌트를 `SignalDetail.tsx`의 `FinancialChart` 아래에 삽입. 모바일 아코디언, PC 상시 표시.
- **DB 변경 없음**.

---

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5.x / React 18 (frontend)  
**Primary Dependencies**: FastAPI, yfinance (이미 설치), React Query, Tailwind CSS v4  
**Storage**: N/A — 메모리 캐시만 사용 (DB 변경 없음)  
**Testing**: pytest (backend), pnpm test (frontend)  
**Target Platform**: 단일 서버 (FastAPI), React SPA (Vite)  
**Project Type**: Web application (backend API + frontend SPA)  
**Performance Goals**: 캐시 hit 시 0.5초 이내, 첫 조회 3초 이내 (SC-001, SC-004)  
**Constraints**: KIS 미설정 환경에서 동작 필수 (FR-001)  
**Scale/Scope**: 단일 사용자, yfinance 하루 단위 업데이트

---

## Constitution Check

이 프로젝트에는 custom constitution이 없음 (템플릿 상태). 프로젝트 기존 관행 기준으로 평가:

| 규칙 | 상태 | 비고 |
|------|------|------|
| 기존 코드베이스 일관성 | PASS | financials.py 패턴 동일 적용 |
| KIS 의존성 없음 | PASS | yfinance만 사용 |
| DB 스키마 변경 없음 | PASS | 메모리 캐시만 |
| 기존 KIS StockFundamentals 유지 | PASS | 기존 컴포넌트 변경 없음 (SC-003) |
| CRYPTO 예외 처리 | PASS | 즉시 null 반환 |

---

## Project Structure

### Documentation (this feature)

```text
specs/018-stock-detail-info/
├── plan.md              ← 이 파일
├── research.md          ← Phase 0 완료
├── data-model.md        ← Phase 1 완료
├── contracts/
│   └── api.md           ← Phase 1 완료
└── tasks.md             ← Phase 2 (/speckit.tasks 명령)
```

### Source Code (변경/추가 파일)

```text
backend/
├── routes/
│   └── company.py       ← 신규: GET /api/company/{symbol}
└── app.py               ← 기존: router 등록 1줄 추가

frontend/src/
├── api/
│   └── client.ts        ← 기존: fetchCompanyInfo 함수 추가
├── components/
│   ├── CompanyInfoPanel.tsx      ← 신규
│   ├── InvestmentMetricsPanel.tsx ← 신규
│   └── RevenueSegmentChart.tsx   ← 신규
└── pages/
    └── SignalDetail.tsx  ← 기존: FinancialChart 아래에 3개 컴포넌트 삽입
```

---

## Implementation Tasks

### Task 1 — Backend: company.py 엔드포인트

**파일**: `backend/routes/company.py` (신규)

```python
# GET /api/company/{symbol}?market=KR
# 1. CRYPTO → {"company": null, "metrics": null, "revenue_segments": null}
# 2. 캐시 확인 (TTL 1시간)
# 3. ticker 포맷 결정: KOSDAQ→.KQ, KR/KOSPI→.KS, US→direct
# 4. yf.Ticker(ticker_sym).info 조회 (asyncio.to_thread)
# 5. CompanyInfo, InvestmentMetrics 추출
# 6. revenue_by_product DataFrame → RevenueSegment 목록 (없으면 None)
# 7. 캐시 저장 후 반환
```

**핵심 처리**:
- `info.get("returnOnEquity")` 등 소수값 → `round(val * 100, 2)` % 변환
- `info.get("dividendYield")`: 0 또는 None → `None` (0%와 무배당 구분)
- `revenue_by_product`: `t.revenue_by_product` — `None` 또는 `AttributeError` → `None`으로 처리
- 전체 try/except: 실패 시 `{"company": None, "metrics": None, "revenue_segments": None}` 반환

---

### Task 2 — Backend: app.py 라우터 등록

**파일**: `backend/app.py` (기존)

```python
from routes.company import router as company_router
app.include_router(company_router, prefix="/api")
```

---

### Task 3 — Frontend: fetchCompanyInfo API 함수

**파일**: `frontend/src/api/client.ts` (기존)

```typescript
export const fetchCompanyInfo = (symbol: string, market: string) =>
  api.get(`/company/${symbol}`, { params: { market } }).then(r => r.data)
```

---

### Task 4 — Frontend: CompanyInfoPanel 컴포넌트

**파일**: `frontend/src/components/CompanyInfoPanel.tsx` (신규)

- Props: `{ symbol: string, market: string }`
- CRYPTO → `null` 반환 (렌더 없음)
- `useQuery(['company-info', symbol], fetchCompanyInfo(symbol, market), { staleTime: 3600000 })`
- 로딩 중: 스켈레톤 (2~3줄 pulse 애니메이션)
- 데이터 없음/실패: `null` 반환 (섹션 숨김)
- 로고: `<img src={logo_url} onError={showAvatar}/>` → 실패 시 첫 글자 원형 아바타
- 사업 개요: 4줄 초과 시 `line-clamp-4` + "더 보기" 토글 (FR-008)
- 직원 수: `toLocaleString('ko-KR')` 형식
- **모바일**: 아코디언 (기본 collapsed, `useState(false)`)
- **PC**: 항상 표시 (`md:block`)

---

### Task 5 — Frontend: InvestmentMetricsPanel 컴포넌트

**파일**: `frontend/src/components/InvestmentMetricsPanel.tsx` (신규)

- Props: `{ symbol: string, market: string }`
- 동일 `useQuery` 결과 재사용 (부모에서 prop으로 받거나 동일 queryKey로 캐시 공유)
- 지표 카드 그리드: `grid grid-cols-3 gap-2 md:grid-cols-4`
- 표시 지표: PER(TTM), PBR, ROE, ROA, EPS(TTM), BPS, 배당수익률, 시가총액, 영업이익률, 부채비율
- 강조 표시 (FR-007):
  - PER < 10 → `text-blue-400` + "저평가" 뱃지
  - PER > 30 → `text-red-400` + "고평가" 뱃지
  - ROE > 15% → `text-green-400`
- 단위 (FR-006): 배, %, 원($), 억/조
- `null` 값 → `"-"` 표시

---

### Task 6 — Frontend: RevenueSegmentChart 컴포넌트

**파일**: `frontend/src/components/RevenueSegmentChart.tsx` (신규)

- Props: `{ segments: RevenueSegment[] | null, currency: string }`
- `segments`가 null이거나 빈 배열 → `null` 반환 (섹션 숨김)
- SVG 도넛 차트: `<circle>` + `strokeDasharray` / `strokeDashoffset`
- 범례: 세그먼트명 + 비중(%) 목록
- 기준 날짜 표시: "YYYY.MM 기준" (FR-005, SC-003)

---

### Task 7 — Frontend: SignalDetail.tsx 통합

**파일**: `frontend/src/pages/SignalDetail.tsx` (기존)

- `import CompanyInfoPanel from '../components/CompanyInfoPanel'`
- `import InvestmentMetricsPanel from '../components/InvestmentMetricsPanel'`
- `import RevenueSegmentChart from '../components/RevenueSegmentChart'`
- `FinancialChart` (line 483) 바로 아래에 3개 컴포넌트 삽입:

```tsx
<FinancialChart symbol={lookupSymbol} market={s.market} />
<CompanyInfoPanel symbol={lookupSymbol} market={s.market} />
<InvestmentMetricsPanel symbol={lookupSymbol} market={s.market} />
```

- `RevenueSegmentChart`는 `CompanyInfoPanel` 또는 `InvestmentMetricsPanel` 내부에서 segments prop으로 처리

---

## 컴포넌트 데이터 공유 전략

`CompanyInfoPanel`과 `InvestmentMetricsPanel`이 동일한 API 응답을 사용하므로:

- **방법**: 두 컴포넌트 모두 동일한 `queryKey: ['company-info', symbol, market]`로 React Query 사용
- React Query가 자동으로 캐시 공유 → 단일 네트워크 요청
- `InvestmentMetricsPanel`은 별도 query 불필요 — 동일 queryKey이므로 즉시 캐시 반환

---

## Edge Cases & Failure Modes

| 케이스 | 처리 방법 |
|--------|----------|
| CRYPTO 종목 | 백엔드에서 즉시 null 반환 → 프론트 섹션 미표시 |
| yfinance 조회 실패 | try/except → null 반환 → 프론트 섹션 미표시 |
| 로고 이미지 404 | `onError` → 첫 글자 텍스트 아바타 |
| 사업 개요 없음 | description null → 설명 영역 미표시 |
| 배당 없는 종목 | `dividendYield` 0 → null 처리 → "-" 표시 |
| revenue_segments 없음 | null → RevenueSegmentChart 미표시 |
| KR 주식 대부분 지표 없음 | null → "-" 표시, 레이아웃 유지 |

---

## Complexity Tracking

변경 없음 — 기존 패턴(financials.py, StockFundamentals.tsx)을 그대로 따름. 신규 파일 2개(backend route, 3개 frontend components)로 최소 범위.
