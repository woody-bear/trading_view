# Implementation Plan: BUY Signal Age Label on Stock Cards

**Branch**: `031-signal-days-label` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/031-signal-days-label/spec.md`

---

## Summary

추천종목·눌림목·대형주·관심종목 카드에 BUY 신호 경과일을 "오늘" / "N일 전" 형식으로 표시하는 라벨을 추가한다. P1(스캔 결과 화면)은 프론트엔드만 수정하면 되고, P2(관심종목)는 백엔드 signals 엔드포인트에서 `ScanSnapshotItem` LEFT JOIN으로 `last_signal_date`를 포함시킨다. DB 마이그레이션은 불필요.

---

## Technical Context

**Language/Version**: TypeScript 5 / React 18 (frontend), Python 3.11 (backend)
**Primary Dependencies**: React, Tailwind CSS, FastAPI, SQLAlchemy (backend)
**Storage**: 신규 테이블 없음. `ScanSnapshotItem.last_signal_date` 기존 컬럼 활용
**Testing**: 수동 브라우저 검증 (pnpm dev / pnpm build)
**Target Platform**: Web (모바일 + PC 반응형)
**Project Type**: Web application (SPA + FastAPI)
**Performance Goals**: 날짜 계산은 클라이언트 사이드 인라인 연산, 서버 부하 없음
**Constraints**: DB 마이그레이션 없음. 기존 컴포넌트 구조 내에서 수정만
**Scale/Scope**: 프론트엔드 3개 파일 수정, 백엔드 1개 엔드포인트 수정 (JOIN 추가), 유틸 함수 1개 추가

---

## Constitution Check

| 규칙 | 판정 | 근거 |
|------|------|------|
| R-01 (한 번에 하나의 관심사) | ✅ | P1(프론트 포매팅)과 P2(백엔드+관심종목)를 독립 단계로 분리 |
| R-02 (기존 네이밍 컨벤션) | ✅ | `signalAgeDays`, `fmtSignalAge` — 기존 `fmt.pct`, `fmtPrice` 패턴 일치 |
| R-03 (매직 넘버 금지) | ✅ | `FRESH_SIGNAL_DAYS = 7` 상수로 추출 |
| R-06 (기존 유틸리티 재사용) | ✅ | `format.ts`에 함수 추가 — 새 파일 생성 안 함 |
| R-08 (타입 정의) | ✅ | `Signal` 타입에 `last_signal_date?: string` 추가 |
| PY-02 (Pydantic 스키마) | ✅ | signals 엔드포인트는 dict 반환 방식 유지 (기존 패턴 준수) |
| FE-01 (단일 책임) | ✅ | 날짜 계산 유틸 분리, 컴포넌트는 표시만 담당 |
| FE-03 (API 호출 집중) | ✅ | 변경 없음 — signals 엔드포인트 자체는 기존 유지 |

**Gate 결과**: ✅ 모든 헌법 규칙 통과 — 진행 가능

---

## Project Structure

### Documentation (this feature)

```text
specs/031-signal-days-label/
├── plan.md          ← 이 파일
├── research.md      ← Phase 0 완료
├── data-model.md    ← Phase 1 완료
├── quickstart.md    ← Phase 1 완료
└── tasks.md         ← /speckit.tasks 명령으로 생성
```

### Source Code (수정 대상 파일)

```text
frontend/
└── src/
    ├── types/
    │   └── index.ts                ← Signal 타입에 last_signal_date?: string 추가
    ├── utils/
    │   └── format.ts               ← fmtSignalAge(dateStr?) 함수 추가
    └── pages/
        └── Dashboard.tsx           ← BuyCard — 경과일 라벨 (compact + PC 양쪽)

backend/
└── routes/
    └── signals.py                  ← GET /signals: ScanSnapshotItem LEFT JOIN 추가
```

> 관심종목(WatchlistPanel의 MiniWatchCard)은 Dashboard.tsx에 이미 포함됨.
> `Signal` 타입에 필드 추가 후 MiniWatchCard에서 직접 사용.

**Structure Decision**: 기존 Web application 구조 유지. 신규 파일 없음, 기존 4개 파일 수정.

---

## 구현 단계

### Step 1: `format.ts` 유틸 추가

`fmtSignalAge(dateStr: string | undefined | null): { label: string; fresh: boolean } | null` 함수 추가.

```typescript
const FRESH_SIGNAL_DAYS = 7

// 반환 예시:
// dateStr = '2026-04-23' (오늘) → { label: '오늘', fresh: true }
// dateStr = '2026-04-20'        → { label: '3일 전', fresh: true }
// dateStr = '2026-04-10'        → { label: '13일 전', fresh: false }
// dateStr = null / 미래          → null (표시 안 함)
```

### Step 2: `Signal` 타입 수정 (frontend/src/types/index.ts)

```typescript
export interface Signal {
  // ... 기존 필드
  last_signal_date?: string  // 'YYYY-MM-DD' — BUY 신호 발생일 (P2: 백엔드 추가 후 사용)
}
```

### Step 3: BuyCard 경과일 라벨 (Dashboard.tsx)

기존 `{item.last_signal_date}` 원본 문자열 표시를 `fmtSignalAge` 결과로 교체.

- `fresh: true` (7일 이하) → `var(--up)` 색상 chip
- `fresh: false` (8일 이상) → `var(--fg-3)` 흐린 색상
- `null` → 렌더 안 함

compact 모드(모바일) + PC full 모드 양쪽 모두 적용.

### Step 4: 백엔드 signals 엔드포인트 수정 (backend/routes/signals.py)

`GET /signals` 쿼리에 `ScanSnapshotItem` LEFT JOIN 추가:

```python
# ScanSnapshotItem에서 가장 최근의 last_signal_date를 가져옴
# DB 마이그레이션 없음 — 기존 테이블 JOIN만
subq = (
    select(
        ScanSnapshotItem.symbol,
        func.max(ScanSnapshotItem.last_signal_date).label("last_signal_date"),
    )
    .group_by(ScanSnapshotItem.symbol)
    .subquery()
)
# signals dict에 last_signal_date 추가
```

### Step 5: MiniWatchCard 경과일 라벨 (WatchlistPanel.tsx)

Signal 타입에 `last_signal_date` 추가 후 MiniWatchCard에서 `fmtSignalAge` 적용.
BUY 신호 상태일 때만 표시 (`s.signal_state === 'BUY'`).

---

## 리스크 및 완화책

| 리스크 | 가능성 | 완화 |
|--------|--------|------|
| ScanSnapshotItem에 해당 symbol 없을 때 | 보통 | LEFT JOIN — `last_signal_date: null` 반환, 라벨 미표시 |
| 관심종목 신호와 스캔 신호의 날짜 불일치 | 낮음 | 두 소스 모두 동일 scanner에서 생성됨 |
| `format.ts` 변경으로 기존 코드 영향 | 없음 | 기존 함수 수정 없이 새 함수만 추가 |
