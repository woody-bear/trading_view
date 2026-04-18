# Data Model: 공포지수 차트 개선 (013-fear-index-chart)

> DB 스키마 변경 없음. 모든 데이터는 yfinance / CNN 실시간 조회 + 메모리 캐시.

---

## Entities

### FearGreedHistory (응답 DTO)

| 필드 | 타입 | 설명 |
|------|------|------|
| `dates` | `string[]` | ISO 날짜 배열 (`YYYY-MM-DD`) |
| `values` | `number[]` | Fear & Greed 점수 (0~100) |
| `updated_at` | `string` | ISO datetime |

**Validation rules**:
- `values[i]` ∈ [0, 100]
- `dates.length === values.length`
- 빈 배열 허용 (데이터 없음 케이스)

**State transitions**: 없음 (stateless 조회)

---

### VIXHistory (응답 DTO)

| 필드 | 타입 | 설명 |
|------|------|------|
| `dates` | `string[]` | ISO 날짜 배열 |
| `values` | `number[]` | VIX 종가 |
| `updated_at` | `string` | ISO datetime |

**Validation rules**:
- `values[i]` ≥ 0
- 기준선: 20 (일반 공포), 30 (패닉) — 응답에 포함하지 않고 프론트에서 상수로 처리

---

### ChartPeriod (프론트엔드 상태)

| 값 | days | 레이블 |
|----|------|--------|
| `'1M'` | 30 | 1개월 |
| `'3M'` | 90 | 3개월 |
| `'1Y'` | 365 | 1년 |

**기본값**: `'1M'` (30일)

---

## 관련 컴포넌트 상태

```typescript
// SentimentPanel 내부 상태
const [selectedDays, setSelectedDays] = useState<30 | 90 | 365>(30)
const [vixExpanded, setVixExpanded] = useState(false)

// React Query 키 — 기간별 캐시 분리
queryKey: ['sentiment-history', selectedDays]
queryKey: ['vix-history', selectedDays]
```

---

## 기존 엔티티와의 관계

- `SentimentData` (기존 `/sentiment/overview` 응답): 변경 없음
- `MarketIndex.vix` (기존): VIX 현재값은 계속 overview에서 조회, VIX 히스토리만 신규 엔드포인트
