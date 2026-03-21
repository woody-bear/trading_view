# Requirements Quality Checklist: 종목 상세화면 차트 사용성 개선

**Purpose**: spec.md, plan.md, tasks.md에 기술된 요구사항의 완전성, 명확성, 일관성, 측정 가능성을 검증
**Created**: 2026-03-21
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [ ] CHK001 - Are error handling requirements defined for ALL chart data failure modes (empty, timeout, network error, malformed response)? [Completeness, Spec §FR-001~003]
- [ ] CHK002 - Are toast message requirements specified for ALL user actions, including watchlist deletion? [Completeness, Spec §FR-004] — T023 notes "if exists in Dashboard" which suggests incomplete scope identification
- [ ] CHK003 - Are SSE connection cleanup requirements specified for ALL navigation scenarios (back button, URL change, tab close, rapid symbol switching)? [Completeness, Spec §FR-008]
- [ ] CHK004 - Are requirements defined for what happens when localStorage is full or unavailable (private browsing mode) for BuyPoint storage? [Gap, Spec §FR-015]
- [ ] CHK005 - Are requirements defined for the initial today-candle construction when `market_open=true` but no real-time price is yet available? [Gap, Spec §FR-010]
- [ ] CHK006 - Are loading/transition state requirements defined for the ChartErrorBoundary recovery flow (user clicks "새로고침")? [Gap, Spec §FR-007]
- [ ] CHK007 - Are requirements defined for how existing BuyPoint price lines render when chart timeframe changes (e.g., 1d → 1w)? [Gap, Spec §FR-014]

## Requirement Clarity

- [ ] CHK008 - Is "부드럽게 전환" (smooth transition) from skeleton to chart quantified with specific animation duration or easing? [Clarity, Spec US2 §Scenario 2]
- [ ] CHK009 - Is "일정 시간 경과" for SSE reconnection failure quantified with a specific timeout (e.g., 30s, 3 retries)? [Ambiguity, Spec US4 §Scenario 3]
- [ ] CHK010 - Is "비정상적 갭(±5% 이상)" in SC-007 a hard threshold or a guideline? Does it account for legitimate gap-up/gap-down scenarios (earnings, overnight news)? [Clarity, Spec §SC-007]
- [ ] CHK011 - Is "프레임 드롭 없이 부드러운 UI" (SC-006) quantified with specific FPS target or measurement method? Plan mentions 60fps but spec does not. [Ambiguity, Spec §SC-006]
- [ ] CHK012 - Are the specific hex color values for marker hover states documented in the spec itself, or only in contracts? [Clarity, Spec §FR-013] — Spec says "밝은 녹색/밝은 적색" without exact values
- [ ] CHK013 - Is "매수지점 라벨 재클릭" in FR-016 referring to clicking the price line label or clicking the same BUY marker again? [Ambiguity, Spec §FR-016 vs US10 §Scenario 3]

## Requirement Consistency

- [ ] CHK014 - Are the `market_open` (plan/contracts/tasks) vs `incomplete_today` (research.md R-006) field names consistent across all artifacts? [Consistency, research.md vs plan.md]
- [ ] CHK015 - Does plan.md's file list (`BuyPointLine.tsx` as separate component) align with tasks.md's implementation approach (buy point logic inside IndicatorChart.tsx T035)? [Consistency, plan.md L81 vs tasks.md T035]
- [ ] CHK016 - Are mobile behavior requirements consistent between US9 (hover disabled) and US10 (tap enabled)? US9 disables mobile interaction, but US10 expects "모바일: 탭" to work. [Consistency, Spec US9 §Scenario 3 vs US10 §Scenario 1]
- [ ] CHK017 - Is the toast position requirement ("화면 하단 중앙, 모바일 탭바 위" in contracts) reflected in spec.md or only in contracts? [Consistency, Spec §FR-004 vs contracts/toast-api.md]
- [ ] CHK018 - Are IndicatorChart modification order requirements clear given US7, US5, US9, US10, and Polish all modify the same file? [Consistency, tasks.md Notes]

## Acceptance Criteria Quality

