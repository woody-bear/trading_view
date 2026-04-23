# Data Model: Auth Session Stability

## Entities

### AuthEventType (열거형)

| 값 | 설명 |
|----|------|
| `SIGNED_OUT` | 로그아웃 완료 (reason 포함) |
| `SILENT_FAILURE` | 로그인 표시 유지 중 인증 실패 감지 |
| `TOKEN_REFRESHED` | 토큰 자동 갱신 성공 |
| `AUTO_RECOVERED` | 사일런트 실패 후 자동 복구 성공 |

### LogoutReason (열거형)

| 값 | 발생 위치 | 설명 |
|----|-----------|------|
| `user_requested` | UserMenu | 사용자 수동 로그아웃 |
| `token_refresh_failed` | api/client.ts 인터셉터 | 갱신 API 호출 실패 |
| `token_invalid` | api/client.ts 인터셉터 | 토큰 자체 손상 또는 서명 불일치 |
| `network_error` | api/client.ts catch 블록 | 네트워크 오류로 갱신 불가 |
| `session_expired` | authService.ts 복구 실패 | 세션 완전 만료 |

### AuthEvent (런타임 전용 — 저장소 없음)

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | `AuthEventType` | 이벤트 종류 |
| `reason` | `LogoutReason \| null` | SIGNED_OUT일 때만 필수 |
| `source` | `string` | 호출한 파일/컴포넌트명 |
| `url` | `string \| null` | 관련 API 요청 URL |
| `recovered` | `boolean \| null` | SILENT_FAILURE일 때만 유효 |
| `ts` | `string` | ISO 8601 타임스탬프 |

**저장 방식**: 콘솔 출력 전용 (`console.warn`). DB·localStorage에 저장하지 않음.

**로그 형식**:
```
[AUTH] SIGNED_OUT | reason=token_refresh_failed | source=api_interceptor | url=/api/watchlist | ts=2026-04-23T10:30:00.000Z
[AUTH] SILENT_FAILURE | source=scrap_query | recovered=true | ts=2026-04-23T10:30:00.000Z
[AUTH] TOKEN_REFRESHED | source=api_interceptor | ts=2026-04-23T10:30:00.000Z
```

### ReturnUrl (브라우저 저장소)

| 속성 | 값 |
|------|-----|
| 저장소 | `localStorage` |
| 키 | `'auth_return_url'` |
| 형식 | `string` (pathname + search + hash) |
| 유효 기간 | 로그인 콜백 처리 완료 시 삭제 |
| 예외 | 로그인 페이지 URL 자체는 저장 안 함 |

**저장 조건**: `reason !== 'user_requested'`일 때만 저장.

### JWKS Cache (백엔드 — 모듈 레벨 변수)

| 변수 | 타입 | 초기값 | 설명 |
|------|------|--------|------|
| `_jwks_cache` | `Optional[dict]` | `None` | 캐시된 JWKS 데이터 |
| `_jwks_cache_time` | `float` | `0.0` | 마지막 갱신 시각 (`time.time()`) |
| `_JWKS_TTL` | `float` | `3600.0` | TTL 상수 (1시간) |

**갱신 로직**: `time.time() - _jwks_cache_time > _JWKS_TTL`이면 재갱신.

## State Transitions

### 로그아웃 플로우

```
[컴포넌트/인터셉터]
       │
       ▼
signOutWithReason(reason, source, url?)
       │
  _signingOut == true? ──► 무시 (early return)
       │ false
  _signingOut = true
       │
  logAuthEvent(SIGNED_OUT, reason, source, url)
       │
  reason != 'user_requested'? ──► localStorage.setItem('auth_return_url', location.href)
       │
  supabase.auth.signOut()
       │
  authStore.clearUser()
       │
  _signingOut = false
       ▼
    [Done]
```

### 사일런트 실패 복구 플로우

```
[API 401 수신 — authStore.user != null]
       │
  refreshSession() 시도
       │
  성공? ──► logAuthEvent(TOKEN_REFRESHED) ──► 원 요청 재시도 ──► logAuthEvent(AUTO_RECOVERED)
       │ 실패
  logAuthEvent(SILENT_FAILURE, recovered=false)
       │
  signOutWithReason('session_expired', 'api_interceptor', url)
```

### 인증 초기화 후 쿼리 발사 (Scrap.tsx)

```
컴포넌트 마운트
       │
authLoading == true? ──► 스켈레톤 표시 (대기)
       │ false
  user != null? ──► load() 호출 ──► 데이터 표시
       │ null
  setLoading(false) ──► 로그인 유도 표시
```
