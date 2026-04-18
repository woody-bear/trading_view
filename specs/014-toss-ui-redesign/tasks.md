# Tasks: Toss/Domino UI Redesign (014)

**Input**: Design documents from `/specs/014-toss-ui-redesign/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ui-tokens.md ✓

**No tests requested** — visual UI changes verified via quickstart.md scenarios.

**Organization**: Tasks are grouped by user story. Phase 1(Foundational)은 모든 US의 전제조건.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational — CSS 변수 교체 (모든 US 선행 조건)

**Purpose**: `index.css`의 CSS 커스텀 프로퍼티 값을 Toss 색상으로 교체. 이 한 파일 변경으로 `var(--...)` 패턴을 사용하는 모든 컴포넌트에 즉시 적용된다.

**⚠️ CRITICAL**: 이 Phase가 완료되어야 이후 모든 User Story 작업이 효과를 발휘한다.

- [X] T001 Update CSS custom properties in `frontend/src/index.css`: `--bg:#000000`, `--card:#1c1c1e`, `--border:#2c2c2e`, `--text:#ffffff`, `--muted:#8e8e93`, `--buy:#ff4b6a`, `--sell:#4285f4`, `--neutral:#636366`; remove `--navy` and `--gold` variables

**Checkpoint**: 개발 서버 확인 시 대시보드 배경이 순수 블랙, 카드가 `#1c1c1e`로 변경됨.

---

## Phase 2: User Story 1 — 다크 컬러 시스템 적용 (Priority: P1) 🎯 MVP

**Goal**: 하드코딩된 `text-green-400`, `text-red-400`, `#ef4444`, `#22c55e` 색상을 CSS 변수(`var(--buy)`, `var(--sell)`)로 교체하여 Toss 색상 시스템으로 통일.

**Independent Test**: 관심종목 카드에서 상승 수치가 `#ff4b6a`, 하락 수치가 `#4285f4`로 표시됨. BUY 뱃지가 핑크-레드 계열.

- [X] T002 [P] [US1] Update `frontend/src/components/SignalCard.tsx`: replace `text-green-400`→`text-[var(--buy)]` and `text-red-400`→`text-[var(--sell)]` for `change_pct` display; replace `text-green-400 bg-green-400/10` badge (상승추세)→`text-[var(--buy)] bg-[var(--buy)]/10`; replace `text-red-400 bg-red-400/10` badge (하락추세)→`text-[var(--sell)] bg-[var(--sell)]/10`
- [X] T003 [P] [US1] Update `frontend/src/components/SentimentPanel.tsx`: replace `dirColor` logic `text-green-400`→`text-[var(--buy)]`, `text-red-400`→`text-[var(--sell)]`; replace sentiment classes `'낙관적 분위기': 'text-green-400 bg-green-500/10'`→`text-[var(--buy)] bg-[var(--buy)]/10`, `'위험 회피 분위기': 'text-red-400 bg-red-500/10'`→`text-[var(--sell)] bg-[var(--sell)]/10`
- [X] T004 [P] [US1] Update `frontend/src/components/SentimentPanel.tsx` FearGreedGauge: replace `#ef4444`→`#ff4b6a` and `#22c55e`→`#4285f4` in `getFgColor()` function and SVG gauge arc colors array `['#ef4444','#f97316','#a3a3a3','#22c55e','#16a34a']`→`['#4285f4','#8b9eff','#636366','#ff4b6a','#ff2d55']`
- [X] T005 [P] [US1] Update `frontend/src/utils/indicatorLabels.ts`: replace `text-green-400 bg-green-400/15 border border-green-400/30` (STRONG BUY)→`text-[var(--buy)] bg-[var(--buy)]/15 border border-[var(--buy)]/30`; replace all `text-red-400` badge classes (STRONG SELL, WEAK SELL, MAX SQ, RSI 과매수)→`text-[var(--sell)]` equivalents

**Checkpoint**: 브라우저에서 BUY 뱃지가 핑크-레드, 하락 등락률이 파란색으로 표시됨.

---

## Phase 3: User Story 2 — 타이포그래피 스케일 정비 (Priority: P1)

**Goal**: 종목명 ≥15px/600, 현재가 ≥18px/700, 보조 ≤13px/400 계층을 모든 카드에 적용.

**Independent Test**: 모바일(375px)에서 관심종목 카드의 종목명-현재가-등락률이 세 단계 크기 계층으로 명확히 구분됨.

