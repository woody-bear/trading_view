# Feature Specification: SQZ Terminal Design System Redesign

**Feature Branch**: `028-sqz-terminal-redesign`  
**Created**: 2026-04-21  
**Status**: Draft  
**Input**: 클로드에서 생성한 디자인 파일을 가지고 현재 디자인을 변경할거야 디자인에는 아직 개발되지 않은 기능과 수정이 필요한 화면도 있어 이점을 고려해서 추가할거야

## Context

현재 서비스("추세추종 연구소")는 다크 테마 기반의 모바일 우선 UI를 사용하고 있다.
Claude Design에서 "SQZ Terminal" 라이트 터미널 테마를 생성했으며, 이 디자인을 실제 서비스에 반영한다.

**디자인 파일 구성** (`/tmp/design_extract/asst/project/`):
- `tokens.css` — 라이트 테마 디자인 토큰 (oklch 컬러, Inter + JetBrains Mono 폰트)
- `pc-dashboard.jsx` — PC 대시보드 레이아웃
- `pc-detail.jsx` — PC 종목 상세 + BUY 리스트 + 조회조건 파이프라인
- `mobile-screens.jsx` — 모바일 홈/BUY리스트/종목상세/스캔
- `atoms.jsx` — 공유 UI 원자 (Spark, MiniCandles, FGGauge 등)

**미구현 화면** (디자인만 존재, 백엔드 연동 없거나 UI만 추가):
- PC 전체 레이아웃 (현재 모바일 우선 단일 컬럼)
- Market Ticker 8종목 스파크라인 바
- Scan Status Panel 4칸 요약
- WatchlistPanel 그리드 + 태그 뱃지
- MiniCandles 내장 SignalCard
- 모바일 홈 "최신 SQZ BUY" 퀵 스트립

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 라이트 테마 + 디자인 토큰 전환 (Priority: P1)

서비스의 모든 화면이 새 라이트 터미널 테마(흰/연회색 배경, 파란 악센트)로 표시된다. 색상·폰트·간격이 디자인 파일의 tokens.css 정의를 따른다. 기존 기능은 그대로 동작한다.

**Why this priority**: 모든 이후 작업의 기반. 토큰이 올바르게 적용돼야 개별 컴포넌트 리디자인이 일관성을 유지할 수 있다.

**Independent Test**: 앱을 로드해서 배경이 흰색 계열이고, 가격/코드 숫자가 모노스페이스 폰트로 표시되면 독립 검증 가능.

**Acceptance Scenarios**:

1. **Given** 앱 진입, **When** 어느 페이지든 로드, **Then** 배경이 흰색 계열로 표시되고 기존 검정 배경이 잔존하지 않는다.
2. **Given** 가격/코드 표시 영역, **When** 화면에 렌더링, **Then** JetBrains Mono 폰트가 적용된 모노스페이스로 표시된다.
3. **Given** BUY 신호 표시, **When** 화면에 렌더링, **Then** 초록색(--up)으로, SELL은 빨간색(--down)으로 표시된다.
4. **Given** 기존 모든 기능, **When** 디자인 토큰 교체 후, **Then** 기능 동작에 변화가 없다.

---

### User Story 2 — PC Top Navigation 리디자인 (Priority: P2)

PC 화면(md 이상)에서 기존 단순 상단바가 터미널 스타일 네비게이션으로 교체된다. 상단에 시장 시계(KRX/US 개장 여부 + 현재 시각)가 표시되고, 네비 탭에 종목 수 뱃지가 붙는다.

**Why this priority**: PC 사용자의 첫 인상을 결정하며, 레이아웃 구조가 확정돼야 개별 패널 배치가 가능하다.

**Independent Test**: 1440px 너비 브라우저에서 상단 네비에 KRX/US 개장 상태와 현재 시각이 표시되면 독립 검증 가능.

**Acceptance Scenarios**:

1. **Given** 1280px 이상 화면, **When** 앱 로드, **Then** 상단 네비에 KRX/US 개장 상태가 색 점(초록=열림, 빨강=닫힘)으로 표시된다.
2. **Given** PC 상단 네비, **When** 스캔 탭 표시, **Then** 현재 추천종목 수가 뱃지로 표시된다.
3. **Given** 1280px 미만 화면, **When** 앱 로드, **Then** BottomNav 하단 탭바 레이아웃이 표시된다.

