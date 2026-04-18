# Implementation Plan: 구글 로그인 기반 개인화

**Branch**: `008-google-auth-personalization` | **Date**: 2026-03-29 | **Spec**: [spec.md](./spec.md)

## Summary

Supabase Auth 기반 Google OAuth 로그인 구현 + 관심종목/알림/포지션 상태 개인화. 기존 SQLite DB를 Supabase PostgreSQL로 전환 (완료)하고, 사용자별 데이터 분리를 위한 스키마 확장 및 프론트엔드 Auth 연동을 진행한다.

## Technical Context

**Language/Version**: Python 3.12 (backend) + TypeScript 5.x / React 18 (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0 async, asyncpg, PyJWT, @supabase/supabase-js v2, Zustand, Tailwind CSS
**Storage**: Supabase PostgreSQL (이미 전환 완료)
**Testing**: pytest + vitest
**Target Platform**: Mac Mini 홈서버 (Cloudflare + Supabase)
**Project Type**: web-service (FastAPI + React SPA)
**Performance Goals**: 로그인 완료 3초 이내 (SC-001)
**Constraints**: Supabase Free tier (500MB DB, 50k MAU)
**Scale/Scope**: 10만 명 registered, ~5,000 동시 접속 (Cloudflare CDN + Supabase)

## Constitution Check

Constitution이 미작성 상태. 프로젝트 기존 패턴 기준으로 게이트 점검:

| 게이트 | 상태 | 비고 |
|--------|------|------|
| 단일 포트 (8000) 유지 | ✅ | FastAPI + React SPA 구조 유지 |
| Docker 미사용 | ✅ | venv + Node.js |
| SQLite → Supabase 전환 | ✅ | 기존 결정사항 |
| 외부 Auth 서비스 도입 | ✅ 허용 | Supabase Auth (명세 확정) |

## Project Structure

```text
backend/
├── auth.py                    # ✅ 완료 (JWT 검증)
├── models.py                  # 수정: user_profiles, user_alert_config, user_position_state 추가
├── config.py                  # ✅ 완료 (Supabase 설정 추가)
├── routes/
│   ├── auth.py                # 신규: /api/auth/sync, /api/me
│   ├── position.py            # 신규: /api/position/{symbol}
│   ├── watchlist.py           # 수정: user_id 기반 필터링
│   └── settings.py            # 수정: user_alert_config 기반
├── services/
│   └── sell_signal_alert.py   # 수정: 사용자별 텔레그램 발송
├── alembic/versions/
│   ├── 009_add_user_profiles.py
│   ├── 010_add_user_alert_config.py
│   ├── 011_add_user_position_state.py
│   ├── 012_watchlist_add_user_id.py
│   └── 013_watchlist_user_id_not_null.py
└── scripts/
    └── migrate_sqlite_data.py  # 신규: SQLite → Supabase 마이그레이션

frontend/src/
├── lib/
│   └── supabase.ts            # 신규: Supabase 클라이언트
├── store/
│   └── authStore.ts           # 신규: Zustand auth 상태
├── components/
│   ├── AuthProvider.tsx        # 신규: onAuthStateChange 구독
│   ├── LoginButton.tsx         # 신규: Google 로그인 버튼
│   └── UserMenu.tsx            # 신규: 프로필 + 로그아웃
└── hooks/
    └── useAuthenticatedFetch.ts # 신규: Bearer 토큰 자동 주입
```

**Structure Decision**: 기존 backend/frontend 웹앱 구조 유지. 신규 파일 최소화.

## Implementation Phases

### Phase A — 백엔드 스키마 확장

1. SQLAlchemy 모델 추가 (user_profiles, user_alert_config, user_position_state)
2. Alembic 마이그레이션 4개 생성 및 실행
3. 신규 API 라우트 구현 (auth.py, position.py)
4. watchlist 라우트: user_id 기반 필터링 적용
5. settings 라우트: user_alert_config 기반으로 리팩토링
6. sell_signal_alert: 사용자별 텔레그램 설정으로 발송

### Phase B — 프론트엔드 Auth 연동

1. @supabase/supabase-js 설치 + supabase.ts 초기화
2. Zustand authStore 구현
3. AuthProvider 컴포넌트 (onAuthStateChange)
4. LoginButton (PC: 헤더 우측, Mobile: 설정 탭)
5. useAuthenticatedFetch hook (Bearer 자동 주입)
6. watchlist API 호출부 → 인증 헤더 적용
7. settings API 호출부 → 인증 헤더 적용

### Phase C — 마이그레이션 & 마무리

1. migrate_sqlite_data.py 스크립트 작성
2. Supabase Google OAuth 대시보드 활성화
3. Google Cloud Console Redirect URI 추가 (Supabase 콜백 URL)
4. admin 첫 로그인 → 마이그레이션 스크립트 실행
5. watchlist.user_id NOT NULL 마이그레이션
6. 비로그인 UX: 관심종목 추가 시 로그인 안내 모달

## Complexity Tracking

| 항목 | 이유 |
|------|------|
| Supabase Auth 도입 | Google OAuth 직접 구현 대비 보안/유지보수 우위 |
| cross-schema FK (auth.users) | Supabase 구조상 불가피, raw SQL로 처리 |
