# Feature Specification: 구글 로그인 기반 개인화

**Feature Branch**: `008-google-auth-personalization`
**Created**: 2026-03-29
**Status**: Clarified
**Input**: 구글 로그인을 통해 개인화 요소(관심종목, 알림, 포지션 진입 상태)를 사용자별로 관리. 비로그인 사용자도 시장 지표/스캔/환율 자유 이용.

## Clarifications

### Session 2026-03-29

- Q: 세션 관리 방식 (ERD 영향) — JWT Access only / JWT + Refresh / 서버 세션(쿠키) → A: Supabase Auth 사용으로 세션/JWT 자동 관리. `sessions` 테이블 불필요. 프론트엔드 `@supabase/supabase-js`, 백엔드 FastAPI에서 Supabase JWT 검증.
- Q: Google Auth 구현 방식 — Supabase Auth vs 직접 구현 → A: Supabase Auth (Option A). Google OAuth 대시보드 체크박스, 세션 자동 처리, 백엔드 구현량 최소화.
- Q: 기존 watchlist 마이그레이션 전략 — nullable backfill / 마이그레이션 스크립트 / 새로 시작 → A: 마이그레이션 스크립트 (Option B). SQLite → Supabase 데이터 복사 + admin Google 계정으로 최초 로그인 후 user_id 일괄 설정.
- Q: 마이그레이션 스크립트 실행 시점 — 즉시 / Google Auth 완료 후 첫 로그인 / 수동 재등록 → A: Google Auth 구현 완료 후 admin 첫 로그인으로 UUID 확정 시점에 실행 (Option B).
- Q: 프론트엔드 인증 상태 관리 — @supabase/supabase-js 직접 사용 vs 백엔드 API 간접 처리 → A: @supabase/supabase-js 직접 사용. 세션 자동 관리, Zustand에 user 상태만 동기화.
- Q: SQLite WAL 멀티유저 동시성 — 사용자 증가 시 SQLite 한계 도달 가능성 → A: DB를 Supabase(PostgreSQL)로 전환. Cloudflare(기존) + Mac Mini(백엔드) + Supabase(DB) 구성으로 10만 명 대응. SQLAlchemy ORM 유지로 전환 비용 최소화.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 구글 로그인/로그아웃 (Priority: P1)

사용자가 사이트 우측 상단의 "구글 로그인" 버튼을 클릭하면 구글 계정으로 로그인할 수 있다. 로그인 후 프로필 사진과 이름이 표시되고, 로그아웃도 가능하다.

**Why this priority**: 모든 개인화 기능의 기반. 로그인 없이는 사용자 식별이 불가능.

**Independent Test**: 구글 로그인 버튼 클릭 → 구글 인증 → 로그인 완료 후 프로필 표시 → 로그아웃 → 비로그인 상태 복귀

**Acceptance Scenarios**:

1. **Given** 비로그인 상태, **When** "구글 로그인" 버튼 클릭, **Then** 구글 인증 화면이 나타나고 인증 완료 후 로그인 상태가 된다
2. **Given** 로그인 상태, **When** 프로필 영역 클릭, **Then** 로그아웃 옵션이 표시되고 클릭 시 비로그인 상태로 돌아간다
3. **Given** 로그인 상태, **When** 브라우저를 닫고 다시 열면, **Then** 로그인 상태가 유지된다 (세션 지속)
4. **Given** 비로그인 상태, **When** 어떤 페이지든 접속, **Then** 시장 지표, 전체 시장 스캔(차트 BUY, 추천 종목), 환율 페이지는 정상 이용 가능

---

### User Story 2 - 개인별 관심종목 관리 (Priority: P1)

로그인한 사용자의 관심종목이 개인 계정에 연결되어 저장된다. 다른 기기에서 로그인해도 동일한 관심종목을 볼 수 있다. 비로그인 시에는 관심종목 추가/삭제가 불가하고 안내 메시지를 표시한다.

**Why this priority**: 관심종목이 개인화의 핵심. 현재 모든 사용자가 동일한 watchlist를 공유하는 문제 해결.

