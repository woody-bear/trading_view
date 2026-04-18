# Data Model — Phase 1

**Feature**: 023-kr-naver-fundamentals
**Date**: 2026-04-15

> DB 스키마 변경 없음. 응답 DTO·서버 인메모리 상태·프론트 타입만 정의.

---

## 1. NaverFundamentalsPayload (내부 DTO)

네이버 파싱 결과 구조:

```python
class NaverFundamentalsPayload(TypedDict, total=False):
    per: float | None
    pbr: float | None
    eps: int | None
    bps: int | None
    reporting_period: str | None   # 예: "2025-Q4"
    fetched_at: str                 # ISO-8601 UTC
    source: Literal["naver"]        # 항상 "naver"
```

각 필드는 파싱 실패 시 개별 `None`. 전체 실패 시 `{"fetched_at": ..., "source": "naver"}`만 반환 가능(모든 지표 None).

---

## 2. MetricSourceMap (응답 필드)

각 metric 필드가 어느 소스에서 왔는지 표시:

```jsonc
{
  "metric_sources": {
    "market_cap":      "yfinance",
    "per":             "naver",     // 네이버 보강 성공 시
    "pbr":             "naver",
    "roe":             "yfinance",
    "roa":             "yfinance",
    "operating_margin":"yfinance",
    "eps":             "naver",
    "bps":             "naver",
    "dividend_yield":  "yfinance",
    "debt_to_equity":  "yfinance",
    "sector":          "yfinance"
  }
}
```

규칙:
- 네이버 보강이 시도되지 않은 종목(ETF/US/Crypto)은 `metric_sources`가 모두 `"yfinance"`.
- 네이버 보강 시도했으나 실패한 지표는 `"yfinance"`(폴백).
- 원본 값 자체가 결측인 지표도 소스 라벨은 마지막으로 시도한 소스명으로 표시.

---

## 3. CompanyInfoResponse (응답 확장)

기존 필드 + `metric_sources` 신규:

```jsonc
{
  "company": { ... },
  "metrics": { ... },               // 기존, 네이버 우선 병합 결과
  "revenue_segments": [...] | null,
  "asset_class": "STOCK_KR" | ...,
  "reporting_period": "2025-Q4" | null,  // 네이버 값이 있으면 덮어씀
  "metric_sources": { ... },        // ⬅️ 신규
  "cached_at": "..."
}
```

하위 호환: 022 클라이언트는 `metric_sources` 미사용 시 기존 동작 유지.

---

## 4. NaverCacheEntry (서버 인메모리)

```python
class NaverCacheEntry(TypedDict):
    payload: NaverFundamentalsPayload
    expires_at: float  # epoch seconds
```

키: `symbol` (KR 6자리).
TTL: 24시간 (86400초).
저장소: 모듈 레벨 `_cache: dict[str, NaverCacheEntry]`.

---

## 5. NaverFetchStats (관측)

```python
class NaverFetchStats(TypedDict):
    ok: int
    fail: int
    recent_fails: list[dict]  # [{symbol, stage, error, ts}, ...] max 10
```

- `stage`: `"network"` | `"decode"` | `"parse"` | `"validate"`
- `ts`: ISO-8601 UTC
- 노출 엔드포인트: `GET /api/system/naver-stats` → `{"ok": N, "fail": M, "success_rate": p, "recent_fails": [...]}`

FR-008 충족: 실패율 급증 시 운영자가 즉시 감지 가능.

---

## 6. 프론트 타입

```ts
// frontend/src/api/client.ts
export type MetricSource = 'naver' | 'yfinance'
export interface CompanyInfoResponse {
  // ... 기존 필드
  metric_sources?: Partial<Record<keyof InvestmentMetrics, MetricSource>> & {
    sector?: MetricSource
  }
}
```

`ValueAnalysisTab`의 sublabel 조합:
```ts
const sourceLabel = data.metric_sources?.[key] === 'naver' ? '네이버' : 'yfinance'
const sublabel = `${baseSublabel} · ${sourceLabel}`
```
