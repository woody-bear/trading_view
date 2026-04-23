# Feature Specification: Auth Session Stability & Centralized Management

**Feature Branch**: `029-auth-session-stability`  
**Created**: 2026-04-23  
**Status**: Draft  
**Input**: 사이트 이용중에 로그아웃이 풀리는 현상이 있어 로그인 로그아웃을 한곳에서 관리해서 문제가 발생하는 지점을 빠르게 확인해서 로그인 로그아웃 관리할수 있도록 최적화

---

## Background

현재 로그아웃은 세 곳에서 분산 발생한다.

| 위치 | 트리거 조건 |
|------|------------|
| `UserMenu.tsx` | 사용자 수동 로그아웃 버튼 |
| `client.ts` (401 인터셉터) | 토큰 갱신 실패 시 `signOut()` |
| `client.ts` (catch 블록) | 갱신 중 예외 발생 시 `signOut()` |

이로 인해 의도치 않은 로그아웃이 발생해도 어느 경로에서 발생했는지 추적이 불가능하다.  
또한 일시적 네트워크 오류, JWKS 캐시 문제, 요청 인터셉터의 2초 타임아웃 만료 등이  
로그아웃의 원인이 될 수 있으나 현재 로그가 전혀 없다.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 로그아웃 원인 즉시 확인 (Priority: P1)

개발자가 "사용자가 로그아웃됐다"는 제보를 받았을 때,  
브라우저 콘솔에서 로그아웃 발생 시각·원인·경로를 30초 이내에 파악할 수 있다.

**Why this priority**: 현재 문제의 핵심. 원인을 모르면 어떤 수정도 검증 불가.

**Independent Test**: 로그아웃이 발생하면 콘솔에 `[AUTH] SIGNED_OUT | reason: token_refresh_failed | source: api_interceptor | url: /api/signals` 형태 로그가 출력된다.

**Acceptance Scenarios**:

1. **Given** 사용자가 로그인된 상태로 사용 중, **When** 토큰 만료 후 갱신 시도가 실패하면, **Then** 콘솔에 reason=`token_refresh_failed`, source=`api_interceptor`, 요청 URL이 포함된 로그가 기록된다.
2. **Given** 사용자가 직접 로그아웃 버튼 클릭, **When** signOut 호출, **Then** 로그에 reason=`user_requested`, source=`UserMenu`가 기록된다.
3. **Given** 일시적 네트워크 오류로 401이 반환됨, **When** 재시도 후 성공, **Then** 로그아웃 이벤트는 기록되지 않는다.

---

### User Story 2 — 모든 로그아웃이 단일 함수를 통해 실행 (Priority: P1)

코드베이스 전체에서 `supabase.auth.signOut()`을 직접 호출하는 곳이 없고,  
반드시 중앙 함수(`signOutWithReason(reason, source)`)를 통해서만 로그아웃이 발생한다.

**Why this priority**: 분산된 signOut 호출을 하나로 모아야 로그 추적이 가능해지고, 향후 로그아웃 전 cleanup 로직(캐시 초기화, SSE 연결 해제 등)을 한 곳에서 제어할 수 있다.

**Independent Test**: `grep -r "supabase.auth.signOut" frontend/src`의 결과가 중앙 함수 정의 1곳만 반환된다.

**Acceptance Scenarios**:

1. **Given** 새 중앙 함수 도입, **When** 기존 직접 호출 3곳을 모두 교체, **Then** `supabase.auth.signOut()` 직접 호출이 코드베이스에 1곳(중앙 함수 내부)만 존재한다.
2. **Given** 중앙 함수 호출 시, **When** reason과 source가 전달되면, **Then** 로그 기록 후 signOut을 실행하고 authStore를 초기화한다.
3. **Given** 중앙 함수가 짧은 시간 안에 중복 호출될 때, **When** 이미 진행 중인 signOut이 있으면, **Then** 두 번째 호출은 무시된다.

---

### User Story 3 — 일시적 오류로 인한 강제 로그아웃 방지 (Priority: P2)

네트워크 불안정 또는 인터셉터 타임아웃(2초)으로 인해  
실제로는 유효한 세션인데 로그아웃되는 현상을 차단한다.

**Why this priority**: 원인 추적(P1)으로 이 케이스임을 확인한 후 수정할 수 있으므로 P2.

**Independent Test**: API 요청 중 토큰 헤더 누락(인터셉터 타임아웃)이 발생해도 세션이 살아있으면 다음 요청에서 정상 헤더가 주입된다.

**Acceptance Scenarios**:

