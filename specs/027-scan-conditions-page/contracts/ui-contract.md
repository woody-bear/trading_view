# UI Contract — ScanConditions 페이지

**Branch**: `027-scan-conditions-page`  
**Date**: 2026-04-19

본 기능은 신규 백엔드 API가 없으므로 외부 인터페이스는 (1) 사용자에게 노출되는 페이지 UI 계약과 (2) 모듈 간 코드 인터페이스 두 가지다.

---

## 1. Page Contract — `/conditions`

### 1.1 진입점

| 트리거 | 동작 |
|--------|------|
| URL 직접 입력 `/conditions` | `ScanConditions` 페이지 렌더 |
| PC 헤더 '조회조건' 탭 클릭 | 동일 |
| 모바일 BottomNav '조회조건' 탭 클릭 | 동일 |

### 1.2 페이지 레이아웃 (PC, ≥768px)

```text
┌─────────────────────────────────────────┐
│ [TopNav ··· 조회조건(활성)]             │
├─────────────────────────────────────────┤
│ <h1>조회조건</h1>                       │
│                                         │
│ <h2>매수 통합 파이프라인</h2>           │
│ 설명: BUY/SQZ BUY 라벨 판정부터...      │
│                                         │
│ [Mermaid 플로우차트 — 통합 BUY]         │
│                                         │
│ [RSI 프리셋 표]                         │
│                                         │
│ ──────────────                          │
│                                         │
│ <h2>SELL 라벨 (별도)</h2>               │
│ 안내: 차트 표시 전용, 추천종목/눌림목    │
│ 미사용                                  │
│                                         │
│ [Mermaid 플로우차트 — SELL]             │
└─────────────────────────────────────────┘
```

### 1.3 페이지 레이아웃 (모바일, <768px)

```text
┌──────────────────────────┐
│ <h1>조회조건</h1>        │
│                          │
│ <h2>매수 통합 파이프라인>│
│ 설명...                  │
│                          │
│ ┌──────────────────────┐ │
│ │[1][진입] BUY 판정    │ │
│ │BB 하단 터치/돌파     │ │
│ │→ RSI 필터 → 모멘텀↑  │ │
│ │→ BUY 라벨            │ │
│ │📝 쿨다운 5봉         │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │[1'][진입·대안] SQZ   │ │
│ │BUY 판정              │ │
│ │...                   │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │[2][필터] 데드크로스  │ │
│ │EMA5<10<20<60<120     │ │
│ │→ 제외                │ │
│ └──────────────────────┘ │
│ ⋮ (나머지 단계들)        │
│ ┌──────────────────────┐ │
│ │[N][분기] 눌림목 필터 │ │
│ │✅ 통과 → 눌림목 확정 │ │
│ │❌ 미통과 → 추천종목  │ │
│ │   으로만 분류        │ │
│ └──────────────────────┘ │
│                          │
│ [RSI 프리셋 표]          │
│                          │
│ ──────────────           │
│                          │
│ <h2>SELL 라벨 (별도)>    │
│ 안내 문구                │
│                          │
│ ┌──────────────────────┐ │
│ │[1][진입] BB 상단 터치│ │
│ └──────────────────────┘ │
│ ⋮                        │
│                          │
├──────────────────────────┤
│ [BottomNav ··· 조회(활성)]│
└──────────────────────────┘
```

**모바일 핵심 제약**:
- Mermaid 도표 **미표시** (DOM 마운트 안 됨)
- Mermaid 라이브러리 **미로드** (번들 포함 안 됨)
- 가로 스크롤 **없음** — 세로 스크롤만
- 각 Step이 카드(border, padding, 배지)로 명확히 구분

### 1.4 반응형 분기 계약

| 폭 | 분기 | 렌더 대상 |
|---|------|----------|
| ≥ 768px | `ConditionsSection > div.hidden.md:block` 가시 | `FlowchartView` 마운트 → mermaid 로드 |
| < 768px | `ConditionsSection > div.md:hidden` 가시 | `ConditionStepTable` 마운트 → mermaid 미로드 |

### 1.5 상태 (State Contract)

| 영역 | 상태 | 표시 |
|------|------|------|
| PC 도표 | `loading` | "플로우차트 로딩 중…" 스켈레톤 |
| PC 도표 | `ready` | SVG 렌더 |
| PC 도표 | `error` | 에러 메시지 + 원본 DSL `<pre>` (FE-05) |
| 모바일 조건표 | (항상) | 정적 렌더, 로딩 상태 없음 |

### 1.6 접근성

- 페이지 제목: `<h1>조회조건</h1>`
- 섹션 제목: `<h2>매수 통합 파이프라인</h2>`, `<h2>SELL 라벨 (별도)</h2>`
- PC Mermaid 컨테이너: `aria-label="매수 파이프라인 흐름도"` 등
- 모바일 카드: 각 카드 `<article role="listitem">`, 섹션은 `<ol>` 또는 `<ul>` 안에 위치

---

## 2. Module Contract — `frontend/src/constants/conditions.ts`

### 2.1 Public Exports

