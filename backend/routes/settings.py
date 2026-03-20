from pathlib import Path
from typing import Optional

from fastapi import APIRouter
from loguru import logger
from pydantic import BaseModel

from config import PROJECT_ROOT, get_settings
from indicators.signal_engine import SENSITIVITY_PRESETS, load_sensitivity, save_sensitivity

router = APIRouter(tags=["settings"])

ENV_PATH = PROJECT_ROOT / ".env"


class SensitivityUpdate(BaseModel):
    level: str  # strict, normal, sensitive


class TelegramUpdate(BaseModel):
    bot_token: str
    chat_id: str


@router.get("/settings/sensitivity")
async def get_sensitivity():
    current = load_sensitivity()
    preset = SENSITIVITY_PRESETS.get(current, SENSITIVITY_PRESETS["strict"])
    return {
        "current": current,
        "label": preset["label"],
        "presets": {
            k: {
                "label": v["label"],
                "required_conditions": v["required_conditions"],
                "rsi_buy": v["rsi_buy"],
                "rsi_sell": v["rsi_sell"],
                "bb_buy": v["bb_buy"],
                "bb_sell": v["bb_sell"],
                "volume_min": v["volume_min"],
            }
            for k, v in SENSITIVITY_PRESETS.items()
        },
    }


@router.put("/settings/sensitivity")
async def update_sensitivity(body: SensitivityUpdate):
    if body.level not in SENSITIVITY_PRESETS:
        return {"error": "유효하지 않은 민감도 레벨"}
    save_sensitivity(body.level)
    preset = SENSITIVITY_PRESETS[body.level]
    return {"status": "ok", "level": body.level, "label": preset["label"]}


# ── 텔레그램 설정 ──────────────────────────────────────────


def _read_env() -> dict[str, str]:
    """Parse .env file into dict."""
    env: dict[str, str] = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def _write_env(env: dict[str, str]) -> None:
    """Write dict back to .env, preserving comments from .env.example."""
    example = PROJECT_ROOT / ".env.example"
    lines: list[str] = []
    if example.exists():
        for line in example.read_text().splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                lines.append(line)
            elif "=" in stripped:
                key = stripped.split("=", 1)[0].strip()
                val = env.get(key, stripped.split("=", 1)[1].strip())
                lines.append(f"{key}={val}")
    # Add any keys not in example
    example_keys = {l.split("=", 1)[0].strip() for l in lines if "=" in l and not l.strip().startswith("#")}
    for k, v in env.items():
        if k not in example_keys:
            lines.append(f"{k}={v}")
    ENV_PATH.write_text("\n".join(lines) + "\n")


@router.get("/settings/telegram")
async def get_telegram():
    settings = get_settings()
    return {
        "configured": settings.telegram_configured,
        "bot_token": _mask(settings.TELEGRAM_BOT_TOKEN),
        "chat_id": settings.TELEGRAM_CHAT_ID or "",
    }


@router.put("/settings/telegram")
async def update_telegram(body: TelegramUpdate):
    env = _read_env()
    env["TELEGRAM_BOT_TOKEN"] = body.bot_token
    env["TELEGRAM_CHAT_ID"] = body.chat_id
    _write_env(env)

    # Reload settings in-memory
    get_settings.cache_clear()

    return {"status": "ok", "configured": True}


@router.post("/settings/telegram/test")
async def test_telegram():
    from telegram import Bot

    settings = get_settings()
    if not settings.telegram_configured:
        return {"status": "error", "message": "텔레그램이 설정되지 않았습니다"}

    try:
        bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
        await bot.send_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text="✅ 추세추종 연구소 텔레그램 연동 테스트 성공!\n알림이 정상적으로 수신됩니다.",
            parse_mode="HTML",
        )
        return {"status": "ok", "message": "테스트 메시지 발송 성공"}
    except Exception as e:
        logger.error(f"텔레그램 테스트 실패: {e}")
        return {"status": "error", "message": f"발송 실패: {e}"}


def _mask(token: Optional[str]) -> str:
    if not token:
        return ""
    if len(token) <= 10:
        return "***"
    return token[:5] + "***" + token[-4:]


# ── 한국투자증권 API 설정 ──────────────────────────────────────


class KISUpdate(BaseModel):
    app_key: str
    app_secret: str
    account_no: str = ""
    paper_trading: bool = True


@router.get("/settings/kis")
async def get_kis():
    settings = get_settings()
    from services import kis_websocket

    return {
        "configured": settings.kis_configured,
        "app_key": _mask(settings.KIS_APP_KEY),
        "account_no": settings.KIS_ACCOUNT_NO or "",
        "paper_trading": settings.KIS_PAPER_TRADING,
        "websocket": kis_websocket.get_subscription_info(),
    }


@router.put("/settings/kis")
async def update_kis(body: KISUpdate):
    env = _read_env()
    env["KIS_APP_KEY"] = body.app_key
    env["KIS_APP_SECRET"] = body.app_secret
    env["KIS_ACCOUNT_NO"] = body.account_no
    env["KIS_PAPER_TRADING"] = str(body.paper_trading).lower()
    _write_env(env)

    # Reload settings + KIS service
    get_settings.cache_clear()
    from services.kis_client import reset_kis_service
    reset_kis_service()

    return {"status": "ok", "configured": True}


@router.post("/settings/kis/test")
async def test_kis():
    """한투 API 연결 테스트 — 삼성전자(005930) 현재가 1건 조회."""
    import asyncio
    from services.kis_client import get_kis_service

    settings = get_settings()
    if not settings.kis_configured:
        return {"status": "error", "message": "한투 API가 설정되지 않았습니다"}

    try:
        kis = get_kis_service()
        if not kis:
            return {"status": "error", "message": "한투 API 초기화 실패"}

        data = await asyncio.to_thread(kis.get_quote, "005930")
        if data:
            return {
                "status": "ok",
                "message": f"연결 성공! 삼성전자 현재가: {data['price']:,.0f}원",
                "data": data,
            }
        return {"status": "error", "message": "가격 조회 실패 — 키를 확인하세요"}
    except Exception as e:
        logger.error(f"한투 API 테스트 실패: {e}")
        return {"status": "error", "message": f"연결 실패: {e}"}