---

### User Story 3 — Market Ticker 패널 (Priority: P2)

PC 대시보드 상단에 주요 지표 7개(KOSPI, KOSDAQ, S&P500, NASDAQ, VIX, USD/KRW, BTC)가 스파크라인과 함께 가로 그리드로 표시된다.

**Why this priority**: 가장 자주 보는 지표 영역. 현재 단순 카드 그리드 대비 정보 밀도가 향상된다.

**Independent Test**: PC 대시보드에서 지표 7개가 한 줄 그리드로 표시되고 각각 스파크라인이 있으면 독립 검증 가능.

**Acceptance Scenarios**:

1. **Given** PC 대시보드, **When** 로드, **Then** 지표 7개가 가로 한 줄 그리드로 표시된다.
2. **Given** 각 지표 타일, **When** 표시, **Then** 레이블/현재값/등락률/소형 스파크라인 4요소가 모두 보인다.
3. **Given** 등락률, **When** 양수이면 초록(--up), 음수이면 빨강(--down)으로 표시된다.

---

### User Story 4 — SignalCard 리디자인 (Priority: P2)

추천종목/관심종목 카드에 미니 캔들스틱 차트와 신호 칩 뱃지(SQZ BUY/BUY, 시장 구분)가 적용된다.

**Why this priority**: 가장 반복 노출되는 컴포넌트. 가독성과 정보 밀도가 가장 크게 개선된다.

**Independent Test**: 추천종목 목록에서 카드 1개에 미니 캔들스틱과 신호 칩이 모두 보이면 독립 검증 가능.

**Acceptance Scenarios**:

1. **Given** 추천종목 카드, **When** 표시, **Then** 20봉 미니 캔들스틱이 카드 내부에 인라인으로 표시된다.
2. **Given** 신호가 SQZ BUY인 카드, **When** 표시, **Then** 마젠타 칩으로 구분 표시된다.
3. **Given** 신호가 BUY인 카드, **When** 표시, **Then** 초록 칩으로 표시된다.
4. **Given** 시장 구분 칩(KOSPI/KOSDAQ 등), **When** 표시, **Then** 회색 ghost 칩으로 표시된다.

---

### User Story 5 — Scan Status Summary 패널 (Priority: P3)

PC 시장 스캔 영역에 추천/눌림목/대형주/데드크로스 수치가 4칸 패널로 강조 표시된다.

**Why this priority**: 현재 요약 카운트가 작게 표시된다. 터미널 스타일 큰 숫자로 강조하면 한눈에 파악 가능하다.

**Independent Test**: PC 시장스캔 헤더 아래 4칸 요약 패널이 보이면 독립 검증 가능.

**Acceptance Scenarios**:

1. **Given** PC 대시보드 시장 스캔 영역, **When** 스냅샷 로드 완료, **Then** 추천/눌림목/대형주/데드크로스가 각각 큰 숫자로 표시된다.
2. **Given** 추천 수치, **When** 표시, **Then** 초록색(--up)으로, 데드크로스는 빨간색(--down)으로 표시된다.

---

### User Story 6 — 모바일 홈 최신 BUY 퀵 스트립 (Priority: P3)

모바일 홈 화면 시장지표 섹션 하단에 최신 BUY/SQZ BUY 종목 3~5개가 스파크라인과 함께 리스트로 표시된다.

**Why this priority**: 모바일 홈에서 BUY 종목을 바로 확인하는 단축 경로를 제공한다.

**Independent Test**: 모바일 홈 시장지표 섹션에서 BUY 종목 퀵 리스트가 보이면 독립 검증 가능.

**Acceptance Scenarios**:

1. **Given** 모바일 홈 시장지표 섹션, **When** 스냅샷 데이터 있음, **Then** 최신 BUY/SQZ BUY 종목 최대 5개가 스파크라인 + 가격 + 신호 칩과 함께 표시된다.
2. **Given** 종목 탭, **When** 탭, **Then** 해당 종목 상세 페이지로 이동한다.
3. **Given** 스냅샷 데이터 없음, **When** 홈 로드, **Then** 퀵 스트립이 숨겨진다.

