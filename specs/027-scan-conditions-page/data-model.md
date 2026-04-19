# Phase 1 Data Model — 조회조건 페이지

**Branch**: `027-scan-conditions-page`  
**Date**: 2026-04-19

본 기능은 신규 DB 테이블·컬럼이 없다. 데이터 모델은 세 층으로 구성된다:

1. **프론트엔드 단일 소스** — `Step[]` 배열 (PC Mermaid DSL + 모바일 조건표 양쪽에 파생)
2. **프론트엔드 파생 데이터** — `CONDITION_VALUES` 상수 + Mermaid DSL 문자열(프로그래매틱 생성)
3. **백엔드 추출 모듈** — 조건 상수 + 필터 함수

---

## 1. Frontend Single Source — `Step[]` 배열

### 1.1 타입 정의

```typescript
// frontend/src/constants/conditions.ts (개념)

/** 단계 유형 */
export type StepKind =
  | 'entry'      // 진입점 (예: "종목 분석 시작")
  | 'condition'  // 단일 조건 (예: "BB 하단 터치/돌파?")
  | 'branch'     // 분기 (예: 눌림목 필터 통과/미통과)
  | 'merge'      // 두 경로 합류 (예: BUY 판정과 SQZ BUY 판정 합류)
  | 'success'    // 성공 종료 (예: "눌림목 확정")
  | 'reject'     // 제외 종료 (예: "데드크로스 - 제외")
  | 'note'       // 부가 정보 (예: "거래량 필터 미적용")

/** 단계 분기 정보 */
export interface StepBranch {
  label: string       // 분기 라벨 (예: "통과", "제외", "미통과")
  targetId: string    // 이동 대상 Step id
}

/** 조건 파이프라인 단계 */
export interface Step {
  id: string                    // 고유 식별자 (예: "bb-lower-touch")
  kind: StepKind
  label: string                 // 단계 요약 (모바일 카드 제목에도 사용)
  description?: string          // 상세 설명 (조건식, 예시값 등)
  branches?: StepBranch[]       // 분기가 있을 때
  nextId?: string               // 순차 연결 (분기 없는 경우)
  note?: string                 // 쿨다운·참고사항 등 부가 정보
  group?: 'buy-entry' | 'sqz-entry' | 'common-filter' | 'outcome' | 'sell-entry' | 'sell-outcome'
                                // 모바일 조건표 섹션 그룹핑용
}
```

### 1.2 `BUY_PIPELINE_STEPS: Step[]`

매수 통합 파이프라인의 모든 단계를 순서대로 정의.

| 단계 예시 (id) | kind | group |
|----------------|------|-------|
| `buy-bb-touch` | condition | buy-entry |
| `buy-rsi-filter` | condition | buy-entry |
| `buy-momentum-rising` | condition | buy-entry |
| `buy-label` | success | buy-entry |
| `sqz-fired` | condition | sqz-entry |
| `sqz-momentum-bull` | condition | sqz-entry |
| `sqz-momentum-rising` | condition | sqz-entry |
| `sqz-buy-label` | success | sqz-entry |
| `label-merge` | merge | common-filter |
| `dead-cross-check` | condition | common-filter |
| `recent-20d-check` | condition | common-filter |
| `freshness-7d-check` | condition | common-filter |
| `volume-filter-none` | note | common-filter |
| `chart-buy-confirmed` | success | outcome |
| `pullback-branch` | branch | outcome |
| `pullback-confirmed` | success | outcome |
| `chart-buy-only` | success | outcome |
| `cooldown-note` | note | outcome |

(최소 18+ Step 항목. 실제 값은 구현 단계에서 작성)

### 1.3 `SELL_FLOWCHART_STEPS: Step[]`

SELL 라벨 발생 조건.

| 단계 예시 (id) | kind | group |
|----------------|------|-------|
| `sell-bb-upper-touch` | condition | sell-entry |
| `sell-rsi-gt-60` | condition | sell-entry |
| `sell-momentum-falling` | condition | sell-entry |
| `sell-label` | success | sell-outcome |
| `sell-guidance-note` | note | sell-outcome |
| `sell-cooldown-note` | note | sell-outcome |

