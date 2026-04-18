---
purpose: backend/auth.py 인증 미들웨어·JWT 검증·사용자 식별 흐름 설명.
reader: Claude가 인증·권한 로직을 수정하거나 토큰 처리를 조정할 때.
update-trigger: auth.py 검증 로직 변경; Supabase 프로젝트/키 변경; 토큰 유효 기간·저장 방식 변경.
last-audit: 2026-04-18
---

# Backend — 인증 (auth.py)

> 소스: `backend/auth.py`

## 인증 방식

- **Supabase Google OAuth** → JWT(ES256) 발급
- 프론트엔드: `@supabase/supabase-js`로 로그인 → `access_token` 획득
- 백엔드: `Authorization: Bearer <token>` 헤더 검증

## JWT 검증 흐름

```
요청 수신
  → HTTPBearer 추출 (auto_error=False)
  → _get_jwks() — Supabase JWKS 엔드포인트 조회 (메모리 캐시)
  → jwt.decode(token, public_key, algorithms=["ES256"])
  → payload 반환 (sub=user_uuid 포함)
```

## Dependency 함수

```python
# 로그인 필수 — 토큰 없으면 401
async def get_current_user(cred) -> dict:
    ...

# 로그인 선택 — 토큰 없으면 None 반환
async def get_optional_user(cred) -> Optional[dict]:
    ...

# payload에서 user_id 추출
def get_user_id(user: dict) -> str:
    return user.get("sub", "")  # Supabase UUID (문자열)
```

## 라우터 사용 예시

```python
from auth import get_current_user, get_optional_user, get_user_id

# 필수 로그인
@router.get("/my-data")
async def my_data(user: dict = Depends(get_current_user)):
    uid = get_user_id(user)

# 선택 로그인 (공용 + 개인화 동시 지원)
@router.get("/public-data")
async def public_data(user: Optional[dict] = Depends(get_optional_user)):
    uid = get_user_id(user) if user else None
```

## JWKS 캐시

- `_jwks_cache` 전역 변수로 메모리 캐시
- 서버 재시작 시 초기화 (재조회)
- Supabase URL: `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`

## 에러 코드

| 상황 | HTTP 코드 | 메시지 |
|------|----------|--------|
| 토큰 없음 | 401 | "로그인이 필요합니다" |
| 토큰 만료 | 401 | "토큰이 만료되었습니다" |
| 토큰 무효 | 401 | "유효하지 않은 토큰입니다" |

## 프론트엔드 토큰 갱신 흐름

```
API 응답 401 수신
  → supabase.auth.refreshSession()
  → 성공: 새 토큰으로 원래 요청 재시도
  → 실패: supabase.auth.signOut() → 로그인 버튼 표시
```
(`frontend/src/api/client.ts` interceptors.response 참조)
