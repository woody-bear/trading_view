# Tasks: Auth Session Stability & Centralized Management

**Input**: Design documents from `/specs/029-auth-session-stability/`  
**Branch**: `029-auth-session-stability`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일이라 병렬 실행 가능
- **[Story]**: 어떤 User Story에 해당하는지 (US1~US6)
- 파일 경로는 저장소 루트 기준

---

## Phase 1: Setup

신규 패키지·디렉토리 불필요. `frontend/src/lib/`은 `supabase.ts`로 이미 존재.  
Setup 태스크 없음 — Phase 2로 바로 진행.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `authService.ts` 신규 파일 — US1·US2·US4·US6 모두 의존. Phase 3 이후 작업 전에 반드시 완료.

**⚠️ CRITICAL**: T001 완료 전에 T002~T008 진행 불가.

- [x] T001 `frontend/src/lib/authService.ts` 파일 신규 생성 — 타입 정의 + `logAuthEvent` + `signOutWithReason` 전체 구현

**T001 구현 세부사항**:

```typescript
// 타입 정의
type AuthEventType = 'SIGNED_OUT' | 'SILENT_FAILURE' | 'TOKEN_REFRESHED' | 'AUTO_RECOVERED'
type LogoutReason = 'user_requested' | 'token_refresh_failed' | 'token_invalid' | 'network_error' | 'session_expired'
interface AuthEvent { type: AuthEventType; reason?: LogoutReason; source: string; url?: string; recovered?: boolean; ts: string }

// 모듈 레벨 잠금 (중복 로그아웃 방지)
let _signingOut = false

// logAuthEvent: [AUTH] 형식으로 console.warn 출력
// 필드 없으면 해당 키=값 쌍 생략
// 예: "[AUTH] SIGNED_OUT | reason=token_refresh_failed | source=api_interceptor | url=/api/... | ts=..."

// signOutWithReason: _signingOut 체크 → logAuthEvent(SIGNED_OUT) → supabase.auth.signOut()
//   → useAuthStore.getState().clear()  ← authStore 메서드명은 clear() (clearUser() 아님)
//   → finally 블록에서 _signingOut = false 보장
// ReturnUrl 저장은 T007에서 추가 (이 단계에선 미구현)
```

**Checkpoint**: `authService.ts` 완료 → Phase 3 병렬 진행 가능

---

## Phase 3: User Story 1 + 2 (P1) — [AUTH] 로그 + signOut 중앙화 🎯 MVP

**Goal**: 모든 로그아웃이 `signOutWithReason`을 통해 발생하고 `[AUTH]` 콘솔 로그가 기록된다.

**Independent Test**:  
```bash
grep -r "supabase.auth.signOut" frontend/src
# 결과: authService.ts 1줄만 반환되어야 함
```
DevTools 콘솔에서 로그아웃 버튼 클릭 시 `[AUTH] SIGNED_OUT | reason=user_requested | source=UserMenu` 출력 확인.

- [x] T002 [P] [US1] [US2] `frontend/src/components/UserMenu.tsx` — `supabase.auth.signOut()` → `signOutWithReason('user_requested', 'UserMenu')` 교체 (import 추가 포함)
- [x] T003 [P] [US1] [US2] `frontend/src/api/client.ts` — 인터셉터 내 `signOut` 2곳 교체

**T003 구현 세부사항**:
```typescript
// line 266: await supabase.auth.signOut()
// → await signOutWithReason('token_refresh_failed', 'api_interceptor', originalRequest.url)

// line 275: await supabase.auth.signOut()  
// → await signOutWithReason('network_error', 'api_interceptor', originalRequest.url)

// import 추가: import { signOutWithReason } from '@/lib/authService'
```

---

## Phase 4: User Story 3 (P1) — 새로고침 후 관심종목·스크랩 정상 표시

**Goal**: 페이지 새로고침 시 인증 초기화 완료 후에만 데이터 쿼리 발사.

**Independent Test**: 로그인 상태에서 `/scrap` 새로고침 → 스켈레톤 표시 후 데이터 로드. 빈 리스트 후 채워지는 현상 없음.

