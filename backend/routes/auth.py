import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user, get_user_id
from database import get_session as get_db
from models import UserProfile

router = APIRouter()


class SyncRequest(BaseModel):
    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserProfileResponse(BaseModel):
    id: str
    email: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/auth/sync", response_model=UserProfileResponse)
async def sync_user(
    body: SyncRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """로그인 후 user_profiles upsert."""
    user_id = uuid.UUID(get_user_id(user))

    result = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
    profile = result.scalar_one_or_none()

    if profile:
        profile.email = body.email
        if body.display_name is not None:
            profile.display_name = body.display_name
        if body.avatar_url is not None:
            profile.avatar_url = body.avatar_url
        profile.last_seen_at = datetime.utcnow()
    else:
        profile = UserProfile(
            id=user_id,
            email=body.email,
            display_name=body.display_name,
            avatar_url=body.avatar_url,
        )
        db.add(profile)

    await db.commit()
    await db.refresh(profile)
    return UserProfileResponse(
        id=str(profile.id),
        email=profile.email,
        display_name=profile.display_name,
        avatar_url=profile.avatar_url,
        created_at=profile.created_at,
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """현재 로그인 사용자 프로필 조회."""
    user_id = uuid.UUID(get_user_id(user))

    result = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "프로필이 없습니다. /api/auth/sync를 먼저 호출하세요.")

    return UserProfileResponse(
        id=str(profile.id),
        email=profile.email,
        display_name=profile.display_name,
        avatar_url=profile.avatar_url,
        created_at=profile.created_at,
    )