### 1.4 `CONDITION_VALUES` (임계값 상수)

| 필드 | 타입 | 의미 |
|------|------|------|
| `RSI_BUY_PRESETS` | `{ strict: 30; normal: 35; sensitive: 40 }` | 민감도별 BUY RSI 임계값 |
| `RSI_SELL` | `60` | SELL RSI 고정값 |
| `COOLDOWN_BARS` | `5` | 신호 쿨다운 봉 수 |
| `SIGNAL_LOOKBACK_DAYS` | `20` | 신호 탐색 최대 거래일 |
| `DATA_STALENESS_DAYS` | `7` | 데이터 신선도 임계 |
| `MIN_CANDLES` | `60` | 분석 최소 캔들 수 |
| `RESPONSIVE_BREAKPOINT_PX` | `768` | PC↔모바일 경계 |

**Validation**: `as const` 단언으로 readonly 강제.

---

## 2. Derived Data — PC용 Mermaid DSL

### 2.1 헬퍼 함수

```typescript
/** Step[] 배열을 Mermaid flowchart TD DSL로 변환 */
export function stepsToMermaidFlowchart(
  steps: Step[],
  options?: { direction?: 'TD' | 'LR' }
): string
```

### 2.2 파생 결과 (캐시)

```typescript
export const BUY_PIPELINE_MERMAID: string = stepsToMermaidFlowchart(BUY_PIPELINE_STEPS)
export const SELL_FLOWCHART_MERMAID: string = stepsToMermaidFlowchart(SELL_FLOWCHART_STEPS)
```

- 모듈 로드 시 1회 계산 후 string으로 export.
- `FlowchartView` 컴포넌트가 이 문자열을 mermaid에 전달하여 SVG 렌더.

### 2.3 변환 규칙 (요약)

| Step.kind | Mermaid 노드 shape |
|-----------|---------------------|
| `entry` | `A([...])`  (원형) |
| `condition` | `A{...}` (마름모) |
| `branch` | `A{...}` (마름모, 분기 라벨 엣지 포함) |
| `merge` | `A[...]` (사각) |
| `success` | `A[[...]]` (두꺼운 사각, 강조) |
| `reject` | `A[...]` + 빨강 클래스 |
| `note` | `A[/.../]` (평행사변형) |

엣지: `A --> B` (기본), `A -->|라벨| B` (분기), `A -.-> B` (note 연결).

---

## 3. Frontend Component Props

### 3.1 `FlowchartView` (PC 전용)

```typescript
interface FlowchartViewProps {
  diagram: string      // Mermaid DSL 문자열
  id: string           // mermaid render 식별자 (unique)
  dark?: boolean       // 다크 테마 (기본 true)
}
```

**State Transitions**: `loading` (mermaid 동적 import 중) → `rendering` (SVG 생성 중) → `ready` (DOM 삽입) / `error` (파싱 실패).

### 3.2 `ConditionStepTable` (모바일 전용)

```typescript
interface ConditionStepTableProps {
  steps: Step[]        // 단계 배열 (BUY_PIPELINE_STEPS 또는 SELL_FLOWCHART_STEPS)
  title: string        // 영역 제목 (예: "매수 통합 파이프라인")
  guidance?: string    // SELL 안내 문구 등 보조 텍스트
}
```

**렌더링 방식** (R6 결정):
- 각 Step을 카드 형태로 세로 나열
- 카드 구조: `[번호 배지] [kind 배지] [label] / [description] / [branches 목록] / [note]`
- `group` 속성으로 섹션 구분 시 그룹 헤더 표시

**State Transitions**: 없음 (정적 데이터, 단순 렌더).

### 3.3 `ConditionsSection` (반응형 래퍼)

