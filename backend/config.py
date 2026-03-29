from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 서버
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/ubb_pro.db"

    # 텔레그램 (선택 — 미설정 시 알림 비활성화)
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None

    # TradingView 웹훅
    TV_WEBHOOK_SECRET: str = ""

    # 데이터 소스 (선택)
    BINANCE_API_KEY: Optional[str] = None
    BINANCE_API_SECRET: Optional[str] = None

    # 한국투자증권 Open API
    KIS_APP_KEY: Optional[str] = None
    KIS_APP_SECRET: Optional[str] = None
    KIS_ACCOUNT_NO: Optional[str] = None
    KIS_PAPER_TRADING: bool = True

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # 알림 설정
    ALERT_COOLDOWN_MINUTES: int = 30
    MIN_SIGNAL_GRADE: str = "WEAK"
    SYSTEM_ERROR_ALERT: bool = True

    @property
    def telegram_configured(self) -> bool:
        return bool(self.TELEGRAM_BOT_TOKEN and self.TELEGRAM_CHAT_ID)

    @property
    def kis_configured(self) -> bool:
        return bool(self.KIS_APP_KEY and self.KIS_APP_SECRET)


from functools import lru_cache


@lru_cache
def get_settings() -> Settings:
    return Settings()
