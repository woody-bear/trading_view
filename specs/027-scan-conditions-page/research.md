# Phase 0 Research — 조회조건 페이지

**Branch**: `027-scan-conditions-page`  
**Date**: 2026-04-19

본 문서는 plan.md의 Technical Context에서 선택이 필요한 항목에 대한 결정·근거·대안 평가를 정리한다.

---

## R1. PC 플로우차트 렌더링 라이브러리

### 결정

**Mermaid.js** (`mermaid` npm 패키지)를 선택한다. **PC(≥768px) 전용**으로 동적 import하여 모바일 사용자는 해당 번들을 다운로드하지 않는다.

### Rationale

1. **선언적 DSL → SVG 자동 렌더링**: Mermaid `flowchart TD` DSL로 노드·엣지·분기를 텍스트로 정의하면 자동 레이아웃. Q1 답변과 1:1 일치.
2. **Step 데이터로부터 DSL 생성 가능**: `Step[]` 단일 소스에서 PC용 Mermaid DSL을 프로그래매틱으로 만들어, PC↔모바일 간 의미 일관성을 보장.
3. **동적 import로 모바일 번들 분리**: `ConditionsSection`이 PC 분기에서만 `FlowchartView`를 마운트 → `FlowchartView`가 내부에서 `await import('mermaid')` 수행. 모바일은 해당 코드에 도달하지 않음.
4. **반응형 처리**: PC에서 SVG `max-width:100%` + 컨테이너 폭 맞춤 자동 축소.

### Alternatives Considered

| 옵션 | 평가 | 기각 사유 |
|------|------|----------|
| React Flow | 노드 인터랙션 강력 | 정적 표시 용도 — overkill |
| 커스텀 SVG | 의존성 0 | 8+ 노드 수작업 좌표 유지보수 비용 과다 |
| D3.js | 강력함 | 일반 차트용 — 학습 비용 |
| Graphviz WASM | 자동 레이아웃 우수 | 번들 크기 >1MB 과다 |

---

## R2. 백엔드 조건 모듈 추출 전략

### 결정 (변경 없음 — R2는 모바일 전략 변경의 영향을 받지 않음)

`backend/services/scan_conditions.py`를 신규 생성하여 다음을 이전한다:

**상수**: `RSI_BUY_THRESHOLD_PRESETS`, `RSI_SELL_THRESHOLD=60`, `COOLDOWN_BARS=5`, `SIGNAL_LOOKBACK_DAYS=20`, `DATA_STALENESS_DAYS=7`, `MIN_CANDLES=60`.

**함수**: `is_dead_cross`, `is_pullback`, `check_trend`, `check_buy_signal_precise` (기존 `_` prefix 함수들의 public 이름).

**`full_market_scanner.py`**: 함수 정의 삭제 → `from backend.services.scan_conditions import (...)` → 호출부 함수명 갱신.

### Rationale / Alternatives

이전 Research v1과 동일. (생략)

---

## R3. 프론트엔드 네비게이션 통합 방식

### 결정

기존 패턴(BottomNav 배열 + App.tsx 인라인 PC nav) 유지. `BottomNav.tsx` `tabs` 배열에 `{ path: '/conditions', icon: ListChecks, label: '조회조건' }` 추가, `App.tsx`에 라우트 + PC nav 링크 1개씩 추가.

### Rationale

- 기존 컨벤션 준수 (R-02).
- 요청 외 리팩토링 금지 (C-05).
- 아이콘: `lucide-react`의 `ListChecks` — "조건 목록/체크리스트" 의미에 부합.

---

## R4. 프론트엔드 조건 데이터 구조 — Step[] 단일 소스

### 결정

`conditions.ts`에 **`Step[]` 배열을 단일 소스로 정의**하고, 이 배열에서 다음 두 가지를 파생한다:

1. **PC용 Mermaid DSL 문자열** — `stepsToMermaidFlowchart(steps): string` 헬퍼 함수가 Step[]을 Mermaid `flowchart TD` DSL로 변환.
2. **모바일 조건표 렌더** — `ConditionStepTable` 컴포넌트가 Step[] 배열을 직접 받아 table/카드 리스트로 렌더.

