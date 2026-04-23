# Research: Auth Session Stability (029)

## 1. 현재 코드베이스 상태 분석

### 로그아웃 분산 호출 위치 (3곳)

| 파일 | 라인 | 호출 방식 | 수정 방향 |
|------|------|----------|----------|
| `frontend/src/components/UserMenu.tsx` | 10 | `supabase.auth.signOut()` 직접 | `signOutWithReason('user_requested', 'UserMenu')` |
| `frontend/src/api/client.ts` | 266 | 토큰 갱신 실패 시 직접 | `signOutWithReason('token_refresh_failed', 'api_interceptor', url)` |
| `frontend/src/api/client.ts` | 275 | catch 블록 직접 | `signOutWithReason('network_error', 'api_interceptor', url)` |

### 사일런트 인증 실패 근본 원인 2가지

**원인 A — 페이지 새로고침 시 Race Condition**
- `authStore`는 `user`를 localStorage에 persist함 (`partialize: (state) => ({ user: state.user })`)
- `session`(토큰)은 persist 안 함 (Supabase가 자체 관리)
- 페이지 새로고침 시: `user`는 즉시 복구, `session`은 Supabase 비동기 초기화 후 복구
- `Scrap.tsx:570`의 `useEffect`: `if (user) load()` → `authLoading` 체크 없음 → 토큰 없이 요청 나감
- `Dashboard.tsx:38`: `enabled: !authLoading && !!user` → **이미 올바르게 처리됨 ✓**
- **결론**: Scrap.tsx만 수정 필요

**원인 B — 사용 중 토큰 조용한 만료**
- `client.ts` 401 인터셉터: 갱신 성공하면 재시도, 갱신 실패하면 `signOut()`
- 갱신 실패 시 `authStore.user`는 null로 초기화되므로 UI에서는 로그아웃으로 보임
- 하지만 로그가 없어 원인 파악 불가
- **결론**: `signOutWithReason`으로 로그 추가 + `SILENT_FAILURE` 이벤트 추가

### 백엔드 JWKS 캐시 문제

`backend/auth.py:13`: `_jwks_cache: Optional[dict] = None` — 모듈 레벨 변수, TTL 없음.
- 프로세스 재시작 전까지 절대 갱신 안 됨
- Supabase가 키를 rotate하면 기존 캐시로 검증 실패 → 유효 토큰이 401 반환
- **결론**: `_jwks_cache_time`을 추가하고 1시간 TTL 적용

---

## 2. 설계 결정

### Decision 1: 중앙 인증 서비스 위치

- **Decision**: `frontend/src/lib/authService.ts` 신규 파일
- **Rationale**: `lib/` 폴더는 이미 `supabase.ts`가 있는 유틸리티 레이어. `store/`는 상태 관리 전용이므로 side-effect 로직과 분리
- **Alternatives considered**: `store/authStore.ts` 내부에 메서드로 추가 → Zustand store에 side-effect 비즈니스 로직이 섞이므로 부적합

### Decision 2: 로그아웃 잠금 메커니즘

- **Decision**: 모듈 레벨 `let _signingOut = false` 플래그
- **Rationale**: React state/ref로 관리 시 컴포넌트 생명주기에 의존함. 모듈 레벨 변수는 앱 전체에서 단일 인스턴스 보장
- **Alternatives considered**: Zustand에 `isSigningOut` 상태 추가 → 불필요한 리렌더 유발

### Decision 3: ReturnUrl 저장 위치

- **Decision**: `localStorage` key `'auth_return_url'`
- **Rationale**: sessionStorage는 탭 닫기 시 소멸. 로그아웃 후 재로그인 흐름은 탭을 닫지 않아도 가능. 이미 `authStore`가 localStorage persist 사용 중
- **Alternatives considered**: URL query parameter → 로그인 URL 노출 지저분함

### Decision 4: `[AUTH]` 로그 형식

```
[AUTH] {TYPE} | reason={reason} | source={source} | url={url} | ts={ISO}
```

- **Decision**: 파이프 구분자, key=value 형식
- **Rationale**: DevTools 콘솔 검색에서 `[AUTH]` prefix로 필터링 가능. `reason=` 키로 grep 가능
- **Alternatives considered**: JSON 객체 → 시각적으로 파악이 느림

### Decision 5: Scrap.tsx auth 게이팅 방식

- **Decision**: useEffect 의존성에 `authLoading` 추가하고 `if (user && !authLoading) load()` 조건 적용
- **Rationale**: Dashboard와 동일한 패턴으로 일관성 유지. React Query `enabled` 플래그는 Scrap.tsx가 useEffect 기반 수동 fetch를 사용하므로 직접 적용 불가
- **Alternatives considered**: React Query로 Scrap 데이터 fetching 전환 → 불필요한 대규모 리팩토링

### Decision 6: JWKS TTL

- **Decision**: `_jwks_cache_time: float = 0.0` + `TTL = 3600.0` 초 (1시간)
- **Rationale**: Supabase 키 rotation 주기보다 짧으면서, 매 요청마다 갱신하지 않는 균형점. 스펙 Assumptions에 1시간 명시됨
- **Alternatives considered**: 요청마다 갱신 → 불필요한 외부 요청 증가

---

## 3. 영향 범위 최종 확인

| 파일 | 변경 종류 | 이유 |
|------|----------|------|
| `frontend/src/lib/authService.ts` | 신규 | 중앙 로그아웃 서비스 |
| `frontend/src/api/client.ts` | 수정 | signOut 호출 → signOutWithReason + SILENT_FAILURE 로그 |
| `frontend/src/components/UserMenu.tsx` | 수정 | signOut → signOutWithReason |
| `frontend/src/pages/AuthCallback.tsx` | 수정 | ReturnUrl 복귀 처리 |
| `frontend/src/pages/Scrap.tsx` | 수정 | authLoading 게이팅 추가 |
| `backend/auth.py` | 수정 | JWKS TTL 캐시 |

**수정 불필요 (이미 올바름):**
- `frontend/src/components/AuthProvider.tsx` — `loading` 플래그 이미 정확히 관리됨
- `frontend/src/store/authStore.ts` — `loading` state 이미 존재, 추가 변경 불필요
- `frontend/src/pages/Dashboard.tsx` — `enabled: !authLoading && !!user` 이미 적용됨