```typescript
interface ConditionsSectionProps {
  title: string
  steps: Step[]                           // 공유 단일 소스
  pcDiagram: string                       // PC용 Mermaid DSL (stepsToMermaidFlowchart 결과)
  pcDiagramId: string                     // FlowchartView 식별자
  guidance?: string                       // 모바일 조건표의 안내 문구
}
```

**분기 로직** (Tailwind):
```tsx
<section>
  <h2>{title}</h2>
  <div className="hidden md:block">
    <FlowchartView diagram={pcDiagram} id={pcDiagramId} />
  </div>
  <div className="md:hidden">
    <ConditionStepTable steps={steps} title={title} guidance={guidance} />
  </div>
</section>
```

---

## 4. Backend Module Shape — `scan_conditions.py`

(R2 결정과 동일 — 모바일 전략 변경의 영향 없음)

### 4.1 상수

```python
RSI_BUY_THRESHOLD_PRESETS: dict[str, int] = {"strict": 30, "normal": 35, "sensitive": 40}
RSI_SELL_THRESHOLD: int = 60
COOLDOWN_BARS: int = 5
SIGNAL_LOOKBACK_DAYS: int = 20
DATA_STALENESS_DAYS: int = 7
MIN_CANDLES: int = 60
```

### 4.2 함수

| 함수 | 시그니처 |
|------|----------|
| `is_dead_cross` | `(ema: dict[str, pd.Series]) -> bool` |
| `is_pullback` | `(ema: dict[str, pd.Series]) -> bool` |
| `check_trend` | `(ema: dict[str, pd.Series]) -> str` |
| `check_buy_signal_precise` | `(df: pd.DataFrame, last_rsi: float, last_sq: float) -> tuple[str \| None, date \| None]` |

### 4.3 동작 보존

- 시그니처 100% 유지
- 내부 로직 그대로 복사
- `from backend.routes.charts import _simulate_signals` 유지

---

## 5. Relationships

```text
[frontend conditions.ts]
    Step[]  (단일 소스)
       │
       ├─→ stepsToMermaidFlowchart() ──→ PC용 Mermaid DSL 문자열 ──→ FlowchartView ──→ mermaid (동적 import)
       │
       └─→ ConditionStepTable (직접 렌더) ──→ 모바일 카드 리스트

[ConditionsSection 래퍼]
    Tailwind hidden md:block / md:hidden 분기
        ├─ PC: FlowchartView 마운트 (mermaid 로드)
        └─ 모바일: ConditionStepTable 마운트 (mermaid 미로드)

[backend scan_conditions.py]
    (조건 상수 + 함수)
       │
       └─→ full_market_scanner.py 가 import ──→ run_full_scan()

(❌ frontend ↔ backend 직접 연동 없음 — Q2 결정)
```

---

## 6. 변경 영향 범위

| 파일 | 변경 유형 | 영향 |
|------|----------|------|
| `backend/services/scan_conditions.py` | 신규 | 단일 소스 모듈 |
| `backend/services/full_market_scanner.py` | 수정 | import 추가, 함수 정의 삭제, 호출명 변경 |
| `frontend/src/constants/conditions.ts` | 신규 | `Step[]` 정의 + `CONDITION_VALUES` + 파생 Mermaid DSL |
| `frontend/src/components/conditions/FlowchartView.tsx` | 신규 | PC 전용, mermaid 동적 import |
| `frontend/src/components/conditions/ConditionStepTable.tsx` | 신규 | 모바일 전용, Step 카드 렌더 |
| `frontend/src/components/conditions/ConditionsSection.tsx` | 신규 | 반응형 분기 래퍼 |
| `frontend/src/pages/ScanConditions.tsx` | 신규 | 페이지 본체 (2개 ConditionsSection 포함) |
| `frontend/src/App.tsx` | 수정 | 라우트 + PC nav 추가 |
| `frontend/src/components/BottomNav.tsx` | 수정 | tabs 배열 항목 추가 |
| `frontend/package.json` | 수정 | mermaid 의존성 추가 |

DB 스키마·백엔드 API 추가: **없음**.