### Step 데이터 타입 (개념)

```ts
type StepKind = 'entry' | 'condition' | 'branch' | 'merge' | 'success' | 'reject' | 'note'

interface Step {
  id: string              // 고유 식별자 (e.g., "bb-lower-touch")
  kind: StepKind
  label: string           // 단계 요약 (e.g., "BB 하단 터치/돌파")
  description?: string    // 상세 설명 (조건표에서 보조 행으로 표시)
  branches?: {            // branch 또는 조건 분기용
    label: string         // 분기 라벨 (e.g., "통과", "제외")
    targetId: string      // 도달 Step id
  }[]
  nextId?: string         // 순차 연결 (단순 조건용)
  note?: string           // 부가 정보 (쿨다운 5봉 등)
}

export const BUY_PIPELINE_STEPS: Step[] = [...]
export const SELL_FLOWCHART_STEPS: Step[] = [...]
```

### Rationale

1. **단일 소스 원칙**: Step 배열 1곳만 수정하면 PC 도표·모바일 조건표 양쪽 반영 (SC-006).
2. **양쪽 렌더링 패턴 호환**: Mermaid DSL 생성과 React 테이블 렌더가 동일 데이터를 소비.
3. **타입 안전**: Step 구조가 TypeScript 인터페이스로 강제되어 조건 추가/변경 시 컴파일러가 누락을 잡아냄.
4. **확장성**: 향후 단계별 툴팁·링크 등이 필요해져도 Step 인터페이스 확장으로 대응 가능.

### Alternatives Considered

| 옵션 | 기각 사유 |
|------|----------|
| PC용 Mermaid 문자열과 모바일용 테이블 데이터를 각각 수동 관리 | 두 소스 간 불일치 위험 — Step 단일 소스 원칙(Q2) 위배 |
| 모바일용 별도 JSON 파일 | 같은 조건을 두 곳에 작성해야 함. 유지보수 비용 증가 |
| 런타임에 Mermaid 파서로 파싱하여 모바일 추출 | Mermaid 번들을 모바일에서도 로드 필요 → Q4 의도(모바일 번들 절감) 위배 |

---

## R5. 반응형 분기 구현

### 결정

**Tailwind CSS 유틸리티 클래스 기반 조건부 마운트**:

```tsx
// ConditionsSection.tsx (개념)
<section>
  <h2>{title}</h2>
  {/* PC: Mermaid 도표 */}
  <div className="hidden md:block">
    <FlowchartView steps={steps} id={id} />
  </div>
  {/* 모바일: 조건표 */}
  <div className="md:hidden">
    <ConditionStepTable steps={steps} />
  </div>
</section>
```

### Rationale

1. **동적 import 자연 분기**: PC 분기(`hidden md:block`)만 렌더되어 `FlowchartView`가 마운트되고, 해당 컴포넌트 내부에서 `await import('mermaid')` 수행 → 모바일에서는 `FlowchartView`가 React 트리에 마운트조차 되지 않아 mermaid 코드에 도달하지 않음.
2. **CSS 기반 분기가 JavaScript matchMedia보다 견고**: SSR/hydration 안전, 화면 회전·리사이즈 반응 자동.
3. **단순성**: 별도 hook 없이 Tailwind 유틸리티만으로 달성.

### Alternatives Considered

| 옵션 | 기각 사유 |
|------|----------|
| `useMediaQuery` hook으로 JS 분기 후 단일 컴포넌트 마운트 | SSR hydration 이슈, 초기 mismatch 가능성 |
| 양쪽 모두 마운트 후 CSS `display:none` | mermaid 번들이 모바일에서도 로드됨 → Q4 의도 위배 |
| 사용자 User-Agent 기반 SSR 분기 | 아직 SSR 미도입 — 범위 초과 |

### 주의사항

- Vite bundler는 `import('mermaid')`를 별도 chunk로 자동 분리.
- 코드 스플리팅 검증: `pnpm build` 후 `dist/assets/` 내 mermaid chunk가 main bundle과 분리되어 있는지 확인 (quickstart §9 포함).

