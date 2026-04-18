# Data Model — Phase 1

**Feature**: 024-trend-trading-signals
**Date**: 2026-04-16

> DB 스키마 변경 없음. 응답 DTO와 내부 타입만 정의.

---

## 1. TrendType (enum)

| 값 | 의미 | 매수/매도 노출 |
|----|------|:---:|
| `uptrend` | 상승추세 | ✅ |
| `downtrend` | 하락추세 | ✅ |
| `sideways` | 평행(보합/박스권) | ✅ |
| `triangle` | 삼각수렴(쐐기형) | ✅ |
| `unknown` | 분류 불가 | ❌ |
| `insufficient_data` | 120봉 미만 데이터 부족 | ❌ |

---

## 2. TrendClassification (DTO)

```jsonc
{
  "type": "uptrend | downtrend | sideways | triangle | unknown | insufficient_data",
  "confidence": 0.0 - 1.0,          // 분류 신뢰도 (옵션; 경계 근처일수록 낮음)
  "window_size": 120,                // 사용한 봉 수 (디폴트 120)
  "slope_high": 0.12,                // 고점 회귀 기울기 (% 대비 일일)
  "slope_low": 0.15,                 // 저점 회귀 기울기
  "last_close": 458.75,              // 참조 현재가
  "evaluated_at": "2026-04-16T12:00:00Z"
}
```

검증 규칙:
- `type`은 항상 존재
- `type == insufficient_data`면 나머지 필드는 `null` 가능
- `confidence`는 0~1 사이. 디폴트 계산: `min(|slope_high|, |slope_low|) / ε`을 클램프.

---

## 3. TrendLineKind (enum)

| 값 | 의미 |
|----|------|
| `support_up` | 상승 지지선 |
| `resistance_up` | 상승 저항선 |
| `support_down` | 하락 지지선 |
| `resistance_down` | 하락 저항선 |
| `box_top` | 박스 상단 (수평) |
| `box_bottom` | 박스 하단 (수평) |
| `triangle_support` | 삼각수렴 하단(저점 추세선) |
| `triangle_resistance` | 삼각수렴 상단(고점 추세선) |

---

## 4. TrendLine (DTO)

```jsonc
{
  "kind": "support_up" | ...,
  "start": { "time": 1776123456, "price": 410.0 },  // Unix seconds + price
  "end":   { "time": 1776723456, "price": 455.0 },  // 마지막 봉 시점 + 연장값
  "style": {
    "color": "#22c55e",              // 프론트 렌더 힌트
    "dashed": true
  }
}
```

- 차트 오버레이 시 `start` → `end` 두 점으로 직선 렌더
- 박스 라인(수평)은 `start.price == end.price`

---

## 5. TradingSignalKind (enum)

| 값 | 라벨 | 색·아이콘 |
|----|------|:---:|
| `buy_candidate` | 매수 후보 구간 | 🟢 📍 |
| `watch` | 관망 | 🟡 |
| `sell_candidate_1` | 매도 후보 구간 (1차) | 🔴 ⚠️ |
| `sell_candidate_2` | 강한 매도 후보 | 🔴 ⚠️ |

---

## 6. TradingSignal (DTO)

```jsonc
{
  "kind": "buy_candidate | watch | sell_candidate_1 | sell_candidate_2",
  "price": 402.5,                    // 기준 가격 (관망 시 null 가능)
  "condition": "지지선 X원 근처 매수 적합",  // 한글 문장
  "distance_pct": -1.35,             // 현재가 대비 거리(%), 음수=현재가 아래
  "is_near": true                    // 현재가와 ±2% 이내이면 true (FR-011 강조용)
}
```

---

## 7. TrendAnalysisResponse (최상위 응답)

```jsonc
{
  "symbol": "MU",
  "market": "US",
  "classification": TrendClassification,
  "lines": TrendLine[],              // 빈 배열 가능 (unknown/insufficient_data)
  "buy_signals": TradingSignal[],    // 빈 배열 가능
  "sell_signals": TradingSignal[],   // 빈 배열 가능
  "disclaimer": "본 안내는 참고용이며 투자 책임은 사용자에게 있습니다.",
  "current_price": 458.75,
  "evaluated_at": "2026-04-16T12:00:00Z"
}
```

---

## 8. 프론트 타입 매핑

```ts
// frontend/src/api/client.ts 또는 types
export type TrendType =
  | 'uptrend' | 'downtrend' | 'sideways' | 'triangle'
  | 'unknown' | 'insufficient_data'

export interface TrendClassification {
  type: TrendType
  confidence: number | null
  window_size: number
  slope_high: number | null
  slope_low: number | null
  last_close: number | null
  evaluated_at: string
}

export interface TrendLine {
  kind: string
  start: { time: number; price: number }
  end:   { time: number; price: number }
  style: { color: string; dashed: boolean }
}

export interface TradingSignal {
  kind: 'buy_candidate' | 'watch' | 'sell_candidate_1' | 'sell_candidate_2'
  price: number | null
  condition: string
  distance_pct: number | null
  is_near: boolean
}

export interface TrendAnalysisResponse {
  symbol: string
  market: string
  classification: TrendClassification
  lines: TrendLine[]
  buy_signals: TradingSignal[]
  sell_signals: TradingSignal[]
  disclaimer: string
  current_price: number | null
  evaluated_at: string
}
```

---

## 9. 서버 상태 (선택)

`services/trend_analysis.py` 내부 in-memory 캐시:
```python
_cache: dict[tuple[str, str], tuple[float, TrendAnalysisResponse]] = {}
TTL_SECONDS = 60.0
```
- 키: `(symbol, market)`
- 값: `(timestamp, payload)`
- TTL 60초

---

## 10. 프론트 Zustand — 토글 상태

```ts
// stores/trendOverlayStore.ts
interface TrendOverlayStore {
  showLines: boolean               // 기본 false (토글 OFF)
  toggle: () => void
}
```
- 세션 단위 보존 (새로고침 시 OFF로 리셋)
- Persist 미사용
