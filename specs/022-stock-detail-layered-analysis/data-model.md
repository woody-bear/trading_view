# Data Model — Phase 1

**Feature**: 022-stock-detail-layered-analysis
**Date**: 2026-04-14

> 본 기능은 **DB 스키마 변경이 없다**. 응답 DTO와 프론트 세션 상태 모델만 정의한다.

---

## 1. AssetClass (enum)

| 값 | 의미 | 가치 분석 탭 활성화 |
|----|------|---------------------|
| `STOCK_KR` | 국내 개별 상장주식 (코스피·코스닥) | ✅ |
| `STOCK_US` | 미국 개별 상장주식 (S&P500·NASDAQ100 등) | ✅ |
| `ETF` | 상장지수펀드 (KR/US 모두) | ❌ (disabled, 안내) |
| `CRYPTO` | 암호화폐 | ❌ |
| `INDEX` | 지수 | ❌ |
| `FX` | 외환 | ❌ |

판정 위치: `backend/services/asset_class.py::classify(symbol: str, market: str) -> AssetClass`.

---

## 2. ValuationMetrics (응답 DTO)

기존 `GET /company/{symbol}` 응답의 `metrics` 객체. 본 스펙에서 사용되는 필드:

| 필드 | 타입 | 단위/형식 | 비고 |
|------|------|---------|------|
| `market_cap` | number \| null | currency 단위(원/USD) | 스펙 우선순위 ① |
| `per` | number \| null | 배 (x) | ② |
| `pbr` | number \| null | 배 (x) | ③ |
| `roe` | number \| null | % | ④ |
| `eps` | number \| null | currency 단위 | ⑤ |
| `dividend_yield` | number \| null | % | ⑥ |
| `currency` | "KRW" \| "USD" | — | 카드 단위 표기 |

> 스펙 ⑦ `섹터(업종)`는 `company.sector` 필드(텍스트)에서 노출.
> 결측은 `null` → 프론트는 "—" 표시 (FR-003 보강 + Edge Case "일부 지표만 수집됨").

---

## 3. ValuationSnapshot (응답 래퍼 — `/company/{symbol}` 응답에 매핑)

```jsonc
{
  "company": { "name": "...", "sector": "...", "industry": "...", "country": "..." } | null,
  "metrics": ValuationMetrics | null,           // 미지원 자산군 → null
  "revenue_segments": [...] | null,             // 본 기능 미사용 (기존 유지)
  "asset_class": "STOCK_KR" | "STOCK_US" | "ETF" | "CRYPTO" | "INDEX" | "FX",  // ⬅️ 신규
  "reporting_period": "2025-Q4" | "2024-12-31" | null,  // ⬅️ 신규 (FR-007 보고 기준일)
  "cached_at": "2026-04-14T03:21:00Z" | null    // 응답 캐시 시각 (FR-007 보조)
}
```

검증 규칙:
- `asset_class`는 항상 존재 (200 응답 보장).
- `asset_class ∈ {ETF, CRYPTO, INDEX, FX}`이면 `metrics`/`reporting_period`는 `null` 가능.
- `reporting_period`는 yfinance `info["mostRecentQuarter"]`(분기) 또는 `info["lastFiscalYearEnd"]`(연간) 중 최신값으로 추출. 결측이면 `null`.
- `cached_at`은 ISO-8601 UTC, 응답 캐시 시각.

---

## 4. DetailViewState (프론트 세션 상태)

Zustand `detailViewStore`:

```ts
type ChartUiState = {
  period: '1M' | '3M' | '6M' | '1Y' | '2Y'
  sensitivity: 'strict' | 'normal' | 'sensitive'
  toggles: { bb: boolean; rsi: boolean; macd: boolean; squeeze: boolean }
}

type DetailViewStore = {
  byKey: Record<string /* `${market}:${symbol}` */, ChartUiState>
  set: (key: string, patch: Partial<ChartUiState>) => void
}
```

라이프사이클:
- 진입 시 키가 없으면 기본값으로 초기화.
- 탭 전환 시에도 보존 (FR-010).
- 새로고침 시 휘발 (persist 없음).

---

## 5. DetailTab (URL 쿼리)

- 키: `tab`
- 값: `chart` | `value`
- 누락/잘못된 값 → `chart`로 폴백.
- 탭 전환 시 history `push` (뒤로가기 지원, FR-005).