---

### Edge Cases

- PC → 모바일 리사이즈 시 PC 레이아웃이 자연스럽게 모바일로 전환되어야 한다.
- 스파크라인/캔들 데이터 없는 경우 빈 영역 또는 플레이스홀더로 graceful 처리한다.
- Google Fonts 차단 환경에서 시스템 폰트로 폴백 시 레이아웃이 깨지지 않아야 한다.
- 미구현 지표(US10Y 등) 데이터 없을 경우 "—"로 표시한다.
- OS 레벨 다크모드를 무시하고 라이트 테마로 고정한다.

---

## Requirements *(mandatory)*

### Functional Requirements

**디자인 토큰 + 폰트**

- **FR-001**: 시스템 MUST 새 토큰(`--bg-0`~`--bg-3`, `--fg-0`~`--fg-4`, `--accent`, `--up`, `--down`, `--warn`, `--mag`)을 `[data-theme="sqz"]` 스코프 아래 정의하고, `<html>` 루트에 해당 data-attr을 기본값으로 설정해야 한다. 기존 다크 토큰은 제거하지 않고 미적용 상태로 유지해 필요 시 data-attr 토글만으로 롤백 가능해야 한다.
- **FR-002**: 시스템 MUST Pretendard(한글+영문 UI 본문), Inter(영문 UPPERCASE 라벨), JetBrains Mono(숫자/코드) 3종 폰트를 로드하고 각 용도에 적용해야 한다. Pretendard는 한글 글리프를 포함하므로 Inter 대체로 한글 텍스트에 우선 적용한다.
- **FR-003**: 시스템 MUST BUY 신호 색상을 초록(--up), SELL 신호를 빨강(--down)으로 변경해야 한다.
- **FR-004**: `.panel`, `.chip`, `.chip-up`, `.chip-down`, `.chip-warn`, `.chip-accent`, `.chip-mag`, `.chip-ghost`, `.label`, `.mono` CSS 유틸리티 클래스가 전역 스타일에 추가되어야 한다.

**PC Top Navigation**

- **FR-005**: PC 상단 네비 MUST 현재 KRX/US 시장 개장 상태(OPEN/CLOSED + 색 점)를 표시해야 한다.
- **FR-006**: PC 상단 네비 MUST 현재 KST 시각을 표시해야 한다.
- **FR-007**: PC 상단 네비 탭 MUST 현재 추천종목 수를 뱃지로 표시해야 한다.

**Market Ticker 패널**

- **FR-008**: PC 대시보드 MUST KOSPI, KOSDAQ, S&P500, NASDAQ, VIX, USD/KRW, BTC 7개 지표를 가로 그리드로 표시해야 한다.
- **FR-009**: 각 지표 타일 MUST 레이블/값/등락률/스파크라인을 포함해야 한다.
- **FR-010**: 스파크라인 데이터 없을 경우 정적 더미 데이터로 표시해야 한다 (차후 실데이터 교체 가능 구조).

**SignalCard 리디자인**

- **FR-011**: SignalCard MUST 20봉 미니 캔들스틱 차트를 인라인으로 표시해야 한다.
- **FR-012**: SignalCard MUST 신호 종류(SQZ BUY/BUY)에 따라 다른 색상 칩 뱃지를 표시해야 한다.
- **FR-013**: SignalCard MUST 시장 구분(KOSPI/KOSDAQ/S&P500 등) ghost 칩을 표시해야 한다.
- **FR-014**: 미니 캔들스틱은 실제 가격 데이터 없을 경우 seeded 더미 캔들로 표시해야 한다.

**Scan Status Summary 패널**

- **FR-015**: PC 시장 스캔 영역 MUST 추천/눌림목/대형주/데드크로스 4개 수치를 큰 숫자 4칸 패널로 표시해야 한다.

**모바일 홈 퀵 스트립**