1. **Given** 인터셉터 `getSession()` 호출이 타임아웃 초과로 토큰 없이 요청이 나가 401 수신, **When** 세션이 실제로 유효한 경우, **Then** 즉시 signOut하지 않고 세션 재확인 후 재시도한다.
2. **Given** 토큰 갱신 요청이 일시적 네트워크 오류로 실패, **When** 1회 재시도 후 성공, **Then** 로그아웃되지 않는다.
3. **Given** 백엔드 JWKS 캐시가 만료(프로세스 재시작 전까지 갱신 안 됨)되어 유효 토큰을 거부, **When** JWKS 자동 갱신 후 재검증, **Then** 클라이언트 세션이 유지된다.

---

### User Story 4 — 재로그인 후 원래 페이지 복귀 (Priority: P3)

의도치 않은 로그아웃 후 재로그인 시, 로그아웃 직전에 보던 페이지로 자동 이동한다.

**Why this priority**: 로그아웃 자체를 막지 못한 경우에도 UX 충격을 최소화하는 안전망.

**Independent Test**: 종목 상세 페이지에서 세션 만료로 로그아웃 → 재로그인 → 동일 페이지로 자동 복귀.

**Acceptance Scenarios**:

1. **Given** 비자발적 로그아웃(reason ≠ `user_requested`) 발생, **When** 로그아웃 처리, **Then** 현재 페이지 URL이 저장된다.
2. **Given** 저장된 복귀 URL이 있음, **When** 로그인 콜백 처리 완료, **Then** 저장된 URL로 이동하고 저장값은 삭제된다.
3. **Given** 수동 로그아웃(reason=`user_requested`), **When** 재로그인, **Then** 복귀 URL 없이 기본 홈으로 이동한다.

---

### Edge Cases

- 로그아웃이 짧은 시간 안에 중복 호출되어도 `signOut()`은 1회만 실행된다.
- 이미 로그아웃된 상태에서 중앙 함수가 호출되면 오류 없이 종료된다.
- 비인증 엔드포인트(`/health`, `/scan/full/latest` 등)의 401 응답은 로그아웃을 유발하지 않는다.
- 복귀 URL이 로그인 페이지 자체인 경우 무한 루프 방지를 위해 홈으로 이동한다.
- JWKS 갱신 중 기존 캐시로 1회 더 시도하고 그 후에 갱신된 키로 재시도한다.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 `signOutWithReason(reason, source)` 단일 함수를 통해서만 로그아웃을 수행해야 한다.
- **FR-002**: 모든 로그아웃 이벤트는 발생 시각, reason, source, 관련 URL을 콘솔에 구조화된 형태로 기록해야 한다.
- **FR-003**: reason 값은 `user_requested` | `token_refresh_failed` | `token_invalid` | `network_error` 중 하나로 분류되어야 한다.
- **FR-004**: 토큰 갱신 실패가 일시적 네트워크 오류인 경우와 실제 세션 만료인 경우를 구분하여 처리해야 한다.
- **FR-005**: 비자발적 로그아웃 발생 시 현재 페이지 URL을 저장하고, 재로그인 후 해당 페이지로 복귀해야 한다.
- **FR-006**: 비인증 API 경로 목록을 확장하여 해당 경로의 401 응답은 로그아웃을 유발하지 않아야 한다.
- **FR-007**: 백엔드 JWKS 캐시는 TTL 기반으로 자동 갱신되어야 한다 (현재: 프로세스 재시작 전까지 영구 캐시).
- **FR-008**: 로그아웃 중복 실행 방지를 위한 잠금 메커니즘이 있어야 한다.

### Key Entities

- **AuthEvent**: 로그아웃 이벤트 기록 (timestamp, reason, source, url)
- **LogoutReason**: `user_requested` | `token_refresh_failed` | `token_invalid` | `network_error`
- **ReturnUrl**: 비자발적 로그아웃 직전 URL (브라우저 저장소)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 로그아웃 발생 시 30초 이내에 원인과 호출 위치를 콘솔 로그로 특정할 수 있다.
- **SC-002**: 코드베이스에서 `supabase.auth.signOut()` 직접 호출이 중앙 함수 내부 1곳만 존재한다.
- **SC-003**: 일시적 네트워크 오류(단절 후 5초 내 복구)로 인한 의도치 않은 로그아웃이 0건이 된다.
- **SC-004**: 비자발적 로그아웃 후 재로그인 시 이전 페이지 복귀 성공률 100%.
- **SC-005**: JWKS 캐시 만료로 인한 백엔드 토큰 거부 오류가 발생하지 않는다.

---

## Assumptions

- Supabase를 인증 제공자로 계속 사용한다.
- 별도 DB 테이블에 로그를 저장하지 않고 브라우저 콘솔 기반 로그로 충분하다 (개발자 진단 목적).
- 토큰 갱신 재시도는 최대 1회로 제한한다 (무한 루프 방지).
- 백엔드 JWKS 캐시 TTL은 1시간으로 설정한다.
- 로그인은 기존 Google OAuth2 방식을 유지한다.