- [x] T004 [US3] `frontend/src/pages/Scrap.tsx` — line 547·570 수정하여 `authLoading` 게이팅 추가

**T004 구현 세부사항**:
```typescript
// line 547 수정:
// Before: const { user } = useAuthStore()
// After:  const { user, loading: authLoading } = useAuthStore()

// line 570 수정:
// Before: useEffect(() => { if (user) load(); else setLoading(false) }, [user?.id])
// After:  useEffect(() => {
//           if (authLoading) return  // 인증 초기화 중 — 스켈레톤 유지
//           if (user) load()
//           else setLoading(false)
//         }, [user?.id, authLoading])
```

---

## Phase 5: User Story 4 (P2) — 사일런트 인증 실패 자동 복구 + 로그

**Goal**: 401 수신 시 리프레시 성공/실패 여부를 `[AUTH]` 로그로 남기고, 성공 시 `AUTO_RECOVERED` 기록.

**Independent Test**: DevTools Network 탭에서 토큰 만료 후 401 → 자동 재시도 성공 → 콘솔에 `[AUTH] TOKEN_REFRESHED` 후 `[AUTH] AUTO_RECOVERED` 출력.

- [x] T005 [US4] `frontend/src/api/client.ts` — 401 인터셉터에 `logAuthEvent` 호출 4곳 추가

**T005 구현 세부사항**:
```typescript
// import 추가: import { logAuthEvent } from '@/lib/authService'
// import 추가: import { useAuthStore } from '../store/authStore'

// [A] 갱신 성공 직후 (line 271 직후):
logAuthEvent({ type: 'TOKEN_REFRESHED', source: 'api_interceptor', ts: new Date().toISOString() })

// [B] 원 요청 재시도 성공 후 (api(originalRequest) → .then 처리):
// Before: return api(originalRequest)
// After:
const retryResult = await api(originalRequest)
logAuthEvent({ type: 'AUTO_RECOVERED', source: 'api_interceptor', url: originalRequest.url, ts: new Date().toISOString() })
return retryResult

// [C] 갱신 실패 시 signOutWithReason 전 (line 265 앞):
if (useAuthStore.getState().user) {
  logAuthEvent({ type: 'SILENT_FAILURE', source: 'api_interceptor', url: originalRequest.url, recovered: false, ts: new Date().toISOString() })
}
// signOutWithReason('token_refresh_failed', ...) <- T003에서 이미 교체됨

// [D] catch 블록 signOutWithReason 전 (line 274 앞):
if (useAuthStore.getState().user) {
  logAuthEvent({ type: 'SILENT_FAILURE', source: 'api_interceptor', url: originalRequest.url, recovered: false, ts: new Date().toISOString() })
}
// signOutWithReason('network_error', ...) <- T003에서 이미 교체됨
```

---

## Phase 6: User Story 5 (P2) — JWKS TTL 캐시

**Goal**: 백엔드 JWKS 캐시가 1시간 TTL로 자동 갱신되어 키 rotation 후에도 토큰 검증 실패 없음.

**Independent Test**: `backend/auth.py`에서 `_jwks_cache_time` 변수 존재 + `_get_jwks()`가 TTL 기반 갱신 로직 포함.

- [x] T006 [US5] `backend/auth.py` — `_jwks_cache_time` 모듈 변수 추가 + `_get_jwks()` TTL 갱신 로직 수정

**T006 구현 세부사항**:
```python
# 상단에 import time 추가

# line 13 이후:
_jwks_cache: Optional[dict] = None
_jwks_cache_time: float = 0.0          # 추가
_JWKS_TTL: float = 3600.0              # 추가

# _get_jwks() 함수 수정:
def _get_jwks() -> dict:
    global _jwks_cache, _jwks_cache_time
    if _jwks_cache is None or time.time() - _jwks_cache_time > _JWKS_TTL:  # 수정
        settings = get_settings()
        url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        with urllib.request.urlopen(url, timeout=5) as r:
            _jwks_cache = json.load(r)
        _jwks_cache_time = time.time()  # 추가
    return _jwks_cache
```

---

## Phase 7: User Story 6 (P3) — 재로그인 후 원래 페이지 복귀

