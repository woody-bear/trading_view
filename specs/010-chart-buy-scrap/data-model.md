# Data Model: BUY 차트 라벨 클릭 — 사례 스크랩 추가

**Branch**: `010-chart-buy-scrap` | **Date**: 2026-04-01

---

## 기존 엔티티 (수정)

### PatternCase (`backend/models.py`, `pattern_case` 테이블)

기존 테이블에 두 컬럼 추가. 마이그레이션: `016_add_source_user_id_pattern_case.py`

| 컬럼 | 타입 | 변경 | 설명 |
|------|------|------|------|
| `id` | INTEGER PK | 기존 | 자동 증가 |
| `title` | VARCHAR(200) | 기존 | 사례 제목 |
| `symbol` | VARCHAR(20) | 기존 | 종목 코드 |
| `stock_name` | VARCHAR(100) | 기존 | 종목명 |
| `market` | VARCHAR(10) | 기존 | KR / US / CRYPTO |
| `market_type` | VARCHAR(20) | 기존 | nullable |
| `pattern_type` | VARCHAR(30) | 기존 | squeeze_breakout / oversold_bounce / custom |
| `signal_date` | VARCHAR(10) | 기존 | BUY 신호 발생일 (YYYY-MM-DD) |
| `entry_price` | FLOAT | 기존 | nullable |
| `exit_price` | FLOAT | 기존 | nullable |
| `result_pct` | FLOAT | 기존 | nullable, 수익률 % |
| `hold_days` | INTEGER | 기존 | nullable |
| `rsi` | FLOAT | 기존 | nullable, BUY 시점 RSI |
| `bb_pct_b` | FLOAT | 기존 | nullable, BB %B |
| `bb_width` | FLOAT | 기존 | nullable, BB 폭 |
| `macd_hist` | FLOAT | 기존 | nullable, MACD 히스토그램 |
| `volume_ratio` | FLOAT | 기존 | nullable, 거래량 배율 |
| `ema_alignment` | VARCHAR(10) | 기존 | nullable, BULL/BEAR/NEUTRAL |
| `squeeze_level` | INTEGER | 기존 | nullable, 0~3 |
| `conditions_met` | INTEGER | 기존 | nullable, 충족 조건 수 |
| `tags` | TEXT | 기존 | nullable, JSON 배열 |
| `notes` | TEXT | 기존 | nullable, 사용자 메모 |
| `created_at` | DATETIME | 기존 | 생성 시각 |
| `updated_at` | DATETIME | 기존 | 수정 시각 |
| **`source`** | VARCHAR(20) | **신규** | `'chart'` (차트 자동) \| `'manual'` (수동 입력). 기본값 `'manual'` |
| **`user_id`** | UUID | **신규** | nullable. Supabase auth.users.id. 기존 데이터는 NULL 유지 |

**유니크 제약 (신규)**: `uq_pattern_case_user_symbol_date` — `(user_id, symbol, signal_date)` — 동일 사용자의 동일 종목·날짜 중복 저장 방지

**인덱스 (신규)**: `idx_pattern_case_user` — `user_id` 컬럼 단독

---

## 엔티티 상태 전이

```
BUY 라벨 (차트)
    │
    │ hover → 저장 버튼 표시
    │ click → [중복 체크] → 중복이면 경고, 아니면 indicators-at 조회
    ▼
PatternCase (source='chart')
    │
    ├── notes 편집 → debounce 1.5s → PATCH /api/pattern-cases/{id}
    │
    └── 삭제 → 인라인 확인 → DELETE → BUY 라벨 "저장됨" 해제
```

---

## 프론트엔드 상태 모델

### `ScrapState` (SignalDetail.tsx 내부)

```typescript
interface ScrapState {
  scrapedDates: Set<string>          // 현재 symbol의 스크랩된 signal_date 집합
  hoveredMarkerTime: number | null   // 현재 hover 중인 BUY 마커의 timestamp
  overlayPos: { x: number; y: number } | null  // 오버레이 픽셀 좌표
  saving: boolean                    // 저장 중 여부
}
```

### `MemoState` (Scrap.tsx CaseAccordion 내부)

```typescript
interface MemoState {
  draft: string           // textarea 현재 값
  status: 'idle' | 'saving' | 'saved'
  timer: ReturnType<typeof setTimeout> | null
}
```

---

## 변경이 없는 엔티티

- `Watchlist` — 읽기 전용 참조 (symbol, market 확인용)
- `chart_cache` — `GET /api/chart/indicators-at`에서 읽기 전용 활용
- 기타 모든 테이블 — 변경 없음