- [ ] CHK019 - Can US7 §Scenario 3 ("가격 불일치가 발생하지 않도록") be objectively measured? What constitutes "불일치"? [Measurability, Spec US7 §Scenario 3]
- [ ] CHK020 - Can SC-002 ("1초 이내에 표시") be measured in a standardized way? Does it define network conditions, device baseline, or measurement method? [Measurability, Spec §SC-002]
- [ ] CHK021 - Can SC-008 ("다음 영업일 장 시작 전까지 유효") be verified without waiting for actual market hours? Are test scenarios defined for simulated times? [Measurability, Spec §SC-008]
- [ ] CHK022 - Is the acceptance criterion for US10 §Scenario 2 ("수익률(%)이 라벨에 함께 표시") specific about decimal precision, sign convention (+/-), and currency formatting? [Measurability, Spec US10 §Scenario 2]

## Scenario Coverage

- [ ] CHK023 - Are requirements defined for what happens when a user clicks a SELL marker (not BUY) in US10? Is it intentionally ignored or should it record a sell point? [Coverage, Spec US10]
- [ ] CHK024 - Are requirements defined for the chart behavior when switching between timeframes (1d→1w→1M) while market_open=true? [Coverage, Gap]
- [ ] CHK025 - Are requirements defined for simultaneous SSE and WebSocket price update conflicts on the same candle? [Coverage, Gap]
- [ ] CHK026 - Are requirements defined for how markers behave during chart zoom/scroll (do hover zones move correctly)? [Coverage, Spec §FR-013]
- [ ] CHK027 - Are requirements defined for what the BuyPoint price line looks like when the buy price is outside the current visible chart range? [Coverage, Spec §FR-014]

## Edge Case Coverage

- [ ] CHK028 - Are requirements defined for yfinance returning NaN/null values in OHLCV during the incomplete candle strip process? [Edge Case, Spec §FR-010]
- [ ] CHK029 - Are requirements defined for stock split scenarios where yesterday's close and today's open differ by 50%+ legitimately (not an error)? [Edge Case, Spec §SC-007]
- [ ] CHK030 - Are requirements defined for DST transition days (US market, 2 days/year) when ET shifts by 1 hour? [Edge Case, Spec §FR-011]
- [ ] CHK031 - Are requirements defined for when a BUY marker exists at the same timestamp as the incomplete today-candle boundary? [Edge Case, Spec §FR-014 + FR-010]
- [ ] CHK032 - Are requirements defined for extremely long symbol names (e.g., crypto pairs) in the buy point label display? [Edge Case, Spec §FR-014]

## Non-Functional Requirements

- [ ] CHK033 - Are performance requirements specified for `subscribeCrosshairMove` callback frequency impact on chart rendering? [Performance, Gap]
- [ ] CHK034 - Are localStorage size limits considered for users monitoring many symbols (e.g., 100+ buyPoints keys)? [Scalability, Gap]
- [ ] CHK035 - Are requirements defined for chart rendering performance with large datasets (200+ candles + indicators + markers + squeeze dots + buy point line)? [Performance, Gap]
- [ ] CHK036 - Are internationalization requirements defined for buy point labels (₩ vs $ formatting based on market)? [Completeness, Spec US10 §Scenario 1] — Currently hardcoded as "₩"

## Dependencies & Assumptions

- [ ] CHK037 - Is the assumption "토스트 메시지 컴포넌트는 기존 UI 라이브러리를 활용하거나 간단히 구현 가능" validated against the decision to self-implement? [Assumption, Spec §Assumptions]
- [ ] CHK038 - Is the Python `zoneinfo` module availability validated for the target Python 3.12 environment? [Dependency, plan.md]
- [ ] CHK039 - Is the assumption "EventSource의 자동 재연결을 활용" validated for all target browsers? Some browsers limit reconnection attempts. [Assumption, Spec §Assumptions]
- [ ] CHK040 - Are lightweight-charts v5 API assumptions (createSeriesMarkers return type, subscribeClick param shape) validated against actual library types? [Dependency, contracts/marker-interaction.md]

## Notes

- Check items off as completed: `[x]`
- Items referencing `[Gap]` indicate requirements that may need to be added to spec.md
- Items referencing `[Ambiguity]` indicate requirements that need clarification
- Items referencing `[Consistency]` indicate cross-artifact alignment issues
- CHK013, CHK015, CHK016 correspond to analyze report findings C3, I1, U3