**Independent Test**: 사용자 A가 관심종목 추가 → 사용자 B 로그인 시 A의 관심종목이 안 보임 → A가 다른 기기에서 로그인 시 동일한 관심종목 표시

**Acceptance Scenarios**:

1. **Given** 로그인한 사용자 A, **When** 종목을 관심종목에 추가, **Then** A의 개인 관심종목에만 저장된다
2. **Given** 사용자 A가 3개 종목 등록, **When** 사용자 B가 로그인, **Then** B의 관심종목은 비어있다 (A와 독립)
3. **Given** 비로그인 상태, **When** 관심종목 추가 버튼 클릭, **Then** "로그인이 필요합니다" 안내와 로그인 버튼을 표시
4. **Given** 비로그인 상태, **When** 대시보드 접속, **Then** 관심종목 섹션에 "로그인하면 관심종목을 관리할 수 있습니다" 안내 표시

---

### User Story 3 - 개인별 텔레그램 알림 설정 (Priority: P2)

로그인한 사용자별로 텔레그램 알림 설정(봇 토큰, 채팅 ID)이 별도로 저장된다. 각 사용자는 자신의 관심종목에 대해서만 SELL 체크 및 실시간 전환 알림을 받는다.

**Why this priority**: 알림이 개인화되지 않으면 모든 사용자가 동일 알림을 받게 됨. 관심종목과 연동 필수.

**Independent Test**: 사용자 A의 텔레그램 설정 → A의 관심종목 SELL 체크 알림이 A에게만 발송 → B는 B의 설정으로 별도 수신

**Acceptance Scenarios**:

1. **Given** 로그인한 사용자, **When** 설정 페이지에서 텔레그램 토큰/채팅ID 입력, **Then** 해당 사용자 계정에 저장
2. **Given** 사용자 A/B 각각 텔레그램 설정, **When** SELL 체크 시간, **Then** A는 A의 관심종목, B는 B의 관심종목 기준으로 각각 알림 수신

---

### User Story 4 - 개인별 포지션 가이드 상태 (Priority: P2)

포지션 가이드의 "매수 완료" 체크 상태가 로그인한 사용자별로 서버에 저장된다. 현재는 localStorage에 저장되어 기기 간 동기화가 안 되는 문제를 해결한다.

**Why this priority**: 포지션 가이드의 체크 상태가 기기/브라우저 간 동기화되어야 실용적.

**Independent Test**: 사용자 A가 PC에서 1차 매수 완료 체크 → 모바일에서 로그인 시 동일한 체크 상태 유지

**Acceptance Scenarios**:

1. **Given** 로그인한 사용자, **When** 포지션 가이드에서 "매수 완료" 체크, **Then** 서버에 저장되어 다른 기기에서도 동일 상태
2. **Given** 비로그인 상태, **When** 포지션 가이드 사용, **Then** 기존처럼 localStorage에 저장 (로그인 안내 표시)

---

### User Story 5 - 기존 데이터 마이그레이션 (Priority: P3)

현재 시스템의 기존 관심종목, 텔레그램 설정이 첫 번째 관리자 계정으로 자동 마이그레이션된다.

**Why this priority**: 기존 데이터 손실 방지. 현재 사용 중인 설정이 사라지지 않아야 함.

**Independent Test**: 업데이트 후 기존 관심종목과 텔레그램 설정이 관리자 계정에 연결되어 정상 동작

**Acceptance Scenarios**:

1. **Given** 기존 watchlist에 5개 종목, **When** 시스템 업데이트 후 관리자 로그인, **Then** 5개 종목이 관리자 계정에 연결됨
2. **Given** 기존 텔레그램 설정 존재, **When** 시스템 업데이트, **Then** 관리자 계정의 텔레그램 설정으로 마이그레이션

---

### Edge Cases

