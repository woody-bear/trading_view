"""관심종목 SELL 신호 텔레그램 정기 알림 — watchlist 국내 종목 대상."""

import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Optional

from loguru import logger
from sqlalchemy import func, select

from config import get_settings
from database import async_session
from models import AlertLog, CurrentSignal, UserAlertConfig, Watchlist


async def get_watchlist_sell_status(user_id: Optional[uuid.UUID] = None) -> list[dict]:
    """관심종목 전체(KR/US/CRYPTO)의 현재 신호 상태를 조회.

    Returns: 전 종목 리스트 (SELL 여부 포함)
    """
    async with async_session() as session:
        query = (
            select(Watchlist, CurrentSignal)
            .outerjoin(CurrentSignal, CurrentSignal.watchlist_id == Watchlist.id)
            .where(Watchlist.is_active.is_(True))
            .order_by(Watchlist.id)
        )
        if user_id is not None:
            query = query.where(Watchlist.user_id == user_id)
        result = await session.execute(query)
        rows = result.all()

    items = []
    for w, cs in rows:
        signal_state = cs.signal_state if cs else "NEUTRAL"
        items.append({
            "symbol": w.symbol,
            "display_name": w.display_name or w.symbol,
            "market": w.market,
            "signal_state": signal_state,
            "price": cs.price if cs else 0,
            "confidence": cs.confidence if cs else 0,
            "rsi": cs.rsi if cs else None,
            "squeeze_level": cs.squeeze_level if cs else 0,
        })

    return items


def format_sell_alert_message(items: list[dict], timestamp: datetime = None) -> str:
    """관심종목 SELL 상태 텔레그램 HTML 메시지 생성."""
    if timestamp is None:
        timestamp = datetime.now()

    settings = get_settings()
    app_url = getattr(settings, "APP_URL", None) or "http://localhost:3000"
    date_str = timestamp.strftime("%-m/%-d %H:%M")

    if not items:
        return (
            f"🔴 <b>관심종목 SELL 체크</b> ({date_str})\n\n"
            f"관심종목이 없습니다.\n\n"
            f"추세추종 연구소"
        )

    sell_items = [x for x in items if x["signal_state"] == "SELL"]
    safe_items = [x for x in items if x["signal_state"] != "SELL"]

    market_flag = {"KR": "🇰🇷", "US": "🇺🇸", "CRYPTO": "🪙"}

    lines = [f"🔴 <b>관심종목 SELL 체크</b> ({date_str})\n"]

    if sell_items:
        lines.append(f"<b>⚠️ SELL 신호 발생 ({len(sell_items)}종목)</b>\n")
        for i, s in enumerate(sell_items, 1):
            flag = market_flag.get(s.get("market", "KR"), "")
            price_str = f"${s['price']:,.2f}" if s.get("market") == "US" else f"{s['price']:,.0f}"
            rsi_str = f"RSI {s['rsi']:.0f}" if s.get("rsi") else ""
            conf_str = f"강도 {s['confidence']:.0f}점" if s["confidence"] else ""
            link = f'{app_url}/{s["symbol"]}'
            lines.append(
                f"{i}. 🔴 {flag} <b>{s['display_name']}</b> ({s['symbol']})\n"
                f"   💰 {price_str} | {rsi_str} {conf_str}\n"
                f"   <a href=\"{link}\">📈 상세보기</a>"
            )
    else:
        lines.append("✅ <b>SELL 신호 없음</b> — 모든 관심종목 안전\n")

    if safe_items:
        status_list = []
        for s in safe_items:
            flag = market_flag.get(s.get("market", "KR"), "")
            emoji = "🟢" if s["signal_state"] == "BUY" else "⚪"
            status_list.append(f"{emoji}{flag} {s['display_name']}({s['signal_state']})")
        lines.append(f"\n📋 기타: {' · '.join(status_list)}")

    lines.append(f"\n총 {len(items)}종목 체크 | 추세추종 연구소")

    return "\n".join(lines)


async def send_scheduled_sell_alert(market: str | None = None) -> dict:
    """정기 SELL 신호 알림 전송 — 스케줄러에서 호출. 사용자별 개별 발송.

    Args:
        market: 'KR' → KR 종목만, 'US' → US 종목만, None → 전체
    """
    from services.telegram_bot import TelegramService

    try:
        # ── 중복 발송 방지: 최근 2분 이내 scheduled_sell 발송 이력 확인 ──
        sell_type = f"scheduled_sell_{market.lower()}" if market else "scheduled_sell"
        async with async_session() as session:
            cutoff = datetime.utcnow() - timedelta(minutes=2)
            recent_count = await session.scalar(
                select(func.count(AlertLog.id)).where(
                    AlertLog.alert_type == sell_type,
                    AlertLog.success.is_(True),
                    AlertLog.sent_at >= cutoff,
                )
            )
            if recent_count and recent_count > 0:
                logger.warning(f"SELL 알림 중복 방지 ({sell_type}): 최근 2분 이내 이미 {recent_count}건 발송됨 — 건너뜀")
                return {"status": "skipped", "reason": "duplicate_guard"}

        # 활성 user_alert_config 목록 조회
        async with async_session() as session:
            result = await session.execute(
                select(UserAlertConfig).where(
                    UserAlertConfig.is_active.is_(True),
                    UserAlertConfig.telegram_bot_token.isnot(None),
                    UserAlertConfig.telegram_chat_id.isnot(None),
                )
            )
            configs = result.scalars().all()

        if not configs:
            logger.warning("활성 텔레그램 설정 없음 — SELL 신호 알림 건너뜀")
            return {"status": "skipped", "reason": "no_active_configs"}

        now = datetime.now()
        total_sent = 0
        total_failed = 0

        for config in configs:
            try:
                all_items = await get_watchlist_sell_status(user_id=config.user_id)
                # market 필터 적용
                items = [x for x in all_items if market is None or x.get("market") == market]
                if not items:
                    continue

                sell_count = sum(1 for x in items if x["signal_state"] == "SELL")
                message = format_sell_alert_message(items, now)

                telegram = TelegramService(
                    bot_token=config.telegram_bot_token,
                    chat_id=config.telegram_chat_id,
                )
                success = False
                error_msg = None

                for attempt in range(3):
                    try:
                        success = await telegram.send_message(message)
                        if success:
                            break
                    except Exception as e:
                        error_msg = str(e)
                        logger.warning(f"SELL 알림 발송 시도 {attempt + 1}/3 실패 (user {config.user_id}): {e}")
                        if attempt < 2:
                            await asyncio.sleep(10)

                if not success and not error_msg:
                    error_msg = "send_message returned False"

                async with async_session() as session:
                    session.add(AlertLog(
                        signal_history_id=None,
                        channel="telegram",
                        alert_type=sell_type,
                        message=message,
                        sent_at=now,
                        success=success,
                        error_message=error_msg if not success else None,
                        symbol_count=len(items),
                    ))
                    await session.commit()

                if success:
                    total_sent += 1
                    logger.info(f"SELL 알림 전송 완료 (user {config.user_id}): {len(items)}종목, SELL {sell_count}개")
                else:
                    total_failed += 1

            except Exception as e:
                logger.error(f"SELL 알림 오류 (user {config.user_id}): {e}")
                total_failed += 1

        return {
            "status": "done",
            "sent": total_sent,
            "failed": total_failed,
            "message": f"SELL 알림 발송 완료: {total_sent}명 성공, {total_failed}명 실패",
        }

    except Exception as e:
        logger.error(f"SELL 신호 알림 전체 오류: {e}")
        return {"status": "error", "message": str(e)}