```typescript
// 타입
export type StepKind
export interface StepBranch
export interface Step

// 단일 소스 데이터
export const BUY_PIPELINE_STEPS: readonly Step[]
export const SELL_FLOWCHART_STEPS: readonly Step[]

// 임계값 상수
export const CONDITION_VALUES: Readonly<{
  RSI_BUY_PRESETS: { strict: 30; normal: 35; sensitive: 40 }
  RSI_SELL: 60
  COOLDOWN_BARS: 5
  SIGNAL_LOOKBACK_DAYS: 20
  DATA_STALENESS_DAYS: 7
  MIN_CANDLES: 60
  RESPONSIVE_BREAKPOINT_PX: 768
}>

// PC 파생 Mermaid DSL (모듈 로드 시 생성)
export const BUY_PIPELINE_MERMAID: string
export const SELL_FLOWCHART_MERMAID: string

// 변환 헬퍼
export function stepsToMermaidFlowchart(steps: readonly Step[]): string
```

### 2.2 Consumer Expectations

- `ConditionsSection`은 `steps` + `pcDiagram`을 모두 받음.
- 값 변경 시: `Step[]` 배열만 수정하면 PC 도표와 모바일 조건표 양쪽에 반영 (SC-006).
- `CONDITION_VALUES`는 향후 차트 페이지 등 다른 컴포넌트에서도 임계값 참조 시 재사용 가능.

### 2.3 Stability

- `Step` 인터페이스는 안정 API — 필드 추가는 optional로, 기존 필드 변경/제거는 전 코드베이스 영향 검토 필수.
- `CONDITION_VALUES` 키는 추가 가능, 기존 키 변경 시 PC 도표·모바일 조건표 모두 회귀 확인.

---

## 3. Module Contract — `backend/services/scan_conditions.py`

(이전 계약과 동일 — 모바일 전략 변경의 영향 없음)

### 3.1 Public Exports

```python
# 상수
RSI_BUY_THRESHOLD_PRESETS: dict[str, int]   # {"strict": 30, "normal": 35, "sensitive": 40}
RSI_SELL_THRESHOLD: int                     # 60
COOLDOWN_BARS: int                          # 5
SIGNAL_LOOKBACK_DAYS: int                   # 20
DATA_STALENESS_DAYS: int                    # 7
MIN_CANDLES: int                            # 60

# 함수
def is_dead_cross(ema: dict[str, pd.Series]) -> bool: ...
def is_pullback(ema: dict[str, pd.Series]) -> bool: ...
def check_trend(ema: dict[str, pd.Series]) -> str: ...
def check_buy_signal_precise(
    df: pd.DataFrame, last_rsi: float, last_sq: float
) -> tuple[str | None, date | None]: ...
```

### 3.2 Behavior Preservation Contract

리팩토링 전후 `full_market_scanner.run_full_scan()` 결과 bit-identical. 검증: quickstart §6.1.

### 3.3 Dependencies

`from backend.routes.charts import _simulate_signals` 유지.

---

## 4. Component Contract — FlowchartView (PC 전용)

```typescript
interface FlowchartViewProps {
  diagram: string    // Mermaid DSL
  id: string         // 고유 render id
  dark?: boolean     // 다크 테마 (기본 true)
}
```

- mermaid 동적 import (`await import('mermaid')`)
- 초기화 옵션: `theme: 'dark'` (또는 커스텀 `themeVariables`)
- 파싱 실패 시 error 상태 + DSL 원본 폴백 표시

---

## 5. Component Contract — ConditionStepTable (모바일 전용)

```typescript
interface ConditionStepTableProps {
  steps: readonly Step[]
  title: string
  guidance?: string
}
```

**렌더 규칙**:
- Step 배열 순회 → 각 Step을 카드로 렌더
- `step.group` 변경 시점에 그룹 헤더(optional) 삽입
- `step.branches`가 있으면 카드 내 "분기" 섹션으로 목록 표시
- `step.note`가 있으면 카드 하단 `📝` 배지 + 텍스트

**스타일** (Tailwind):
- 카드: `rounded-lg border border-[var(--border)] p-3 mb-2`
- 단계 번호 배지: `inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs`
- kind 배지: `text-xs px-1.5 py-0.5 rounded bg-[var(--bg)] text-[var(--muted)]`

---

## 6. Navigation Contract

### 6.1 Route

| Path | Element | Lazy load |
|------|---------|-----------|
| `/conditions` | `<ScanConditions />` | 권장 (mermaid 코드 분리) |

### 6.2 Tab Configuration

**BottomNav**:
```typescript
{ path: '/conditions', icon: ListChecks, label: '조회조건' }
```

**App.tsx PC nav**: `<Link to="/conditions">조회조건</Link>` (활성 시 강조 클래스)

### 6.3 Active State (FR-013)

현재 경로 `/conditions`일 때 PC 탭 + BottomNav 항목 모두 활성 스타일.

---

## 7. Out of Scope

- 신규 백엔드 API 없음
- 사용자 입력·폼 없음
- 권한 분리 없음 (기존 페이지와 동일)
- 다국어 — 한국어 단일
- 인쇄/PDF 내보내기 — 미지원
- 모바일 pinch-to-zoom — 미지원 (조건표 기반이라 불필요)
