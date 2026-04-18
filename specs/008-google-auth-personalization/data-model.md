# Data Model: 008-google-auth-personalization

## ERD 변화 요약

```
[auth.users] ──────────────────────────────────────┐
  (Supabase 관리)                                   │
       │ 1                                          │
       ├──< [user_profiles]   (신규)                │
       ├──< [user_alert_config] (신규)              │
       ├──< [user_position_state] (신규)            │
       └──< [watchlist]  ←── user_id FK 추가 (기존) │
                │                                   │
                └──< [current_signal] (변화 없음, watchlist FK로 간접 연결)
```

---

## 신규 테이블

### 1. `user_profiles`

Supabase `auth.users`의 공개 정보 미러. FastAPI에서 조회 편의를 위해 public 스키마에 저장.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `UUID PK` | auth.users.id와 동일 |
| `email` | `VARCHAR(255)` | 이메일 |
| `display_name` | `VARCHAR(100)` | 구글 표시 이름 |
| `avatar_url` | `TEXT` | 프로필 사진 URL |
| `created_at` | `TIMESTAMPTZ` | 최초 로그인 시각 |
| `last_seen_at` | `TIMESTAMPTZ` | 마지막 활동 시각 |

```python
class UserProfile(Base):
    __tablename__ = "user_profiles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(100))
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(default=func.now())
```

---

### 2. `user_alert_config`

사용자별 텔레그램 알림 설정.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `SERIAL PK` | |
| `user_id` | `UUID FK → auth.users` | UNIQUE (1인 1설정) |
| `telegram_bot_token` | `TEXT` | 암호화 저장 권장 |
| `telegram_chat_id` | `VARCHAR(50)` | |
| `is_active` | `BOOLEAN` | default true |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

```python
class UserAlertConfig(Base):
    __tablename__ = "user_alert_config"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True)
    telegram_bot_token: Mapped[Optional[str]] = mapped_column(Text)
    telegram_chat_id: Mapped[Optional[str]] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())
```

---

### 3. `user_position_state`

포지션 가이드 매수 완료 체크 상태. 기기 간 동기화용.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `SERIAL PK` | |
| `user_id` | `UUID FK → auth.users` | |
| `symbol` | `VARCHAR(20)` | |
| `market` | `VARCHAR(10)` | KR/US/CRYPTO |
| `completed_stages` | `JSONB` | `[1, 2]` 형태 (완료된 매수 단계) |
| `updated_at` | `TIMESTAMPTZ` | |

UNIQUE: `(user_id, symbol, market)`

```python
class UserPositionState(Base):
    __tablename__ = "user_position_state"
    __table_args__ = (UniqueConstraint("user_id", "symbol", "market"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    symbol: Mapped[str] = mapped_column(String(20))
    market: Mapped[str] = mapped_column(String(10))
    completed_stages: Mapped[list] = mapped_column(JSONB, default=[])
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())
```

---

## 기존 테이블 변경

### `watchlist` — user_id FK 추가

| 변경 | 내용 |
|------|------|
| 추가 컬럼 | `user_id UUID nullable → auth.users` |
| 마이그레이션 | admin 첫 로그인 후 스크립트로 기존 행에 user_id 일괄 설정 |
| 최종 상태 | NOT NULL 로 변경 (마이그레이션 완료 후) |

---

## Alembic 마이그레이션 계획

| 순서 | 파일명 | 내용 |
|------|--------|------|
| 1 | `009_add_user_profiles.py` | user_profiles 테이블 생성 |
| 2 | `010_add_user_alert_config.py` | user_alert_config 테이블 생성 |
| 3 | `011_add_user_position_state.py` | user_position_state 테이블 생성 |
| 4 | `012_watchlist_add_user_id.py` | watchlist.user_id nullable 추가 |
| 5 | (스크립트) `migrate_sqlite_data.py` | SQLite → Supabase 데이터 복사 + user_id 설정 |
| 6 | `013_watchlist_user_id_not_null.py` | watchlist.user_id NOT NULL 변경 |