- [X] T006 [P] [US2] Update `frontend/src/components/SignalCard.tsx` typography: symbol name `text-white font-bold text-[17px] md:text-sm`→`text-[var(--text)] font-semibold text-[15px] md:text-[13px]`; current price class ensure `text-2xl md:text-sm font-mono font-bold`→`text-[18px] md:text-sm font-mono font-bold`; change_pct ensure `text-sm md:text-[10px] font-mono font-semibold`
- [X] T007 [P] [US2] Update `frontend/src/pages/Dashboard.tsx` section headers: ensure `SnapSectionHeader` title uses `text-base md:text-sm font-semibold text-[var(--text)]` (update color from any hardcoded to CSS variable)
- [X] T008 [P] [US2] Update `frontend/src/pages/Scan.tsx`: review all card/row font-size classes and align to typography scale — titles `text-[15px]`, values `text-[18px] font-mono`, labels `text-[13px] text-[var(--muted)]`
- [X] T009 [P] [US2] Update `frontend/src/pages/TopPicks.tsx`: review and align card fonts to typography scale — titles `font-semibold text-[15px]`, price/numbers `font-mono font-bold text-[18px]`, sub-info `text-[13px] text-[var(--muted)]`

**Checkpoint**: 모바일 360px에서 텍스트 잘림 없이 세 단계 타이포그래피 계층이 보임.

---

## Phase 4: User Story 3 — 카드 레이아웃 정보 나열 방식 개선 (Priority: P2)

**Goal**: 모든 카드/행에서 레이블-왼쪽/값-오른쪽 패턴 + `rounded-xl`(12px) + `p-4`(16px) 적용.

**Independent Test**: 관심종목 카드의 RSI/BB/%B/Vol 행이 레이블 좌측 회색, 값 우측 흰색 mono 정렬.

- [X] T010 [P] [US3] Update `frontend/src/components/SignalCard.tsx` card container: outer div `bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 md:p-2.5`→`bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3`; RSI/BB/Vol info row: ensure each item `flex justify-between` with `text-[var(--muted)]` label left and `font-mono font-semibold text-[var(--text)]` value right
- [X] T011 [P] [US3] Update `frontend/src/components/SentimentPanel.tsx` market index rows: each index row (VIX, 코스피, S&P500, 나스닥, USD/KRW) use `flex justify-between items-center` with name `text-[var(--muted)] text-sm` left, value+change_pct `text-[var(--text)] font-mono font-semibold` right
- [X] T012 [P] [US3] Update `frontend/src/pages/Settings.tsx`: review all setting rows and confirm label-left/control-right pattern with `text-[var(--muted)]` labels; ensure section cards use `rounded-xl` and `p-4`

**Checkpoint**: 시장지표 패널의 VIX·코스피·S&P500 행이 레이블-왼쪽/값-오른쪽 레이아웃으로 깔끔하게 정렬.

---

## Phase 5: User Story 4 — 차트 가독성 개선 (Priority: P2)

**Goal**: 모든 차트에서 Toss 색상(상승 `#ff4b6a`, 하락 `#4285f4`) + 블랙 배경 + 희미한 격자선 적용.

**Independent Test**: IndicatorChart에서 상승 캔들이 핑크-레드, 하락 캔들이 파란색; 격자선이 배경에 거의 묻힘.

- [X] T013 [US4] Update `frontend/src/components/charts/IndicatorChart.tsx`: `upColor: '#26a69a'`→`'#ff4b6a'`, `downColor: '#ef5350'`→`'#4285f4'`, add `wickUpColor: '#ff4b6a'`, `wickDownColor: '#4285f4'`; layout `background.color: '#1e293b'`→`'#000000'`, `textColor: '#94a3b8'`→`'#8e8e93'`; grid `vertLines.color: '#1e293b'`→`'#2c2c2e'`, `horzLines.color: '#262f3d'`→`'rgba(44,44,46,0.5)'`
- [X] T014 [P] [US4] Update `frontend/src/pages/Forex.tsx` chart config: `layout.background.color: '#1e293b'`→`'#000000'`, `textColor: '#94a3b8'`→`'#8e8e93'`; `grid.vertLines.color: '#1e293b'`→`'#2c2c2e'`, `grid.horzLines.color: '#262f3d'`→`'rgba(44,44,46,0.5)'`
- [X] T015 [P] [US4] Update `frontend/src/components/SentimentPanel.tsx` chart configs: FearGreedChart `layout.background.color`→`'#000000'`, grid colors → Toss values; VIXExpandChart same background/grid update; histogram color for VIX >30 remains red-ish (`rgba(239,68,68,0.25)`) — acceptable as VIX risk indicator

**Checkpoint**: 종목 상세 차트 화면에서 캔들이 Toss 색상, 배경이 블랙, 격자선이 희미함.

---

## Phase 6: User Story 5 — 하단 탭바 토스 스타일 개선 (Priority: P3)

**Goal**: 활성 탭 핑크-레드 강조 + 반투명 블랙 배경 + backdrop-blur.

**Independent Test**: 모바일에서 활성 탭 아이콘+텍스트가 `#ff4b6a`, 탭바 배경이 반투명 블랙.

