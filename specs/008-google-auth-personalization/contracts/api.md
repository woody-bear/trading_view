# API Contracts: 008-google-auth-personalization

## 인증 흐름

```
[브라우저] supabase.auth.signInWithOAuth('google')
    → [Google OAuth] 인증
    → [Supabase Auth] JWT 발급 → localStorage 저장
    → [FastAPI] Authorization: Bearer {JWT} 헤더로 요청
    → [auth.py] JWKS 검증 → user_id(sub) 추출
```

---

## 신규 엔드포인트

### `POST /api/auth/sync`

로그인 후 user_profiles 테이블 upsert. 프론트엔드가 로그인 직후 호출.

**Auth:** 필수 (`get_current_user`)

**Request:**
```json
{
  "email": "user@gmail.com",
  "display_name": "홍길동",
  "avatar_url": "https://..."
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@gmail.com",
  "display_name": "홍길동",
  "avatar_url": "https://...",
  "created_at": "2026-03-29T00:00:00Z"
}
```

---

### `GET /api/me`

현재 로그인 사용자 프로필 조회.

**Auth:** 필수

**Response:**
```json
{
  "id": "uuid",
  "email": "user@gmail.com",
  "display_name": "홍길동",
  "avatar_url": "https://..."
}
```

---

### `GET /api/position/{symbol}`

포지션 가이드 상태 조회.

**Auth:** 필수
**Params:** `symbol`, `market` (query)

**Response:**
```json
{
  "symbol": "005930",
  "market": "KR",
  "completed_stages": [1, 2]
}
```

---

### `PUT /api/position/{symbol}`

포지션 가이드 상태 저장.

**Auth:** 필수

**Request:**
```json
{
  "market": "KR",
  "completed_stages": [1, 2, 3]
}
```

**Response:** `200 OK` + 저장된 상태

---

## 변경 엔드포인트

### `GET /api/watchlist`

- **변경 전:** 전체 watchlist 반환
- **변경 후:** 로그인 사용자의 watchlist만 반환. 비로그인 시 빈 배열.

### `GET /api/settings/telegram`

- **변경 전:** `.env` 파일에서 읽음 (전역)
- **변경 후:** 로그인 사용자의 `user_alert_config`에서 읽음

### `PUT /api/settings/telegram`

- **변경 전:** `.env` 파일 직접 수정
- **변경 후:** 로그인 사용자의 `user_alert_config` upsert

---

## 프론트엔드 Auth 흐름

```
앱 시작
  → supabase.auth.onAuthStateChange() 구독
  → session 있음: useAuthStore.setUser(session.user)
  → POST /api/auth/sync (user_profiles upsert)
  → session 없음: useAuthStore.setUser(null)

로그인 버튼 클릭
  → supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: ... })
  → [Google 인증 후 리다이렉트]
  → onAuthStateChange SIGNED_IN 이벤트 수신
  → 위 흐름 반복

로그아웃
  → supabase.auth.signOut()
  → onAuthStateChange SIGNED_OUT 이벤트
  → useAuthStore.setUser(null)
```

---

## 비로그인 접근 정책

| 기능 | 비로그인 |
|------|---------|
| 시장 스캔, 차트 BUY | ✅ 허용 |
| 환율, 추천 종목 | ✅ 허용 |
| 종목 상세 차트/지표 | ✅ 허용 |
| 관심종목 조회 | 빈 배열 반환 |
| 관심종목 추가/삭제 | 401 → 프론트 로그인 안내 |
| 설정 조회/변경 | 401 |
| 알림 테스트 | 401 |
