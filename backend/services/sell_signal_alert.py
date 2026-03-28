"""관심종목 SELL 신호 텔레그램 정기 알림 — watchlist 국내 종목 대상."""

import asyncio
from datetime import datetime

from loguru import logger
from sqlalchemy import select

from config import get_settings
from database import async_session
from models import AlertLog, CurrentSignal, Watchlist


async def get_watchlist_sell_status() -> list[dict]:
    """관심종목 전체(KR/US/CRYPTO)의 현재 신호 상태를 조회.

    Returns: 전 종목 리스트 (SELL 여부 포함)
    """
    async with async_session() as session:
        result = await session.execute(
            select(Watchlist, CurrentSignal)
            .outerjoin(CurrentSignal, CurrentSignal.watchlist_id == Watchlist.id)
            .where(
                Watchlist.is_active.is_(True),
            )
            .order_by(Watchlist.id)
        )
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


async def send_scheduled_sell_alert() -> dict:
    """정기 SELL 신호 알림 전송 — 스케줄러에서 호출."""
    settings = get_settings()

    if not settings.telegram_configured:
        logger.warning("텔레그램 미설정 — SELL 신호 알림 건너뜀")
        return {"status": "skipped", "reason": "telegram_not_configured"}

    try:
        # 1. 관심종목 SELL 상태 조회
        items = await get_watchlist_sell_status()
        sell_count = sum(1 for x in items if x["signal_state"] == "SELL")

        # 2. 메시지 생성
        now = datetime.now()
        message = format_sell_alert_message(items, now)

        # 3. 텔레그램 발송
        from services.telegram_bot import TelegramService
        telegram = TelegramService()
        success = False
        error_msg = None

        for attempt in range(3):
            try:
                success = await telegram.send_message(message)
                if success:
                    break
            except Exception as e:
                error_msg = str(e)
                logger.warning(f"SELL 알림 발송 시도 {attempt + 1}/3 실패: {e}")
                if attempt < 2:
                    await asyncio.sleep(10)

        if not success and not error_msg:
            error_msg = "send_message returned False"

        # 4. 이력 저장
        async with async_session() as session:
            session.add(AlertLog(
                signal_history_id=None,
                channel="telegram",
                alert_type="scheduled_sell",
                message=message,
                sent_at=now,
                success=success,
                error_message=error_msg if not success else None,
                symbol_count=len(items),
            ))
            await session.commit()

        status = "sent" if success else "failed"
        logger.info(f"SELL 신호 알림 {status}: {len(items)}종목 체크, SELL {sell_count}개")

        return {
            "status": status,
            "symbol_count": len(items),
            "sell_count": sell_count,
            "message": f"SELL 체크 {len(items)}종목 ({sell_count}개 SELL) 전송 {'완료' if success else '실패'}",
        }

    except Exception as e:
        logger.error(f"SELL 신호 알림 오류: {e}")
        try:
            async with async_session() as session:
                session.add(AlertLog(
                    signal_history_id=None,
                    channel="telegram",
                    alert_type="scheduled_sell",
                    message=None,
                    sent_at=datetime.now(),
                    success=False,
                    error_message=str(e),
                    symbol_count=0,
                ))
                await session.commit()
        except Exception:
            pass
        return {"status": "error", "message": str(e)}
