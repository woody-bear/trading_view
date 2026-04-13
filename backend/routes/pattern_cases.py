"""BUY 우수 사례 스크랩 API — CRUD."""

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from database import async_session
from models import PatternCase

router = APIRouter(prefix="/pattern-cases", tags=["pattern-cases"])


# ── 사용자 인증 헬퍼 ──────────────────────────────────────────────────────────

def _extract_user_id(authorization: Optional[str]) -> Optional[uuid.UUID]:
    """Authorization 헤더에서 user_id 추출 (Supabase JWT sub 클레임)."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        import base64
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload_padded = parts[1] + "=" * (4 - len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_padded))
        sub = payload.get("sub")
        return uuid.UUID(sub) if sub else None
    except Exception:
        return None


# ── Schemas ──────────────────────────────────────────────────────────────────

class PatternCaseCreate(BaseModel):
    title: str
    symbol: str
    stock_name: str
    market: str
    market_type: Optional[str] = None
    pattern_type: str = "custom"
    signal_date: str
    entry_price: Optional[float] = None
    profit_krw: Optional[float] = None
    result_pct: Optional[float] = None
    hold_days: Optional[int] = None
    rsi: Optional[float] = None
    bb_pct_b: Optional[float] = None
    bb_width: Optional[float] = None
    macd_hist: Optional[float] = None
    volume_ratio: Optional[float] = None
    ema_alignment: Optional[str] = None
    squeeze_level: Optional[int] = None
    conditions_met: Optional[int] = None
    tags: Optional[list[str]] = None
    notes: Optional[str] = None
    source: str = "manual"


class PatternCaseUpdate(BaseModel):
    title: Optional[str] = None
    profit_krw: Optional[float] = None
    result_pct: Optional[float] = None
    hold_days: Optional[int] = None
    tags: Optional[list[str]] = None
    notes: Optional[str] = None
    pattern_type: Optional[str] = None


def _to_dict(case: PatternCase) -> dict:
    tags = []
    if case.tags:
        try:
            tags = json.loads(case.tags)
        except Exception:
            tags = [t.strip() for t in case.tags.split(",") if t.strip()]
    return {
        "id": case.id,
        "title": case.title,
        "symbol": case.symbol,
        "stock_name": case.stock_name,
        "market": case.market,
        "market_type": case.market_type,
        "pattern_type": case.pattern_type,
        "signal_date": case.signal_date,
        "entry_price": case.entry_price,
        "profit_krw": case.profit_krw,
        "result_pct": case.result_pct,
        "hold_days": case.hold_days,
        "rsi": case.rsi,
        "bb_pct_b": case.bb_pct_b,
        "bb_width": case.bb_width,
        "macd_hist": case.macd_hist,
        "volume_ratio": case.volume_ratio,
        "ema_alignment": case.ema_alignment,
        "squeeze_level": case.squeeze_level,
        "conditions_met": case.conditions_met,
        "tags": tags,
        "notes": case.notes,
        "source": case.source,
        "user_id": str(case.user_id) if case.user_id else None,
        "created_at": case.created_at.isoformat() if case.created_at else None,
        "updated_at": case.updated_at.isoformat() if case.updated_at else None,
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/check")
async def check_duplicate(
    symbol: str,
    signal_date: str,
    authorization: Optional[str] = Header(default=None),
):
    """동일 종목·날짜 중복 여부 확인."""
    user_id = _extract_user_id(authorization)
    async with async_session() as session:
        q = select(PatternCase).where(
            PatternCase.symbol == symbol,
            PatternCase.signal_date == signal_date,
        )
        if user_id:
            q = q.where(PatternCase.user_id == user_id)
        result = await session.execute(q)
        case = result.scalar_one_or_none()
    return {"exists": case is not None, "id": case.id if case else None}


@router.get("")
async def list_cases(
    pattern_type: Optional[str] = None,
    market: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    user_id = _extract_user_id(authorization)
    if not user_id:
        return []  # 비로그인 시 빈 목록 반환
    async with async_session() as session:
        q = select(PatternCase).where(PatternCase.user_id == user_id).order_by(PatternCase.signal_date.desc())
        if pattern_type:
            q = q.where(PatternCase.pattern_type == pattern_type)
        if market:
            q = q.where(PatternCase.market == market)
        result = await session.execute(q)
        cases = result.scalars().all()
    return [_to_dict(c) for c in cases]


@router.post("", status_code=201)
async def create_case(
    body: PatternCaseCreate,
    authorization: Optional[str] = Header(default=None),
):
    user_id = _extract_user_id(authorization)
    async with async_session() as session:
        # 중복 체크
        q = select(PatternCase).where(
            PatternCase.symbol == body.symbol,
            PatternCase.signal_date == body.signal_date,
        )
        if user_id:
            q = q.where(PatternCase.user_id == user_id)
        existing = await session.execute(q)
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="이미 스크랩된 사례입니다")

        tags_json = json.dumps(body.tags, ensure_ascii=False) if body.tags else None
        case = PatternCase(
            title=body.title,
            symbol=body.symbol,
            stock_name=body.stock_name,
            market=body.market,
            market_type=body.market_type,
            pattern_type=body.pattern_type,
            signal_date=body.signal_date,
            entry_price=body.entry_price,
            profit_krw=body.profit_krw,
            result_pct=body.result_pct,
            hold_days=body.hold_days,
            rsi=body.rsi,
            bb_pct_b=body.bb_pct_b,
            bb_width=body.bb_width,
            macd_hist=body.macd_hist,
            volume_ratio=body.volume_ratio,
            ema_alignment=body.ema_alignment,
            squeeze_level=body.squeeze_level,
            conditions_met=body.conditions_met,
            tags=tags_json,
            notes=body.notes,
            source=body.source,
            user_id=user_id,
        )
        session.add(case)
        await session.commit()
        await session.refresh(case)
    return _to_dict(case)


@router.patch("/{case_id}")
async def update_case(
    case_id: int,
    body: PatternCaseUpdate,
    authorization: Optional[str] = Header(default=None),
):
    user_id = _extract_user_id(authorization)
    async with async_session() as session:
        result = await session.execute(select(PatternCase).where(PatternCase.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            raise HTTPException(status_code=404, detail="Not found")
        # 본인 사례만 수정 허용
        if user_id and case.user_id and case.user_id != user_id:
            raise HTTPException(status_code=403, detail="권한 없음")

        if body.title is not None:
            case.title = body.title
        if body.profit_krw is not None:
            case.profit_krw = body.profit_krw
        if body.result_pct is not None:
            case.result_pct = body.result_pct
        if body.hold_days is not None:
            case.hold_days = body.hold_days
        if body.tags is not None:
            case.tags = json.dumps(body.tags, ensure_ascii=False)
        if body.notes is not None:
            case.notes = body.notes
        if body.pattern_type is not None:
            case.pattern_type = body.pattern_type

        case.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(case)
    return _to_dict(case)


@router.delete("/{case_id}", status_code=204)
async def delete_case(
    case_id: int,
    authorization: Optional[str] = Header(default=None),
):
    user_id = _extract_user_id(authorization)
    async with async_session() as session:
        result = await session.execute(select(PatternCase).where(PatternCase.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            raise HTTPException(status_code=404, detail="Not found")
        if user_id and case.user_id and case.user_id != user_id:
            raise HTTPException(status_code=403, detail="권한 없음")
        await session.delete(case)
        await session.commit()
