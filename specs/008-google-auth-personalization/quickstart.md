# Quickstart: 008-google-auth-personalization

## 사전 준비 (완료된 항목)

- [x] Supabase 프로젝트 생성 (`otldujrbygnkvzjvwqgh`)
- [x] PostgreSQL 마이그레이션 (기존 9개 테이블)
- [x] `.env` Supabase 키 설정
- [x] `backend/auth.py` JWT 검증 미들웨어
- [x] RLS 정책 적용
- [x] 위험 엔드포인트 인증 적용

## Supabase Google OAuth 활성화

1. Supabase 대시보드 → **Authentication → Providers → Google**
2. **Enable** 토글 ON
3. Client ID / Secret 입력 (`.env`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
4. Redirect URL 확인: `https://otldujrbygnkvzjvwqgh.supabase.co/auth/v1/callback`
5. **이 URL을 Google Cloud Console Authorized redirect URIs에 추가**

## 백엔드 개발 환경

```bash
cd backend && source .venv/bin/activate
uvicorn app:app --reload --port 8000
```

## 프론트엔드 개발 환경

```bash
cd frontend
pnpm install
# .env.local 생성
echo "VITE_SUPABASE_URL=https://otldujrbygnkvzjvwqgh.supabase.co" > .env.local
echo "VITE_SUPABASE_ANON_KEY=sb_publishable_D9E550IUYAnkm-apiQlFiA_8-Z5ViKG" >> .env.local
pnpm dev
```

## Supabase JS 클라이언트 설치

```bash
cd frontend && pnpm add @supabase/supabase-js
```

## 마이그레이션 실행 순서

```bash
# 1. 신규 테이블 생성
cd backend && alembic upgrade head

# 2. (Google Auth 구현 완료 후) 첫 admin 로그인
# 3. admin UUID 확인 후 데이터 마이그레이션 스크립트 실행
python scripts/migrate_sqlite_data.py --admin-uuid <UUID>
```

## 주요 파일 위치

| 파일 | 설명 |
|------|------|
| `backend/auth.py` | JWT 검증 Dependency |
| `backend/models.py` | SQLAlchemy 모델 (user_profiles 등 추가 필요) |
| `backend/routes/auth.py` | 신규: /api/auth/sync, /api/me |
| `backend/routes/position.py` | 신규: 포지션 상태 API |
| `frontend/src/lib/supabase.ts` | Supabase 클라이언트 초기화 |
| `frontend/src/store/authStore.ts` | Zustand auth 상태 |
| `frontend/src/components/AuthProvider.tsx` | onAuthStateChange 구독 |
