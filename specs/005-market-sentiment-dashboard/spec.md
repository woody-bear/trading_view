# Feature Specification: 시장 방향성 대시보드 (Fear & Greed Index)

**Feature Branch**: `005-market-sentiment-dashboard`
**Created**: 2026-03-23
**Status**: Draft
**Input**: User description: "메인화면에 Fear & Greed Index 를 포함해서 시장의 방향성을 읽을수 있는 방향성 대시보드 기능 추가"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fear & Greed Index 게이지 표시 (Priority: P1)

사용자가 메인화면(대시보드)에 진입하면 현재 시장의 Fear & Greed Index를 직관적인 게이지(0~100)로 확인할 수 있다. 0은 극도의 공포(Extreme Fear), 100은 극도의 탐욕(Extreme Greed)을 의미하며, 현재 시장 심리를 한눈에 파악하여 매매 타이밍 판단에 활용한다.

**Why this priority**: 시장 방향성 대시보드의 핵심 지표. 이것 없이는 피처의 가치가 없다.

**Independent Test**: 메인화면에 진입하여 Fear & Greed Index 게이지가 0~100 범위의 숫자와 상태 라벨(Extreme Fear/Fear/Neutral/Greed/Extreme Greed)로 표시되는지 확인

**Acceptance Scenarios**:

1. **Given** 메인화면 진입, **When** Fear & Greed 데이터가 정상 수신, **Then** 게이지에 현재 수치(0~100)와 상태 라벨이 색상과 함께 표시됨 (빨강=공포, 초록=탐욕)
2. **Given** 메인화면 진입, **When** 데이터 로딩 중, **Then** 게이지 영역에 스켈레톤 UI 표시
3. **Given** 외부 데이터 소스 오류, **When** 데이터 수신 실패, **Then** "시장 심리 데이터를 불러올 수 없습니다" 안내 표시

---

### User Story 2 - 시장 방향성 종합 지표 대시보드 (Priority: P1)

Fear & Greed Index 외에도 시장 방향성을 판단할 수 있는 주요 지표들을 함께 표시한다. VIX(변동성 지수), 주요 지수 등락률(코스피/S&P500/나스닥), 환율(USD/KRW) 변동을 한 화면에서 확인하여 종합적 시장 판단이 가능하다.

**Why this priority**: 단일 지표만으로는 시장 판단이 불충분. 여러 지표를 종합해야 신뢰도 높은 방향성 판단이 가능하다.

**Independent Test**: 메인화면 방향성 대시보드 섹션에서 Fear & Greed, VIX, 주요 지수, 환율이 모두 표시되는지 확인

**Acceptance Scenarios**:

1. **Given** 메인화면 진입, **When** 방향성 대시보드가 로드됨, **Then** 다음 지표가 카드 형태로 표시됨: Fear & Greed Index, VIX 지수, 코스피 등락률, S&P500 등락률, 나스닥 등락률, USD/KRW 환율
2. **Given** 각 지표 카드, **When** 데이터가 표시됨, **Then** 현재값 + 전일 대비 변동(%, 색상: 상승=초록/하락=빨강) + 방향 화살표가 포함됨
3. **Given** 모든 지표가 로드됨, **When** 사용자가 종합 판단, **Then** 전체 지표를 기반으로 "시장 분위기" 요약 라벨 표시 (예: "위험 회피 분위기", "낙관적 분위기", "혼조세")

---

### User Story 3 - Fear & Greed 추이 차트 (Priority: P2)

사용자가 Fear & Greed Index의 최근 추이(30일)를 미니 라인 차트로 확인할 수 있다. 현재 수치가 최근 추세 대비 어느 위치인지 파악하여 시장 심리 변화의 방향성을 읽는다.

**Why this priority**: 현재 수치만으로는 추세 파악이 어렵다. 30일 추이를 보면 심리가 악화/개선 중인지 판단 가능하나, 핵심 기능(현재값 표시)이 우선이다.

**Independent Test**: Fear & Greed 게이지 아래에 30일 미니 차트가 표시되고, 날짜별 수치가 라인으로 연결되는지 확인

**Acceptance Scenarios**:

1. **Given** Fear & Greed 게이지가 표시된 상태, **When** 추이 차트 영역 확인, **Then** 최근 30일간의 수치가 미니 라인 차트로 표시됨
2. **Given** 추이 차트에서, **When** 최근 7일간 수치가 20 이하(극도의 공포), **Then** 해당 구간이 빨간색으로 강조됨

---

### User Story 4 - 데이터 자동 갱신 (Priority: P2)

방향성 대시보드의 모든 지표는 일정 간격으로 자동 갱신되어 최신 상태를 유지한다. 사용자가 수동으로 새로고침하지 않아도 시장 변화를 실시간에 가까이 확인할 수 있다.

**Why this priority**: 부가 기능이지만, 오래된 데이터로 잘못된 판단을 내리는 것을 방지하기 위해 필요하다.

**Independent Test**: 메인화면을 열어둔 상태에서 5분 후 지표 수치가 자동 갱신되는지 확인

