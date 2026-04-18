---
purpose: backend/schemas.py Pydantic 요청·응답 스키마 정의.
reader: Claude가 API 요청/응답 형식을 추가·수정할 때.
update-trigger: backend/schemas.py에 스키마 추가·필드 변경; validator 추가·변경.
last-audit: 2026-04-18
---

# Backend — 스키마 (Pydantic)

> 이 프로젝트의 Pydantic 스키마는 별도 `schemas.py`가 없고,  
> 각 라우터 파일 상단에 인라인으로 정의되어 있음.

## 패턴

```python
# routes/watchlist.py 예시
from pydantic import BaseModel

class WatchlistCreate(BaseModel):
    market: str
    symbol: str
    timeframe: str = "1h"
    data_source: str = "auto"

class WatchlistUpdate(BaseModel):
    timeframe: Optional[str] = None
    is_active: Optional[bool] = None

@router.post("/watchlist")
async def create(body: WatchlistCreate, session: AsyncSession = Depends(get_session)):
    ...
```

## 주요 라우터별 스키마

### watchlist.py
- `WatchlistCreate`: market, symbol, timeframe, data_source
- `WatchlistUpdate`: timeframe(opt), is_active(opt)

### settings.py
- `SensitivityUpdate`: level (strict/normal/sensitive)
- `TelegramConfig`: bot_token, chat_id
- `KISConfig`: app_key, app_secret, account_no, paper_trading

### market_scan.py
- 응답: `ScanSnapshotResponse` — snapshot 메타 + picks/max_sq/chart_buy 아이템 목록

### pattern_cases.py
- `PatternCaseCreate`: symbol, stock_name, market, signal_date, entry_price 등
- `PatternCaseUpdate`: 부분 업데이트 (Optional 필드들)

### position.py
- `PositionStateUpdate`: completed_stages (list)

## 응답 타입 관례

```python
# 성공 응답 — dict 직접 반환 (JSONResponse 미사용)
return {"status": "ok", "data": ...}

# 에러 — HTTPException
raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")
```

## 규칙

- `[PY-02]` 요청 body가 있는 모든 POST/PUT/PATCH는 Pydantic 모델로 정의
- Optional 필드는 `Optional[str] = None` 또는 Python 3.10+ `str | None = None`
- 응답 모델(`response_model`)은 현재 명시적으로 지정하지 않는 경우가 많음 → 추후 추가 권장
