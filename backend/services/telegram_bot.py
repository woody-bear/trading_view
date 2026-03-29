from typing import Optional

from loguru import logger
from telegram import Bot

from config import get_settings
from indicators.signal_engine import SignalResult


class TelegramService:
    def __init__(self, bot_token: Optional[str] = None, chat_id: Optional[str] = None):
        self.settings = get_settings()
        self._override_token = bot_token
        self._override_chat_id = chat_id
        self._bot: Optional[Bot] = None

    @property
    def _token(self) -> Optional[str]:
        return self._override_token or self.settings.TELEGRAM_BOT_TOKEN

    @property
    def _chat_id(self) -> Optional[str]:
        return self._override_chat_id or self.settings.TELEGRAM_CHAT_ID

    @property
    def _configured(self) -> bool:
        return bool(self._token and self._chat_id)

    @property
    def bot(self) -> Optional[Bot]:
        if self._bot is None and self._configured:
            self._bot = Bot(token=self._token)
        return self._bot

    async def send_signal_alert(
        self,
        symbol: str,
        display_name: str,
        market: str,
        result: SignalResult,
        prev_state: str,
        timeframe: str,
    ) -> bool:
        if not self._configured:
            logger.debug("텔레그램 미설정 — 알림 스킵")
            return False

        emoji = "🟢" if result.state == "BUY" else "🔴"
        direction = "매수" if result.state == "BUY" else "매도"
        iv = result.indicators

        message = (
            f"{emoji} <b>{direction} 신호 전환 — {display_name} ({symbol})</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"📊 현재가: {iv.price:,.0f} ({iv.change_pct:+.1f}%)\n"
            f"📈 신호: {prev_state} → {result.state}\n"
            f"💪 강도: {result.confidence:.0f}/100 ({result.grade})\n\n"
            f"지표 상세:\n"
            f"  BB: %B {iv.bb_pct_b:.3f}\n"
            f"  RSI: {iv.rsi:.1f}\n"
            f"  MACD 히스토그램: {iv.macd_hist:.4f}\n"
            f"  스퀴즈: {'NO LOW MID HIGH'.split()[iv.squeeze_level or 0]}\n"
            f"  거래량: 평균 대비 {iv.volume_ratio:.1f}배\n"
            f"  EMA: 20={iv.ema_20:,.0f} 50={iv.ema_50:,.0f} 200={iv.ema_200:,.0f}\n\n"
            f"📐 타임프레임: {timeframe}\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ 본 알림은 참고용이며 투자 권유가 아닙니다."
        )

        try:
            await self.bot.send_message(
                chat_id=self._chat_id,
                text=message,
                parse_mode="HTML",
            )
            logger.info(f"텔레그램 발송 성공: {symbol} {result.state}")
            return True
        except Exception as e:
            logger.error(f"텔레그램 발송 실패: {e}")
            return False

    async def send_message(self, text: str) -> bool:
        """범용 텔레그램 메시지 발송."""
        if not self._configured:
            return False
        try:
            await self.bot.send_message(
                chat_id=self._chat_id,
                text=text,
                parse_mode="HTML",
            )
            return True
        except Exception as e:
            logger.error(f"텔레그램 메시지 발송 실패: {e}")
            return False
