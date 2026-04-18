# Tasks: 구글 로그인 기반 개인화

**Branch**: `008-google-auth-personalization`
**Input**: `specs/008-google-auth-personalization/`
**Already Done**: auth.py(JWT검증), RLS정책, Supabase키, CORS, asyncpg, 위험엔드포인트 인증 적용

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 선행 의존 없음)
- **[Story]**: US1~US5 (spec.md 유저스토리 매핑)

---

## Phase 1: Setup (Supabase OAuth + 프론트 패키지)

**Purpose**: 외부 서비스 설정 및 프론트엔드 의존성 설치

- [ ] T001 Supabase 대시보드 Authentication → Providers → Google 활성화 후 Client ID/Secret 입력
- [ ] T002 Google Cloud Console에 Supabase 콜백 URL 추가: `https://otldujrbygnkvzjvwqgh.supabase.co/auth/v1/callback`
- [X] T003 [P] `frontend/`에서 `pnpm add @supabase/supabase-js` 실행 후 `package.json` 확인
- [X] T004 [P] `frontend/.env.local`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가

---

## Phase 2: Foundational (백엔드 스키마 + 프론트 클라이언트)

**Purpose**: 모든 유저스토리가 공통으로 의존하는 기반

**⚠️ CRITICAL**: 이 Phase 완료 전까지 유저스토리 구현 불가

- [X] T005 `backend/models.py`에 `UserProfile`, `UserAlertConfig`, `UserPositionState` 모델 추가
- [X] T006 alembic 마이그레이션 생성: `009_add_user_profiles.py` — `user_profiles` 테이블 생성 (id UUID PK FK→auth.users, email, display_name, avatar_url, created_at, last_seen_at)
- [X] T007 alembic 마이그레이션 생성: `010_add_user_alert_config.py` — `user_alert_config` 테이블 생성 (id SERIAL, user_id UUID UNIQUE FK→auth.users, telegram_bot_token, telegram_chat_id, is_active)
- [X] T008 alembic 마이그레이션 생성: `011_add_user_position_state.py` — `user_position_state` 테이블 생성 (id SERIAL, user_id UUID FK→auth.users, symbol, market, completed_stages JSONB, UNIQUE(user_id, symbol, market))
- [X] T009 alembic 마이그레이션 생성: `012_watchlist_add_user_id.py` — `watchlist` 테이블에 `user_id UUID nullable FK→auth.users` 컬럼 추가
- [X] T010 `backend/`에서 `alembic upgrade head` 실행하여 4개 마이그레이션 Supabase에 적용
- [X] T011 [P] `frontend/src/lib/supabase.ts` 생성 — `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` 초기화 및 export
- [X] T012 [P] `frontend/src/store/authStore.ts` 생성 — Zustand store (user, session, loading 상태 + setUser, setSession, logout 액션)

**Checkpoint**: DB 스키마 확장 완료 + Supabase 클라이언트 준비 → 유저스토리 구현 시작 가능

---

## Phase 3: US1 — 구글 로그인/로그아웃 (Priority: P1) 🎯 MVP

**Goal**: 구글 로그인 버튼 → 인증 → 프로필 표시 → 로그아웃 전체 흐름 동작

**Independent Test**: 로그인 버튼 클릭 → 구글 인증 → 이름/프로필사진 표시 → 로그아웃 → 비로그인 상태 복귀. 브라우저 닫고 열어도 로그인 유지.

