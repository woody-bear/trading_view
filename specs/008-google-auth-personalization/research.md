# Research: 008-google-auth-personalization

## 1. Supabase Auth + React Google OAuth 플로우

**Decision:** `signInWithOAuth({ provider: 'google' })` + `onAuthStateChange` 리스너
**Rationale:** Supabase가 OAuth 리다이렉트, 코드 교환, 토큰 저장을 자동 처리. 브라우저 닫기/열기 시 localStorage에서 세션 자동 복원.
**Token Refresh:** 자동 (만료 ~5분 전 선제 갱신). `TOKEN_REFRESHED` 이벤트 수신만 하면 됨.

```typescript
// 로그인
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: 'https://www.asst.kr/auth/callback' }
})

// 상태 감지
supabase.auth.onAuthStateChange((event, session) => {
  // SIGNED_IN | SIGNED_OUT | TOKEN_REFRESHED
  store.setUser(session?.user ?? null)
})
```

## 2. FastAPI JWT 검증 (ES256/JWKS)

**Decision:** JWKS 엔드포인트에서 공개키 자동 취득 → PyJWT로 ES256 검증
**Rationale:** Supabase 신규 키 타입이 ECC P-256 (ES256). 공개키 기반이므로 시크릿 공유 불필요.
**Already implemented:** `backend/auth.py` (JWKS 캐시 + `get_current_user` / `get_optional_user`)

```python
# JWT에서 user_id 추출
payload = jwt.decode(token, public_key, algorithms=["ES256"])
user_id = payload["sub"]  # Supabase auth.users UUID
```

## 3. Zustand Auth Store 패턴

**Decision:** Zustand + persist 미들웨어, `onAuthStateChange`로 Supabase 세션 동기화
**Rationale:** 기존 프로젝트가 Zustand 사용 중. persist로 새로고침 시 로그인 상태 유지.

```typescript
interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
}
```

## 4. @supabase/supabase-js → FastAPI 토큰 전달

**Decision:** `session.access_token` → `Authorization: Bearer {token}` 헤더
**Rationale:** OAuth 2.0 표준 Bearer 패턴. axios interceptor 또는 fetch wrapper로 자동 주입.

```typescript
const apiClient = axios.create({ baseURL: '/api' })
apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) config.headers.Authorization = `Bearer ${session.access_token}`
  return config
})
```

## 5. Alembic PostgreSQL UUID FK 패턴

**Decision:** `UUID(as_uuid=True)` 타입 + cross-schema FK는 raw SQL로
**Rationale:** `op.create_foreign_key()`가 cross-schema(auth.users)에서 제한적. raw `op.execute()` 사용.

```python
# watchlist에 user_id 추가
op.add_column('watchlist', sa.Column('user_id', UUID(as_uuid=True), nullable=True))
op.execute("""
    ALTER TABLE watchlist
    ADD CONSTRAINT fk_watchlist_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
""")
```

## 6. SQLite → PostgreSQL 마이그레이션 전략

**Decision:** admin 첫 로그인 후 Python 스크립트로 일괄 복사
**Rationale:** admin UUID가 확정된 시점에 watchlist.user_id를 일괄 설정. aiosqlite + asyncpg 조합.

```python
# 스크립트 흐름
sqlite_rows = await sqlite_conn.fetch("SELECT * FROM watchlist")
for row in sqlite_rows:
    await pg_conn.execute(
        "INSERT INTO watchlist (..., user_id) VALUES (..., $1)",
        admin_uuid
    )
```