- **FR-016**: 모바일 홈 시장지표 섹션 MUST 최신 BUY/SQZ BUY 종목 최대 5개를 스파크라인 + 신호 칩과 함께 표시해야 한다.
- **FR-017**: 스냅샷 데이터 없으면 퀵 스트립을 숨겨야 한다.

**BUY 사례 스크랩 페이지 (UI 셸)**

- **FR-019**: "기록" 라우트(/scrap)에 BUY 사례 스크랩 페이지 레이아웃이 존재해야 한다. KPI 수치(총 사례/승률/평균수익률/보유일)는 더미값으로 표시하며, 백엔드 연동은 이번 스코프에서 제외한다.

**모바일 BottomNav 구조 변경**

- **FR-020**: 모바일 BottomNav MUST 5탭 구조(마켓·스캔·추천·기록·설정)로 변경되어야 한다. 각 탭은 디자인 파일의 아이콘·라벨을 따르며, "기록" 탭은 FR-019의 스크랩 페이지로 라우팅된다.

**하위 호환성**

- **FR-018**: 디자인 변경 후 기존 기능(시장 스캔, 관심종목, 알림, 설정, 종목 상세 차트)이 모두 정상 동작해야 한다.

### Key Entities

- **디자인 토큰**: CSS 변수 집합. 색상·폰트·간격·반경 값을 담는다.
- **SignalCard**: 종목 신호 정보 카드 컴포넌트. 미니 캔들, 신호 칩, RSI/거래량 포함.
- **Market Ticker**: 시장 지표 타일 행. 실시간 지표값 + 스파크라인 포함.
- **Scan Status Panel**: 스캔 결과 요약 수치 표시 패널 (추천/눌림목/대형주/데드크로스).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 디자인 적용 후 모든 페이지에서 흰색 계열 배경이 표시되고, 기존 다크 배경이 잔존하지 않는다.
- **SC-002**: JetBrains Mono 폰트가 가격·코드·지표값 영역에 적용되어 숫자 정렬이 일관된다.
- **SC-003**: BUY 신호는 초록, SELL 신호는 빨강으로 표시되어 시각 구분이 명확하다.
- **SC-004**: PC 화면(1280px 이상)에서 Market Ticker 지표 7개가 한 줄에 표시된다.
- **SC-005**: SignalCard에 미니 캔들스틱이 포함되어 클릭 전 가격 추세 파악이 가능하다.
- **SC-006**: 기존 기능(스캔, 관심종목, 알림, 설정, 차트)의 동작이 디자인 변경 후에도 100% 유지된다.
- **SC-007**: 모바일(390px) 화면에서 BottomNav 및 스냅 섹션 레이아웃이 깨지지 않는다.

---

## Assumptions

- 미니 캔들스틱 초기 구현 시 seeded RNG 더미 데이터를 사용하며, 이후 실 API 데이터로 교체 가능한 구조로 구성한다.
- OS 레벨 다크모드를 무시하고 라이트 테마를 강제 적용한다. (다크/라이트 토글은 이 스펙 범위 밖)
- PC 레이아웃 브레이크포인트는 Tailwind `xl`(1280px)로 변경한다. 1280px 미만(기존 `md` 태블릿 구간 포함)은 모바일 레이아웃을 사용한다.
- 브랜드명은 "추세추종 연구소"를 유지한다 (디자인 파일의 "SQZ Terminal"은 레퍼런스 이름).
- 색상 시맨틱 변경(buy 빨강→초록, sell 파랑→빨강)은 US 주식 관례를 따른다.

---

## Clarifications

### Session 2026-04-21

- Q: BUY 사례 스크랩 페이지(pc-scrap.jsx — 승률/수익률 KPI 포함)를 이번 리디자인에 포함할 것인지? → A: UI 셸만 구현 — 라우트/레이아웃/더미 수치만, 백엔드 연동 없음
- Q: 새 디자인 시스템 롤아웃 전략은? → A: 루트 class/data-attr 플래그로 신구 테마 병존, 기본값은 새 테마 (롤백 경로 유지)
- Q: 한글 폰트 폴백 전략은? → A: Pretendard + Inter + JetBrains Mono 병행 로드 (Pretendard로 한글+영문 통합)
- Q: 태블릿 뷰포트(768–1279px) 레이아웃은? → A: 브레이크포인트를 xl(1280px)로 변경 — 1280px 미만은 모바일 레이아웃 사용
- Q: 모바일 BottomNav 탭 구조를 디자인대로 변경할 것인지? → A: 5탭 구조로 변경 (마켓·스캔·추천·기록·설정)