- [X] T013 [US1] `backend/routes/auth.py` 신규 생성 — `POST /api/auth/sync` (Supabase JWT에서 user_id 추출, user_profiles upsert), `GET /api/me` (로그인 사용자 프로필 반환)
- [X] T014 [US1] `backend/routes/__init__.py`에 auth + position 라우터 등록 (`/api` prefix)
- [X] T015 [P] [US1] `frontend/src/components/AuthProvider.tsx` 생성 — `supabase.auth.onAuthStateChange` 구독, SIGNED_IN 시 `POST /api/auth/sync` 호출, Zustand store 동기화
- [X] T016 [P] [US1] `frontend/src/api/client.ts` 수정 — axios interceptor로 `session.access_token`을 `Authorization: Bearer` 헤더 자동 주입
- [X] T017 [US1] `frontend/src/components/LoginButton.tsx` 생성 — `supabase.auth.signInWithOAuth({ provider: 'google', redirectTo })` 호출 버튼
- [X] T018 [US1] `frontend/src/components/UserMenu.tsx` 생성 — 프로필 사진/이름 표시 + 로그아웃 메뉴 (`supabase.auth.signOut()`)
- [X] T019 [US1] `frontend/src/App.tsx` 수정 — PC 헤더 우측에 비로그인 시 LoginButton, 로그인 시 UserMenu 표시
- [X] T020 [US1] `frontend/src/pages/Settings.tsx` 수정 — 모바일 설정 탭 상단에 로그인/로그아웃 섹션 추가
- [X] T021 [US1] `frontend/src/App.tsx` 수정 — AuthProvider로 앱 전체 감싸기
- [X] T022 [US1] `frontend/src/pages/AuthCallback.tsx` 생성 — OAuth 리다이렉트 후 세션 처리 페이지 (`/auth/callback` 라우트)
- [X] T023 [US1] `frontend/src/App.tsx` 수정 — `/auth/callback` 라우트 추가

**Checkpoint**: 구글 로그인/로그아웃 완전 동작, 브라우저 재시작 시 세션 유지 확인

---

## Phase 4: US2 — 개인별 관심종목 관리 (Priority: P1)

**Goal**: 사용자별 독립 관심종목. A의 watchlist가 B에게 보이지 않음.

**Independent Test**: 사용자 A 로그인 → 종목 추가 → 로그아웃 → 사용자 B 로그인 → B watchlist 비어있음. 비로그인 → 추가 버튼 클릭 → 로그인 안내 표시.

- [X] T024 [US2] `backend/routes/watchlist.py` 수정 — `GET /api/watchlist`: `get_optional_user`로 user_id 추출 후 해당 user의 watchlist만 반환 (비로그인 시 빈 배열)
- [X] T025 [US2] `backend/routes/watchlist.py` 수정 — `POST /api/watchlist`: user_id를 watchlist 행에 저장 (`get_current_user` 이미 적용됨)
- [X] T026 [US2] `backend/routes/watchlist.py` 수정 — `DELETE /api/watchlist/{id}`: 본인 소유 watchlist인지 user_id로 검증 후 삭제
- [X] T027 [US2] `frontend/src/api/client.ts` 수정 — axios interceptor로 supabase session 토큰 자동 주입 (모든 API 요청에 적용)
- [X] T028 [US2] `frontend/src/pages/Dashboard.tsx` 수정 — 비로그인 시 관심종목 추가 클릭하면 토스트 안내 표시
- [X] T029 [US2] `frontend/src/pages/Dashboard.tsx` 수정 — useAuthStore 연동 완료

**Checkpoint**: 사용자별 독립 watchlist 동작 확인. 비로그인 접근 차단 및 안내 동작 확인.

---

## Phase 5: US3 — 개인별 텔레그램 알림 설정 (Priority: P2)

**Goal**: 사용자별 텔레그램 봇 설정 저장 + 각 사용자 관심종목 기준으로 알림 발송

**Independent Test**: 사용자 A 텔레그램 설정 저장 → A의 관심종목에서 SELL 조건 발생 → A 텔레그램으로만 수신

