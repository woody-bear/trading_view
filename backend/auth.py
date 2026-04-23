"""Supabase JWT 검증 미들웨어."""
import json
import time
import urllib.request
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import get_settings

_bearer = HTTPBearer(auto_error=False)
_jwks_cache: Optional[dict] = None
_jwks_cache_time: float = 0.0
_JWKS_TTL: float = 3600.0  # Supabase 키 rotation 주기보다 짧게 유지


def _get_jwks() -> dict:
    global _jwks_cache, _jwks_cache_time
    if _jwks_cache is None or time.time() - _jwks_cache_time > _JWKS_TTL:
        settings = get_settings()
        url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        with urllib.request.urlopen(url, timeout=5) as r:
            _jwks_cache = json.load(r)
        _jwks_cache_time = time.time()
    return _jwks_cache


def _verify_token(token: str) -> dict:
    """JWT 검증 후 payload 반환. 실패 시 HTTPException."""
    try:
        jwks = _get_jwks()
        public_key = jwt.algorithms.ECAlgorithm.from_jwk(jwks["keys"][0])
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["ES256"],
            options={"verify_aud": False},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "토큰이 만료되었습니다")
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "유효하지 않은 토큰입니다")


async def get_current_user(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """로그인 필수 엔드포인트용 Dependency. user payload 반환."""
    if not cred:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "로그인이 필요합니다")
    import asyncio
    return await asyncio.to_thread(_verify_token, cred.credentials)


async def get_optional_user(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[dict]:
    """로그인 선택 엔드포인트용 Dependency. 비로그인 시 None 반환."""
    if not cred:
        return None
    import asyncio
    try:
        return await asyncio.to_thread(_verify_token, cred.credentials)
    except HTTPException:
        return None


def get_user_id(user: dict) -> str:
    """payload에서 user_id(sub) 추출."""
    return user.get("sub", "")