---

## Implementation Phases

구현은 아래 20단계로 순차 진행한다. PC → 모바일 순. 각 단계 완료 후 백엔드 재시작 + 프론트 재빌드(`pnpm build`) + 브라우저 검증 → 다음 단계 진입. 각 단계는 독립 커밋으로 관리해 문제 시 해당 단계만 revert 가능.

### 기반 (공통)

1. **토큰·폰트·테마 플래그** — `tokens.css` 추가, Pretendard/Inter/JetBrains Mono 로드, `<html data-theme="sqz">` 기본 적용, 기존 토큰 보존
2. **공용 CSS 유틸리티** — `.panel`, `.chip`, `.chip-up/down/warn/accent/mag/ghost`, `.label`, `.mono`
3. **공용 컴포넌트 포팅** — `Spark`, `MiniCandles`, `FGGauge` + seeded 더미 유틸(`genSpark`, `genCandles`, `mulberry32`)

### PC (1280px 이상)

4. **브레이크포인트 전환** — Tailwind `md` → `xl` (1280px) 마이그레이션
5. **PC TopNav** — 로고·탭+뱃지·마켓클록(KRX/US)·KST 시각·⌘K SEARCH
6. **Market Ticker 패널** — 8종목 가로 그리드 + Spark (더미 데이터)
7. **FearGreedPanel** — 반원 게이지 + 30일 추이 라인 (기존 sentiment API 재활용)
8. **ScanStatusPanel 4칸** — 추천/눌림목/대형주/데드크로스 터미널 숫자, 진행률 바, REFRESH
9. **SignalCard 리디자인** — MiniCandles 내장, 신호 칩(SQZ BUY 마젠타/BUY 초록), 시장 ghost 칩
10. **WatchlistPanel 그리드** — KR/US 그리드, 검색·추가·삭제 인터랙션 통합
11. **추천/눌림목/대형주 섹션** — 섹션 chevron 토글 유지, 새 SignalCard 적용
12. **PC 종목 상세 2컬럼** — 좌: 기존 lightweight-charts 차트 / 우: EntryPlanPanel·SqueezeStages (더미)
13. **조회조건 페이지 파이프라인** — SVG 다이아몬드 플로우차트 교체
14. **기록(스크랩) 페이지 PC UI 셸** — KPI 그리드 + 거래 카드 (더미), `/scrap` 라우트

### 모바일 (1280px 미만)

15. **모바일 BottomNav 5탭** — 마켓·스캔·추천·기록·설정 라우팅 재구성
16. **모바일 홈 상단** — FG게이지 카드 + 2×2 시장지표 그리드
17. **모바일 홈 BUY 퀵 스트립** — 최신 BUY/SQZ BUY 최대 5종목 + 스파크라인
18. **모바일 스캔/추천 페이지** — 새 SignalCard 모바일 대응
19. **모바일 종목 상세** — 상태 칩·지표 행 리디자인
20. **모바일 설정 + 기록 셸** — 민감도 라디오 재디자인, 일반환경 섹션(UI only), 스캔 히스토리(더미), 스크랩 모바일 셸

### 진행 규칙

- 각 단계는 독립 커밋으로 관리
- 회귀 리스크 높은 단계(8·9·10·11·12·19): 체크리스트 검증 필수
- 단계 간 의존성: 1·2·3 → 4 → 5~14 (PC) → 15~20 (모바일)

---

## Out of Scope

- 다크/라이트 테마 토글 기능
- 스파크라인 실시간 데이터 연동
- PC 종목 상세 2컬럼 레이아웃의 백엔드 새 API 추가
- 어드민/관리 화면 디자인 변경
- BUY 사례 스크랩 KPI 백엔드 연동 (거래 기록 저장/조회 API)
