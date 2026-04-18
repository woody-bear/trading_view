# API Contracts: BUY 차트 라벨 클릭 — 사례 스크랩 추가

**Branch**: `010-chart-buy-scrap` | **Date**: 2026-04-01

---

## 기존 엔드포인트 (수정)

### GET /api/pattern-cases

기존 쿼리 파라미터에 `user_id` 추가. Authorization 헤더로 user_id 자동 추출.

**변경**: `user_id` 필터 추가 (로그인 사용자 사례만 반환). 미로그인이면 403.

**응답 아이템 신규 필드**:
```json
{
  "source": "chart" | "manual",
  "user_id": "uuid-string"
}
```

---

### POST /api/pattern-cases

**기존과 동일**, 신규 필드 추가:

**요청 바디 추가 필드**:
```json
{
  "source": "chart"
}
```

**중복 시 409 Conflict**:
```json
{ "detail": "이미 스크랩된 사례입니다" }
```

---

### PATCH /api/pattern-cases/{id}

기존과 동일. `notes` 필드만 업데이트하는 빈번한 호출 (debounce 자동저장) 포함.

---

### DELETE /api/pattern-cases/{id}

기존과 동일. 삭제 후 204 반환.

---

## 신규 엔드포인트

### GET /api/pattern-cases/check

중복 여부 확인.

**Query Parameters**:
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `symbol` | string | ✅ | 종목 코드 |
| `signal_date` | string | ✅ | YYYY-MM-DD |

**Authorization**: Bearer JWT (user_id 추출용)

**응답 200**:
```json
{
  "exists": true,
  "id": 42
}
```
```json
{
  "exists": false,
  "id": null
}
```

---

### GET /api/chart/indicators-at

특정 날짜의 지표값 조회. 저장 버튼 클릭 시 호출.

**Query Parameters**:
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `symbol` | string | ✅ | 종목 코드 |
| `market` | string | ✅ | KR / US / CRYPTO |
| `date` | string | ✅ | YYYY-MM-DD |

**응답 200**:
```json
{
  "symbol": "AAPL",
  "date": "2026-03-20",
  "rsi": 38.5,
  "bb_pct_b": 0.12,
  "bb_width": 0.045,
  "macd_hist": -0.23,
  "volume_ratio": 1.8,
  "ema_alignment": "BULL",
  "squeeze_level": 1,
  "conditions_met": 3,
  "close": 215.30
}
```

**응답 404**: 해당 날짜 데이터 없음
```json
{ "detail": "해당 날짜 데이터를 찾을 수 없습니다" }
```

---

## UI 컴포넌트 계약

### IndicatorChart Props (수정)

```typescript
interface Props {
  data: ChartData
  watchlistId?: number
  realtimePrice?: RealtimePrice | null
  buyPoint?: BuyPoint | null
  onBuyMarkerClick?: (point: { price: number; markerTime: number }) => void
  // 신규
  scrapedDates?: Set<string>           // 스크랩된 날짜 집합 (YYYY-MM-DD)
  onScrapSave?: (markerTime: number, date: string) => void  // 저장 버튼 클릭
}
```

**BUY 마커 시각화 규칙**:
- 미스크랩: 기존 초록색 `#22c55e`
- 스크랩됨: 골드색 `#f59e0b` + 마커 크기 동일
- hover 시: 오버레이 버튼 표시 (미스크랩: "이 BUY 사례 저장" / 스크랩됨: "저장됨 ✓")

### CaseAccordion Props (수정)

```typescript
interface CaseAccordionProps {
  c: PatternCase       // source 필드 포함
  onDelete: (id: number) => void
  onNavigateToChart: (symbol: string, market: string, signalDate: string) => void
  // 편집 모달 제거 (notes는 인라인 debounce로)
}
```

**인라인 삭제 UI 상태**:
```
[삭제] 버튼 클릭 → confirmDelete: true → "정말 삭제하시겠습니까? [확인] [취소]" 인라인 표시
```

**출처 뱃지 표시 규칙**:
- `source === 'chart'`: `📊 차트` (회색 작은 뱃지)
- `source === 'manual'` 또는 null: `✏️ 수동` (회색 작은 뱃지)