- 구글 로그인 실패 시 (네트워크 오류, 구글 서비스 장애) 에러 메시지 표시 후 비로그인 상태 유지
- 세션 만료(30일) 시 비로그인 상태로 전환 + 재로그인 안내 표시 (서버 세션이므로 자동 갱신 없음)
- 비로그인 사용자가 종목 상세화면 진입 시 차트/지표는 정상 표시, 관심종목 추가 버튼만 로그인 안내로 대체
- 동일 구글 계정으로 여러 탭/기기에서 동시 접속 시 마지막 저장이 우선 (낙관적 동시성)
- 사용자 계정 삭제 기능은 설정 페이지에서 제공 (GDPR 대응)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 구글 계정으로 로그인/로그아웃할 수 있어야 한다
- **FR-002**: 로그인 상태가 브라우저 세션 간 유지되어야 한다 (Supabase Auth JWT, localStorage 자동 관리)
- **FR-003**: 관심종목(watchlist)이 로그인한 사용자별로 독립 관리되어야 한다
- **FR-004**: 비로그인 사용자는 관심종목 추가/삭제가 불가하고 로그인 안내를 보여야 한다
- **FR-005**: 비로그인 사용자도 시장 지표, 전체 시장 스캔(차트 BUY, 추천종목, 투자과열), 환율, 종목 상세 차트를 이용할 수 있어야 한다
- **FR-006**: 텔레그램 알림 설정이 사용자별로 독립 저장되어야 한다
- **FR-007**: SELL 체크 알림 및 실시간 전환 알림이 각 사용자의 관심종목과 텔레그램 설정을 기준으로 발송되어야 한다
- **FR-008**: 포지션 가이드 체크 상태가 로그인 시 서버에 저장되어 기기 간 동기화되어야 한다
- **FR-009**: 기존 관심종목/텔레그램 설정이 시스템 업데이트 시 첫 관리자 계정으로 마이그레이션되어야 한다
- **FR-010**: 로그인 버튼은 PC에서는 상단 네비게이션 우측, 모바일에서는 설정 탭에 배치해야 한다

### Key Entities

- **사용자(User)**: Supabase Auth가 관리 (auth.users). 앱 DB에는 profile 테이블로 google_id, 이름, 프로필 사진 미러링
- **관심종목(Watchlist)**: 기존 구조 + user_id FK 추가. 사용자별 독립 관리
- **알림설정(AlertConfig)**: 사용자별 텔레그램 봇 토큰, 채팅 ID, 알림 활성화 여부
- **포지션 상태(PositionState)**: 사용자별 종목별 매수 완료 단계 기록

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 구글 로그인이 3초 이내에 완료된다
- **SC-002**: 비로그인 사용자의 시장 지표/스캔/환율 이용에 기존 대비 성능 저하가 없다
- **SC-003**: 로그인한 사용자가 다른 기기에서 접속 시 관심종목이 동일하게 표시된다
- **SC-004**: 각 사용자의 텔레그램 알림이 해당 사용자의 관심종목만 기준으로 발송된다
- **SC-005**: 기존 데이터가 업데이트 후 손실 없이 마이그레이션된다
- **SC-006**: 비로그인 사용자가 관심종목 추가 시도 시 로그인 안내가 즉시 표시된다

## Assumptions

- 구글 로그인만 지원 (카카오, 네이버 등 추가 인증은 향후 확장)
- DB는 Supabase(PostgreSQL)로 전환. Cloudflare(기존) + Mac Mini(FastAPI) + Supabase 구성으로 10만 명 대응 가능
- SQLAlchemy 2.0 async + asyncpg 드라이버로 교체 (aiosqlite 제거). ORM 레이어 유지로 코드 변경 최소화
- 기존 SQLite 데이터는 alembic 마이그레이션으로 Supabase로 이전
- BUY 신호 알림(전체 시장 스캔)은 사용자 무관 공통 발송 유지 (전종목 스캔 결과)
- SELL 체크/실시간 전환은 사용자별 관심종목 기준으로 개인화
- 한국투자증권 API 키는 시스템 레벨 설정으로 유지 (사용자별 KIS 키 불필요)
