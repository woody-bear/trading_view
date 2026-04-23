# Interface Contract: authService.ts

**File**: `frontend/src/lib/authService.ts`  
**Type**: TypeScript module (side-effect 전용 서비스)

---

## Public API

### `signOutWithReason`

```typescript
function signOutWithReason(
  reason: LogoutReason,
  source: string,
  url?: string
): Promise<void>
```

**동작**:
1. `_signingOut == true`이면 즉시 반환 (중복 실행 방지)
2. `_signingOut = true` 설정
3. `[AUTH] SIGNED_OUT` 로그 출력
4. `reason != 'user_requested'`이면 `localStorage.setItem('auth_return_url', window.location.href)`
5. `supabase.auth.signOut()` 호출
6. `useAuthStore.getState().clearUser()` 호출
7. `_signingOut = false` 설정

**부작용**: 콘솔 출력, localStorage 쓰기(조건부), Supabase 세션 삭제, Zustand store 초기화  
**에러 처리**: signOut 실패 시에도 `_signingOut = false` 보장 (finally 블록)

---

### `logAuthEvent`

```typescript
function logAuthEvent(event: AuthEvent): void
```

**동작**: `console.warn`으로 구조화된 `[AUTH]` 로그 출력

**출력 형식**:
```
[AUTH] {type} | reason={reason} | source={source} | url={url} | ts={ISO}
```

- `reason`, `url` 없을 경우 해당 필드 생략
- `recovered` 필드는 `SILENT_FAILURE`일 때만 포함

---

## Types

```typescript
type AuthEventType = 'SIGNED_OUT' | 'SILENT_FAILURE' | 'TOKEN_REFRESHED' | 'AUTO_RECOVERED'

type LogoutReason =
  | 'user_requested'
  | 'token_refresh_failed'
  | 'token_invalid'
  | 'network_error'
  | 'session_expired'

interface AuthEvent {
  type: AuthEventType
  reason?: LogoutReason
  source: string
  url?: string
  recovered?: boolean
  ts: string  // new Date().toISOString()
}
```

---

## Module-level State (비공개)

```typescript
let _signingOut = false
```

**목적**: 중복 로그아웃 방지  
**초기화 시점**: 모듈 로드 시  
**reset 시점**: `signOutWithReason` 완료(성공/실패 모두)

---

## 사용 예시

```typescript
// UserMenu.tsx
import { signOutWithReason } from '@/lib/authService'
await signOutWithReason('user_requested', 'UserMenu')

// api/client.ts — 토큰 갱신 실패
import { signOutWithReason, logAuthEvent } from '@/lib/authService'
signOutWithReason('token_refresh_failed', 'api_interceptor', originalRequest.url)

// api/client.ts — 사일런트 실패 로그
logAuthEvent({
  type: 'SILENT_FAILURE',
  source: 'api_interceptor',
  url: originalRequest.url,
  recovered: false,
  ts: new Date().toISOString()
})
```

---

## 제약 조건

- `supabase.auth.signOut()` 직접 호출은 이 파일 내부에서만 허용
- `logAuthEvent`는 `console.warn` 전용 — DB/서버 전송 없음
- `ReturnUrl`에 `/login` 또는 `/auth` 경로가 포함된 경우 저장하지 않음 (무한 루프 방지)
