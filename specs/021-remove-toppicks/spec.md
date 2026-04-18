# Feature Specification: 추천종목(TopPicks) 기능 완전 삭제

**Feature Branch**: `021-remove-toppicks`  
**Created**: 2026-04-12  
**Status**: Draft  
**Input**: User description: "추천종목(TopPicks) 기능 완전 삭제"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 화면에서 추천종목 섹션 제거 (Priority: P1)

사용자가 메인 대시보드와 스캔 화면을 열었을 때 '추천종목' 섹션이 더 이상 표시되지 않는다.
불필요한 정보가 제거되어 화면이 간결해지고, 사용자가 필요한 정보(BUY 종목, 과열 종목 등)에 집중할 수 있다.

**Why this priority**: 사용자가 직접 사용하지 않는 UI 요소를 제거하는 것이 핵심 목표이므로 가장 높은 우선순위.

**Independent Test**: 앱을 실행하고 대시보드, 스캔 화면을 열었을 때 '추천종목' 또는 'TopPicks' 관련 섹션/카드/탭이 전혀 보이지 않으면 완료.

**Acceptance Scenarios**:

1. **Given** 앱이 실행된 상태에서, **When** 대시보드(홈)를 열면, **Then** '추천종목' 섹션이 표시되지 않는다.
2. **Given** 앱이 실행된 상태에서, **When** 스캔 탭을 열면, **Then** '추천종목' 섹션이 표시되지 않는다.
3. **Given** 사용자가 `/picks` URL로 직접 접근을 시도해도, **Then** 해당 페이지가 렌더링되지 않는다.

---

### User Story 2 - 나머지 스캔 기능 정상 동작 유지 (Priority: P1)

추천종목 제거 후에도 BUY 종목 스캔, 과열 스캔, MAX SQ 스캔 기능이 정상적으로 동작한다.
삭제 작업이 다른 기능에 사이드 이펙트를 주지 않아야 한다.

**Why this priority**: 삭제 작업으로 인한 회귀 방지가 핵심.

**Independent Test**: 스캔 화면에서 BUY 종목/과열 종목 섹션이 데이터를 정상 표시하면 완료.

**Acceptance Scenarios**:

1. **Given** 스캔 데이터가 존재할 때, **When** 스캔 화면을 열면, **Then** BUY 종목 목록이 정상 표시된다.
2. **Given** 스캔 데이터가 존재할 때, **When** 스캔 화면을 열면, **Then** 과열 종목 목록이 정상 표시된다.
3. **Given** 앱이 실행 중일 때, **When** 자동 스캔이 실행되면, **Then** picks 관련 오류 없이 완료된다.

---

### User Story 3 - 백엔드 코드 및 DB 정리 (Priority: P2)

추천종목 관련 API 엔드포인트, 서비스 파일, DB 테이블이 모두 제거되어 코드베이스가 간결해진다.
미사용 코드로 인한 혼란과 유지보수 부담이 사라진다.

**Why this priority**: 기능 삭제의 완결성을 위해 필요하지만, P1이 완료된 후 진행 가능.

**Independent Test**: 백엔드 서버 기동 시 오류 없이 시작되고, 삭제된 API 엔드포인트가 응답하지 않으면 완료.

**Acceptance Scenarios**:

1. **Given** 코드 삭제 후, **When** 백엔드 서버를 시작하면, **Then** 임포트 오류 없이 정상 기동된다.
2. **Given** 백엔드가 실행 중일 때, **When** 추천종목 API를 호출하면, **Then** 404 응답을 반환한다.
3. **Given** DB 마이그레이션 적용 후, **When** DB 스키마를 확인하면, **Then** `daily_top_pick` 테이블이 존재하지 않는다.

---

### Edge Cases

- picks 데이터가 `scan_snapshot_item` 테이블에 `category="picks"`로 남아있어도 다른 카테고리(chart_buy, overheat) 조회에 영향이 없어야 한다.
- 프론트엔드 빌드 후 추천종목 관련 함수 참조가 0건이어야 한다.
- `market_scanner.py` 삭제 후 다른 서비스/라우터에서 해당 모듈을 임포트하는 코드가 없어야 한다.

## Requirements *(mandatory)*

### Functional Requirements

**Frontend 제거**

- **FR-001**: `TopPicks.tsx` 파일을 삭제한다.
- **FR-002**: `Dashboard.tsx`에서 `picks` 상태, `allPicks` 배열, 관련 렌더링 블록을 제거한다.
- **FR-003**: `Scan.tsx`에서 "추천종목" 섹션 전체 블록과 `picks` 상태를 제거한다.
- **FR-004**: `api/client.ts`에서 `fetchLatestPicks()`, `scanMarket()` 함수를 삭제한다.

**Backend 제거**

- **FR-005**: `market_scan.py`에서 추천종목 전용 엔드포인트(`POST /scan/market`, `GET /scan/market/latest`)와 `_save_daily()` 함수를 삭제한다.
- **FR-006**: `services/market_scanner.py` 파일을 삭제한다.
- **FR-007**: `services/full_market_scanner.py`에서 `picks` 카테고리 분류 로직을 제거한다.

**DB 정리**

- **FR-008**: `daily_top_pick` 테이블을 마이그레이션으로 삭제한다.
- **FR-009**: `models.py`에서 `DailyTopPick` ORM 클래스를 삭제한다.

**회귀 방지**

- **FR-010**: 삭제 후 프론트엔드 빌드와 백엔드 서버 기동이 오류 없이 완료되어야 한다.
- **FR-011**: BUY 종목, 과열 종목, MAX SQ, chart_buy 스캔 기능은 변경 없이 동작해야 한다.

### Key Entities

- **DailyTopPick**: 시장별 Top 3 추천종목을 날짜별로 저장하던 테이블 — 삭제 대상
- **ScanSnapshotItem (picks category)**: 전체 스캔 결과 중 picks 분류 항목 — 분류 로직만 제거 (테이블 및 다른 카테고리는 유지)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 대시보드와 스캔 화면에서 추천종목 관련 UI 요소가 0개 표시된다.
- **SC-002**: 삭제 후 프론트엔드 빌드 오류가 0건 발생한다.
- **SC-003**: 삭제 후 백엔드 서버 기동 오류가 0건 발생한다.
- **SC-004**: BUY 종목, 과열 종목 스캔 기능이 삭제 전과 동일하게 동작한다(회귀 없음).
- **SC-005**: 코드베이스에서 `fetchLatestPicks`, `DailyTopPick`, `market_scanner` 참조가 0건 남는다.

## Assumptions

- `TopPicks.tsx`는 이미 `App.tsx`에서 라우트 미등록 상태이므로 별도 라우팅 제거 작업 불필요.
- `BottomNav.tsx`에는 picks 탭이 없으므로 네비게이션 수정 불필요.
- `ScanSnapshotItem` 테이블 자체는 유지하고 `category="picks"` 데이터의 신규 생성만 중단한다(기존 데이터 삭제 불필요).
- Alembic 마이그레이션은 새 revision 파일을 생성하여 `daily_top_pick` 테이블을 drop한다.