**Goal**: 비자발적 로그아웃 후 재로그인 시 직전 페이지로 자동 이동.

**Independent Test**: 종목 상세 페이지(`/SAMSUNG?market=KR`)에서 토큰 만료로 로그아웃 → 재로그인 → 동일 페이지 복귀.

- [x] T007 [P] [US6] `frontend/src/lib/authService.ts` — `signOutWithReason` 내 ReturnUrl 저장 로직 추가
- [x] T008 [P] [US6] `frontend/src/pages/AuthCallback.tsx` — ReturnUrl 복귀 처리 추가

**T007 구현 세부사항**:
```typescript
// signOutWithReason 내 supabase.auth.signOut() 호출 전에 추가:
if (reason !== 'user_requested') {
  const currentPath = window.location.href
  // /login, /auth 경로는 무한 루프 방지를 위해 저장 안 함
  if (!window.location.pathname.includes('/auth') && !window.location.pathname.includes('/login')) {
    localStorage.setItem('auth_return_url', currentPath)
  }
}
```

**T008 구현 세부사항**:
```typescript
// AuthCallback.tsx — 성공 시 navigate 처리 (line 33 교체):
// Before: navigate('/', { replace: true })
// After:
const returnUrl = localStorage.getItem('auth_return_url')
localStorage.removeItem('auth_return_url')
navigate(returnUrl ?? '/', { replace: true })

// 에러 경로 (line 23)는 ReturnUrl 미사용 — 그대로 유지
```

---

## Phase 8: Polish & Verification

- [x] T009 최종 검증 — 아래 항목 수동 확인 후 완료 처리

**검증 체크리스트**:

```bash
# 1. signOut 중앙화 확인 (결과: authService.ts 1줄만)
grep -r "supabase.auth.signOut" frontend/src

# 2. 백엔드 JWKS TTL 확인
grep "_jwks_cache_time\|_JWKS_TTL" backend/auth.py
```

```text
[ ] DevTools: 로그아웃 버튼 클릭 → [AUTH] SIGNED_OUT | reason=user_requested 출력
[ ] DevTools: /scrap 새로고침 → 스켈레톤 표시 후 데이터 로드 (빈 리스트 없음)
[ ] DevTools: 콘솔에 의도치 않은 [AUTH] 에러 없음
[ ] 백엔드 재시작: uvicorn app:app --reload --host 0.0.0.0 --port 8000
[ ] 프론트 재빌드: pnpm build && pnpm dev
```

---

## Dependency Graph

```
T001 (authService.ts 생성)
 ├── T002 [P] (UserMenu signOut 교체)
 ├── T003 [P] (client.ts signOut 교체)
 │    └── T005 (client.ts SILENT_FAILURE 로그 추가)
 └── T007 [P] (authService ReturnUrl 추가)

T004 (Scrap.tsx) — INDEPENDENT (T001 불필요)
T006 (backend/auth.py) — INDEPENDENT (T001 불필요)
T008 [P] (AuthCallback.tsx) — INDEPENDENT (T001 불필요, localStorage 키만 일치하면 됨)

T009 (최종 검증) — T001~T008 모두 완료 후
```

## Parallel Execution Examples

**MVP (US1+US2 — T001~T003)**:
```
T001 → [T002, T003 in parallel]
```

**전체 (T001~T008)**:
```
T001 → [T002, T003 in parallel] → T005
T001 → T007
T004 (독립)
T006 (독립)
T008 (독립)
→ T009
```

## Implementation Strategy

| 단계 | 태스크 | User Story | 효과 |
|------|--------|------------|------|
| MVP | T001~T003 | US1, US2 | [AUTH] 로그 + signOut 중앙화 (원인 추적 가능) |
| +P1 | T004 | US3 | 새로고침 후 스크랩 정상 표시 |
| +P2 | T005, T006 | US4, US5 | 사일런트 실패 로그 + JWKS TTL |
| +P3 | T007, T008 | US6 | 재로그인 후 페이지 복귀 |
| Done | T009 | — | 최종 검증 |

**Suggested MVP Scope**: T001 + T002 + T003 (US1+US2 완료) — 3개 태스크, 원인 추적이 즉시 가능해짐.
