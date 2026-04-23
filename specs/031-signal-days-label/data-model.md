# Data Model: BUY Signal Age Label

**Phase 1 output** | 2026-04-23

---

## 신규/변경 데이터 구조

### 1. `Signal` TypeScript 타입 (frontend/src/types/index.ts)

기존 타입에 필드 1개 추가:

```typescript
export interface Signal {
  // ... 기존 필드 ...
  last_signal_date?: string  // 'YYYY-MM-DD' | undefined — BUY 신호 발생일
}
```

- **출처**: 백엔드 `/signals` 응답 (P2 구현 후 포함)
- **선택적 필드**: 스캔 이력이 없는 종목은 undefined

---

### 2. `fmtSignalAge` 반환 타입 (frontend/src/utils/format.ts)

```typescript
interface SignalAgeResult {
  label: string   // "오늘" | "N일 전"
  fresh: boolean  // true = 7일 이하, false = 8일 이상
}

// null 반환: dateStr이 없거나 미래 날짜인 경우
function fmtSignalAge(dateStr: string | undefined | null): SignalAgeResult | null
```

---

### 3. 경과일 계산 규칙

```
days = floor((today_midnight - signal_date_midnight) / 86_400_000)

days === 0  →  { label: '오늘',    fresh: true  }
days === 1  →  { label: '1일 전',  fresh: true  }
days <= 7   →  { label: 'N일 전',  fresh: true  }
days >= 8   →  { label: 'N일 전',  fresh: false }
days <  0   →  null  (미래 날짜 오류)
```

상수: `FRESH_SIGNAL_DAYS = 7`

---

### 4. 백엔드 signals 응답 변경 (backend/routes/signals.py)

기존 응답 dict에 필드 추가:

```python
signals.append({
    # ... 기존 필드 ...
    "last_signal_date": snapshot_last_signal_date,  # str | None, 'YYYY-MM-DD'
})
```

- **데이터 소스**: `ScanSnapshotItem.last_signal_date` — symbol별 최신 값 (LEFT JOIN)
- **NULL 처리**: JOIN 미매칭 시 `None` 반환 → 프론트에서 `undefined` 처리

---

## DB 변경 없음

| 항목 | 변경 |
|------|------|
| 신규 테이블 | 없음 |
| 신규 컬럼 | 없음 |
| 마이그레이션 | 없음 |
| 활용 기존 테이블 | `ScanSnapshotItem.last_signal_date` (기존 컬럼) |

---

## 컴포넌트별 수정 범위

| 파일 | 수정 유형 | 주요 변경 |
|------|---------|----------|
| `frontend/src/types/index.ts` | 수정 | `Signal`에 `last_signal_date?: string` 추가 |
| `frontend/src/utils/format.ts` | 수정 | `fmtSignalAge()` 함수 + `FRESH_SIGNAL_DAYS` 상수 추가 |
| `frontend/src/pages/Dashboard.tsx` (BuyCard) | 수정 | 기존 날짜 raw 텍스트 → `fmtSignalAge` 칩 (compact + PC) |
| `backend/routes/signals.py` | 수정 | LEFT JOIN + `last_signal_date` 필드 응답 포함 |
| `frontend/src/components/WatchlistPanel.tsx` (MiniWatchCard) | 수정 | BUY 상태일 때 `fmtSignalAge` 칩 표시 |

---

## 불변 사항

- DB 스키마 변경 없음
- 새 컴포넌트/훅 생성 없음
- `ScanSnapshotItem` 테이블 수정 없음
- `CurrentSignal` 테이블 수정 없음