---

## R6. 모바일 조건표 표시 형식

### 결정

**카드 스타일 세로 리스트** 채택 — 각 Step을 카드 형태(번호, 단계 유형 배지, 라벨, 설명, 분기 정보, 노트)로 위→아래 순서로 배치.

### Rationale

1. **모바일 스와이프 패턴에 부합**: Dashboard 등 기존 모바일 UI가 세로 스크롤 카드 패턴 사용 — 프로젝트 일관성.
2. **정보 밀도 적정**: 테이블은 좁은 모바일 폭에서 셀이 압축되어 가독성 저하. 카드는 각 단계에 충분한 공간 할당.
3. **분기·노트 표현 유연**: branch 정보와 note를 카드 내 별도 행으로 명확히 구분 가능.
4. **단계 번호 강조**: 각 카드 좌측에 `1, 2, 3…` 순번 배지 → "좁혀나가는" 흐름을 번호로 직관 전달.

### Layout 예시 (개념)

```text
┌────────────────────────────────────────┐
│ [1] [진입] BUY 라벨 판정                │
│ BB 하단 터치/돌파 → RSI < 30/35/40(프리셋)│
│ → 모멘텀 상승 → BUY 라벨                │
│ 📝 쿨다운: 이전 BUY 후 5봉 이내 미발생  │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│ [1'][진입·대안] SQZ BUY 라벨 판정       │
│ ...                                    │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│ [2] [필터] EMA 5선 전체 역배열          │
│ EMA5 < 10 < 20 < 60 < 120 → 제외       │
└────────────────────────────────────────┘
⋮
┌────────────────────────────────────────┐
│ [6] [분기] 눌림목 필터                  │
│ ✅ 통과 → 눌림목 확정                   │
│ ❌ 미통과 → 추천종목으로만 분류          │
└────────────────────────────────────────┘
```

### Alternatives Considered

| 옵션 | 기각 사유 |
|------|----------|
| 순수 HTML `<table>` | 모바일 폭에서 셀 압축, 긴 조건 설명 줄바꿈 지저분 |
| 아코디언(접이식) | 한눈에 전체 흐름 보기 어려움, 사용자가 각 단계 펼쳐야 함 |
| 타임라인 UI | 시각적 멋지나 구현 복잡 + 정보 전달엔 오버엔지니어링 |

---

## R7. 페이지 로드 성능 — 모바일 번들 최적화

### 결정

**모바일은 mermaid 라이브러리를 로드하지 않는다**. Vite 코드 스플리팅으로 `FlowchartView`가 포함된 chunk만 PC 진입 시 lazy load.

### 검증 방법

1. `pnpm build` 후 `dist/assets/` 디렉토리에 mermaid 관련 별도 chunk(예: `mermaid-*.js`) 존재 확인.
2. 브라우저 DevTools Network 탭에서 모바일 에뮬레이션 시 mermaid chunk 미로드 확인.
3. PC 진입 시 mermaid chunk 로드 확인.

### 예상 효과

- 모바일 페이지 로드 시 전송 바이트 수 ~300KB+ 절감 (mermaid 번들 대략)
- SC-001 (1초 이내 로드) 모바일에서 여유 있게 달성

---

## 결론

모든 기술 결정 사항 확정. Phase 1로 진행 가능.

| 항목 | 결정 |
|------|------|
| PC 플로우차트 라이브러리 | Mermaid.js (동적 import, PC 전용 로드) |
| 모바일 표현 방식 | 카드 스타일 세로 리스트 (Mermaid 미사용) |
| 단일 데이터 소스 | `conditions.ts`의 `Step[]` 배열 |
| 반응형 분기 | Tailwind `hidden md:block` / `md:hidden` 조건부 마운트 |
| 백엔드 모듈 위치 | `backend/services/scan_conditions.py` |
| 프론트 네비 통합 | 기존 BottomNav 배열 + App.tsx 인라인 nav 패턴 유지 |
| 모바일 번들 최적화 | 모바일 mermaid 미로드 (코드 스플리팅 검증) |
