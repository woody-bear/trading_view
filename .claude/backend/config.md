---
purpose: backend/config.py 환경 변수·pydantic-settings 모델 설명.
reader: Claude가 환경 변수를 추가·변경하거나 설정 우선순위를 확인할 때.
update-trigger: config.py에 설정 필드 추가·제거; .env 변수 추가; 설정 소스 우선순위 변경.
last-audit: 2026-04-18
---

# Backend — 설정 관리 (config.py)

> 소스: `backend/config.py`

## Settings 클래스

`pydantic-settings`의 `BaseSettings` 상속.  
`.env` 파일 자동 로드, `extra="ignore"` (불필요한 환경변수 무시).

```python
from config import get_settings
settings = get_settings()  # lru_cache로 싱글턴
```

## 환경변수 전체 목록

| 변수 | 타입 | 기본값 | 필수 |
|------|------|--------|------|
| `HOST` | str | 0.0.0.0 | - |
| `PORT` | int | 8000 | - |
| `DATABASE_URL` | str | SQLite (로컬) | 프로덕션 |
| `TELEGRAM_BOT_TOKEN` | str\|None | None | 선택 |
| `TELEGRAM_CHAT_ID` | str\|None | None | 선택 |
| `TV_WEBHOOK_SECRET` | str | "" | 선택 |
| `BINANCE_API_KEY` | str\|None | None | 선택 |
| `BINANCE_API_SECRET` | str\|None | None | 선택 |
| `KIS_APP_KEY` | str\|None | None | 선택 |
| `KIS_APP_SECRET` | str\|None | None | 선택 |
| `KIS_ACCOUNT_NO` | str\|None | None | 선택 |
| `KIS_PAPER_TRADING` | bool | True | - |
| `SUPABASE_URL` | str | "" | 프로덕션 |
| `SUPABASE_ANON_KEY` | str | "" | 프로덕션 |
| `SUPABASE_SERVICE_ROLE_KEY` | str | "" | 프로덕션 |
| `ALERT_COOLDOWN_MINUTES` | int | 30 | - |
| `MIN_SIGNAL_GRADE` | str | "WEAK" | - |
| `SYSTEM_ERROR_ALERT` | bool | True | - |

## 편의 프로퍼티

```python
settings.telegram_configured  # bool — TELEGRAM_BOT_TOKEN + CHAT_ID 둘 다 있으면 True
settings.kis_configured        # bool — KIS_APP_KEY + APP_SECRET 둘 다 있으면 True
```

## 설정 캐시 초기화

설정 변경 후 반드시 캐시를 클리어해야 새 값이 적용됨:

```python
from config import get_settings
get_settings.cache_clear()  # lru_cache 클리어
settings = get_settings()   # 재로드
```

텔레그램/KIS 저장 API에서 `.env` 파일 업데이트 후 이 패턴 사용.

## .env 파일 위치

```
trading_view/.env          ← 프로젝트 루트
trading_view/.env.example  ← 템플릿 (git 추적)
```

`config.py`의 `PROJECT_ROOT`는 `backend/config.py`에서 두 단계 위 (= `trading_view/`).