- [X] T030 [US3] `backend/routes/settings.py` 수정 — `GET /api/settings/telegram`: `.env` 대신 로그인 사용자의 `user_alert_config` 조회 반환
- [X] T031 [US3] `backend/routes/settings.py` 수정 — `PUT /api/settings/telegram`: `user_alert_config` upsert (기존 `.env` 파일 수정 로직 제거)
- [X] T032 [US3] `backend/routes/settings.py` 수정 — `POST /api/settings/telegram/test`: 로그인 사용자의 `user_alert_config`로 테스트 발송
- [X] T033 [US3] `backend/services/sell_signal_alert.py` 수정 — SELL 알림 발송 시 사용자별 `user_alert_config` 조회 후 각 사용자에게 개별 발송
- [X] T034 [US3] `frontend/src/pages/Settings.tsx` 수정 — 모바일 로그인 섹션 추가, 인증 인터셉터로 자동 토큰 주입

**Checkpoint**: 사용자별 독립 텔레그램 설정 저장/조회 동작. 알림이 각 사용자 관심종목 기준 발송 확인.

---

## Phase 6: US4 — 개인별 포지션 가이드 상태 (Priority: P2)

**Goal**: 매수 완료 체크 상태를 서버에 저장하여 기기 간 동기화

**Independent Test**: PC에서 1차 매수 완료 체크 → 모바일에서 로그인 → 동일 체크 상태 표시. 비로그인 → localStorage 동작 유지.

- [X] T035 [US4] `backend/routes/position.py` 신규 생성 — `GET /api/position/{symbol}?market=`: 로그인 사용자의 `user_position_state` 조회, `PUT /api/position/{symbol}`: `completed_stages` JSONB upsert
- [X] T036 [US4] `backend/routes/__init__.py` 수정 — position 라우터 등록
- [X] T037 [US4] `frontend/src/components/PositionGuide.tsx` 수정 — 로그인 상태: 마운트 시 `GET /api/position/{symbol}` 로드, 체크 변경 시 `PUT /api/position/{symbol}` 저장
- [X] T038 [US4] `frontend/src/components/PositionGuide.tsx` 수정 — 비로그인 상태: 기존 localStorage 동작 유지 + 로그인 동기화 안내 표시

**Checkpoint**: 로그인 시 체크 상태 서버 저장/복원 동작. 비로그인 시 localStorage 폴백 동작.

---

## Phase 7: US5 — 기존 데이터 마이그레이션 (Priority: P3)

**Goal**: SQLite 기존 데이터를 admin 계정으로 Supabase에 마이그레이션

**Independent Test**: 스크립트 실행 후 admin 로그인 → 기존 관심종목 목록 동일하게 표시 → 기존 텔레그램 설정 user_alert_config에 존재