- [X] T016 [US5] Update `frontend/src/components/BottomNav.tsx`: active color `text-[var(--gold)]`→`text-[var(--buy)]` (both icon and label span); nav background `bg-[var(--bg)]/95 backdrop-blur-sm`→`bg-black/85 backdrop-blur-md`; inactive color `text-[var(--muted)]`→`text-[var(--neutral)]`; border-t color confirm `border-[var(--border)]`

**Checkpoint**: 모바일에서 탭 전환 시 활성 탭이 핑크-레드로 강조되고 탭바 배경이 반투명 blur 처리됨.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 누락된 색상 확인 및 전체 검증.

- [X] T017 [P] Audit `frontend/src/pages/SignalDetail.tsx`: find and replace remaining `text-green-400`, `text-red-400` for financial up/down indicators with `text-[var(--buy)]`, `text-[var(--sell)]`; ensure card containers use `rounded-xl` and `bg-[var(--card)]`
- [X] T018 [P] Audit `frontend/src/components/StockFundamentals.tsx`: replace `text-red-400` for 52주 고점/상한가 displays with `text-[var(--buy)]` (상한가는 상승 강조); `text-blue-400` for 52주 저점 → `text-[var(--sell)]`
- [X] T019 Validate all 5 quickstart scenarios from `specs/014-toss-ui-redesign/quickstart.md` — confirm color system, typography, card layout, chart, and tabbar all pass visual checks

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1, T001)**: 시작 즉시 가능 — 모든 후속 Task의 전제조건
- **US1 (Phase 2, T002-T005)**: T001 완료 후 → 모두 병렬 실행 가능
- **US2 (Phase 3, T006-T009)**: T001 완료 후 → 모두 병렬 실행 가능 (US1과 동시 진행 가능)
- **US3 (Phase 4, T010-T012)**: T001 완료 후 → 모두 병렬 실행 가능
- **US4 (Phase 5, T013-T015)**: T001 독립, T013은 T014/T015와 독립
- **US5 (Phase 6, T016)**: T001 완료 후
- **Polish (Phase 7, T017-T019)**: 모든 이전 Phase 완료 후

### User Story Dependencies

- **US1 (P1)**: T001 이후 즉시 시작 — US2/US3/US4/US5와 병렬 가능
- **US2 (P1)**: T001 이후 즉시 시작 — US1과 동시에 진행 권장
- **US3 (P2)**: T001 이후 시작, US1/US2 완료 권장 (같은 파일 있음)
- **US4 (P2)**: T001 독립, 다른 파일이므로 US1~US3과 완전 병렬 가능
- **US5 (P3)**: BottomNav.tsx만 수정, 다른 모든 US와 병렬 가능

### Parallel Opportunities

```
T001 완료 →
  └─ T002, T003, T004, T005  (US1 — 모두 병렬)
  └─ T006, T007, T008, T009  (US2 — 모두 병렬)
  └─ T013, T014, T015        (US4 — 모두 병렬)
  └─ T016                    (US5 — 독립)
  └─ T010, T011, T012        (US3 — US1/US2 이후 권장)
→ T017, T018, T019           (Polish)
```

---

## Parallel Example: US1 색상 교체

```
동시 실행:
Task T002: SignalCard.tsx 색상 교체
Task T003: SentimentPanel.tsx direction colors 교체
Task T004: SentimentPanel.tsx FearGreed gauge 색상 교체
Task T005: indicatorLabels.ts 뱃지 색상 교체
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. T001: index.css CSS 변수 교체 → 즉각적인 전체 색상 변화
2. T002-T005: 하드코딩 색상 교체 (US1 완성)
3. T006-T009: 타이포그래피 정비 (US2 완성)
4. **STOP and VALIDATE**: 대시보드, 관심종목 카드 시각 확인

### Incremental Delivery

1. T001 → 즉각적인 다크 테마 효과
2. US1 완성 → 상승/하락 Toss 색상
3. US2 완성 → 타이포그래피 계층
4. US3 완성 → 카드 레이아웃 정리
5. US4 완성 → 차트 Toss 스타일
6. US5 완성 → 탭바 완성

---

## Notes

- `text-green-400`/`text-red-400` 교체 범위: **금융 상승/하락** 표시만. 연결 상태(`ConnectionIndicator`), 매매정지 경고(`RiskWarningBanner`)는 의미상 그린/레드이므로 변경하지 않는다.
- `--gold` CSS 변수 제거 후 `BottomNav`만 `var(--buy)`로 교체. 다른 곳에 `--gold` 사용처가 없으면 index.css에서 삭제.
- 차트(lightweight-charts)는 캔버스 기반이므로 CSS 변수 직접 참조 불가 → hex 값 직접 사용.
- 기존 수직 스냅 스크롤(Dashboard) 변경 없음.