**Acceptance Scenarios**:

1. **Given** 방향성 대시보드가 표시된 상태, **When** 5분이 경과, **Then** 모든 지표가 자동으로 최신 데이터로 갱신됨
2. **Given** 갱신 중, **When** 네트워크 오류 발생, **Then** 기존 데이터를 유지하고 "마지막 갱신: N분 전" 표시

---

### Edge Cases

- Fear & Greed Index 제공 서비스가 일시 중단된 경우 → "데이터 일시 불가" 안내 + 마지막 성공 데이터 표시
- 주말/공휴일에는 주식 시장 지수가 변동 없음 → 마지막 영업일 종가 기준 표시 + "장 마감" 라벨
- VIX 데이터가 한국 시간 기준 오전에 아직 갱신되지 않은 경우 → 전일 종가 표시
- 모바일 화면에서 카드가 가로로 다 안 들어가는 경우 → 2열 그리드로 반응형 배치
- 환율 데이터 제공 중단 → 기존 환율 화면(/forex)의 데이터 재사용

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 메인화면 상단에 Fear & Greed Index를 게이지(0~100) 형태로 표시해야 한다
- **FR-002**: Fear & Greed Index의 5단계 상태 라벨을 색상과 함께 표시해야 한다 (Extreme Fear/Fear/Neutral/Greed/Extreme Greed)
- **FR-003**: VIX 변동성 지수의 현재값과 전일 대비 변동률을 표시해야 한다
- **FR-004**: 주요 지수(코스피, S&P500, 나스닥)의 현재값과 등락률을 표시해야 한다
- **FR-005**: USD/KRW 환율의 현재값과 변동을 표시해야 한다
- **FR-006**: 모든 지표의 등락 방향을 색상(상승=초록, 하락=빨강)과 화살표로 표시해야 한다
- **FR-007**: Fear & Greed Index의 최근 30일 추이를 미니 라인 차트로 표시해야 한다
- **FR-008**: 모든 지표를 종합하여 "시장 분위기" 요약 라벨(위험 회피/낙관적/혼조세)을 표시해야 한다
- **FR-009**: 5분 간격으로 모든 지표를 자동 갱신해야 한다
- **FR-010**: 데이터 로딩 중 스켈레톤 UI를 표시해야 한다
- **FR-011**: 데이터 수신 실패 시 안내 메시지를 표시하고, 마지막 성공 데이터를 유지해야 한다
- **FR-012**: 모바일에서 2열 그리드로 반응형 배치해야 한다
- **FR-013**: "마지막 갱신: N분 전" 타임스탬프를 표시해야 한다
- **FR-014**: UI 레이아웃은 "핵심 강조형"으로 구성해야 한다 — Fear & Greed 반원형 게이지를 상단 중앙에 크게 배치하고, 나머지 5개 지표(VIX, 코스피, S&P500, 나스닥, USD/KRW)를 그 아래 한 줄 미니 카드로 배치. 시장 분위기 요약 라벨은 게이지 아래에 표시

### Key Entities

- **FearGreedIndex**: 시장 심리 지수 — 수치(0~100), 상태 라벨, 30일 추이 배열, 갱신 시각
- **MarketIndicator**: 개별 시장 지표 — 지표명, 현재값, 전일 대비 변동(%), 변동 방향(상승/하락), 갱신 시각
- **MarketSentiment**: 종합 시장 분위기 — 요약 라벨, 구성 지표 목록, 판정 근거

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 메인화면 진입 시 방향성 대시보드가 3초 이내에 표시되어야 한다
- **SC-002**: Fear & Greed Index 수치가 외부 데이터 소스와 1시간 이내 오차로 동기화되어야 한다
- **SC-003**: 모든 지표(6개)가 한 화면에서 스크롤 없이 확인 가능해야 한다 (PC 기준)
- **SC-004**: 자동 갱신 주기(5분) 동안 사용자가 수동 새로고침 없이 최신 데이터를 확인할 수 있어야 한다
- **SC-005**: 외부 데이터 소스 장애 시에도 마지막 성공 데이터가 표시되어 빈 화면이 0건이어야 한다

## Clarifications

### Session 2026-03-24

- Q: UI 레이아웃을 어떻게 구성할 것인가? → A: Option B (핵심 강조형) — Fear & Greed 반원형 게이지를 상단 중앙에 크게, 나머지 5개 지표를 한 줄 미니 카드로 배치

## Assumptions

- Fear & Greed Index는 CNN Fear & Greed Index 또는 동등한 무료 데이터 소스를 사용한다
- VIX, S&P500, 나스닥 지수는 무료 금융 데이터 소스(yfinance 등)에서 조회 가능하다
- 코스피 지수는 기존 pykrx 또는 한투 API에서 조회 가능하다
- USD/KRW 환율 데이터는 기존 환율 화면(/forex)의 데이터 소스를 재사용한다
- 방향성 대시보드는 메인화면(Dashboard)의 관심종목 목록 위에 배치한다
- "시장 분위기" 요약은 단순 규칙 기반 판정이다 (머신러닝 아님)