- [X] T039 [US5] `backend/scripts/migrate_sqlite_data.py` 신규 생성 — aiosqlite로 로컬 SQLite 읽기 + asyncpg로 Supabase에 watchlist 행 복사, user_id를 admin UUID로 일괄 설정 (`--admin-uuid` 인자 수신)
- [X] T040 [US5] `backend/scripts/migrate_sqlite_data.py` 수정 — 기존 `.env`의 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`를 admin의 `user_alert_config`에 INSERT
- [X] T041 [US5] alembic 마이그레이션 생성: `013_watchlist_user_id_not_null.py` — 마이그레이션 완료 후 `watchlist.user_id` NOT NULL 제약 추가
- [ ] T042 [US5] admin Google 계정으로 첫 로그인 → UUID 확인 → `python backend/scripts/migrate_sqlite_data.py --admin-uuid <UUID>` 실행
- [ ] T043 [US5] `alembic upgrade head` 실행 (013 마이그레이션 — watchlist.user_id NOT NULL)

**Checkpoint**: admin 계정에 기존 watchlist + 텔레그램 설정 정상 마이그레이션 확인

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: 공통 UX 개선 및 엣지케이스 처리

- [X] T044 [P] `frontend/src/components/LoginPromptModal.tsx` 생성 — 재사용 가능한 "로그인이 필요합니다" 모달 컴포넌트
- [X] T045 [P] `frontend/src/lib/supabase.ts` 수정 — Google OAuth 실패 시 에러 상태를 authStore에 기록, 사용자에게 토스트 메시지 표시
- [X] T046 Supabase RLS 정책 추가 — `user_profiles`, `user_alert_config`, `user_position_state` 테이블에 `authenticated` 롤 본인 데이터만 접근 가능한 정책 SQL 작성 및 적용
- [X] T047 [P] `backend/routes/settings.py` 정리 — 텔레그램 엔드포인트를 user_alert_config 기반으로 전환 완료
- [ ] T048 quickstart.md 기반 통합 테스트 — 로그인→관심종목→텔레그램→포지션→로그아웃 전체 흐름 수동 검증

---

## Dependencies & Execution Order

### Phase 의존성

- **Phase 1 (Setup)**: 즉시 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 → **모든 US 차단**
- **Phase 3 (US1)**: Phase 2 완료 후 시작
- **Phase 4 (US2)**: Phase 2 완료 후 시작 (US1과 병렬 가능)
- **Phase 5 (US3)**: Phase 2 완료 후 시작, US1 로그인 동작 전제
- **Phase 6 (US4)**: Phase 2 완료 후 시작, US1 로그인 동작 전제
- **Phase 7 (US5)**: Phase 3, 4 완료 후 (watchlist user_id 구현 완료 시점)
- **Phase 8 (Polish)**: 모든 US 완료 후

### 유저스토리 의존성

- **US1**: Phase 2 완료 후 독립 구현 가능 → MVP
- **US2**: Phase 2 완료 후 독립 구현 가능 (US1과 병렬)
- **US3**: US1 Auth 흐름 완료 후 구현 권장
- **US4**: US1 Auth 흐름 완료 후 구현 권장
- **US5**: US1 + US2 완료 후 실행 (watchlist user_id 적용 후)

### 병렬 실행 예시 (Phase 2)

```
동시 실행 가능:
- T005 모델 추가
- T011 supabase.ts 생성
- T012 authStore.ts 생성

순차 실행 필요:
- T005 완료 → T006~T009 마이그레이션 생성 → T010 alembic upgrade head
```

### 병렬 실행 예시 (Phase 3, US1)

```
동시 실행 가능:
- T013 backend auth.py
- T015 AuthProvider.tsx
- T016 useAuthenticatedFetch.ts
- T017 LoginButton.tsx
- T018 UserMenu.tsx
```

---

## Implementation Strategy

### MVP (US1 + US2만으로 핵심 가치 달성)

1. Phase 1: Setup (T001~T004)
2. Phase 2: Foundational (T005~T012)
3. Phase 3: US1 로그인 (T013~T023)
4. Phase 4: US2 관심종목 (T024~T029)
5. **STOP & VALIDATE**: 사용자별 관심종목 독립 동작 확인

### Incremental Delivery

1. Setup + Foundational → DB 준비 완료
2. US1 → 로그인 동작 (데모 가능)
3. US2 → 관심종목 개인화 (핵심 기능 완성)
4. US3 + US4 → 알림/포지션 개인화
5. US5 → 기존 데이터 보존

---

## 총 태스크 수

| Phase | 태스크 수 | 비고 |
|-------|----------|------|
| Phase 1 Setup | 4 | 외부 서비스 설정 |
| Phase 2 Foundational | 8 | DB 스키마 + 클라이언트 |
| Phase 3 US1 | 11 | 로그인/로그아웃 UI |
| Phase 4 US2 | 6 | 관심종목 개인화 |
| Phase 5 US3 | 5 | 텔레그램 개인화 |
| Phase 6 US4 | 4 | 포지션 상태 동기화 |
| Phase 7 US5 | 5 | 마이그레이션 |
| Phase 8 Polish | 5 | 공통 UX + 정리 |
| **합계** | **48** | |

병렬 실행 가능 태스크: 16개 ([P] 표시)
