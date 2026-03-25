"""BUY 신호 텔레그램 정기 알림 서비스 — 전체 시장 스캔(scan_snapshot) 기반."""

import asyncio
from datetime import datetime

from loguru import logger
from sqlalchemy import select

from config import get_settings
from database import async_session
from models import AlertLog, ScanSnapshot, ScanSnapshotItem


async def get_recent_buy_signals() -> list[dict]:
    """최신 전체 시장 스캔 스냅샷에서 chart_buy 종목 조회.

    - scan_snapshot_item (category='chart_buy') 에서 조회
    - 신뢰도 내림차순 정렬, 최대 20개
    """
    async with async_session() as session:
        # 최신 완료 스냅샷
        snap = await session.scalar(
            select(ScanSnapshot.id)
            .where(ScanSnapshot.status == "completed")
            .order_by(ScanSnapshot.completed_at.desc())
            .limit(1)
        )
        if not snap:
            return []

        result = await session.execute(
            select(ScanSnapshotItem)
            .where(
                ScanSnapshotItem.snapshot_id == snap,
                ScanSnapshotItem.category == "chart_buy",
            )
            .order_by(ScanSnapshotItem.confidence.desc())
            .limit(20)
        )
        items = result.scalars().all()

    signals = []
    for item in items:
        confidence = item.confidence or 0
        if confidence >= 90:
            grade = "STRONG"
        elif confidence >= 70:
            grade = "NORMAL"
        elif confidence >= 60:
            grade = "WEAK"
        else:
            grade = ""

        signals.append({
            "symbol": item.symbol,
            "display_name": item.name,
            "market": item.market,
            "market_type": item.market_type,
            "price": item.price or 0,
            "change_pct": item.change_pct or 0,
            "confidence": confidence,
            "grade": grade,
            "squeeze_level": item.squeeze_level or 0,
            "rsi": item.rsi,
            "last_signal": item.last_signal or "BUY",
            "last_signal_date": item.last_signal_date or "",
        })

    return signals


def format_buy_signal_message(signals: list[dict], timestamp: datetime = None) -> str:
    """BUY 신호 목록을 텔레그램 HTML 메시지로 포맷."""
    if timestamp is None:
        timestamp = datetime.now()

    settings = get_settings()
    app_url = getattr(settings, "APP_URL", None) or "http://localhost:3000"
    date_str = timestamp.strftime("%-m/%-d %H:%M")

    if not signals:
        return (
            f"📊 <b>전체 시장 BUY 신호</b> ({date_str})\n\n"
            f"현재 BUY 신호 종목이 없습니다.\n\n"
            f"추세추종 연구소"
        )

    # 시장별 분류
    kr_signals = [s for s in signals if s["market"] == "KR"]
    us_signals = [s for s in signals if s["market"] == "US"]

    lines = [f"📊 <b>전체 시장 BUY 신호</b> ({date_str})\n"]

    def _format_section(title: str, items: list[dict], currency: str = "원"):
        if not items:
            return
        lines.append(f"\n<b>{'🇰🇷' if currency == '원' else '🇺🇸'} {title}</b> ({len(items)}종목)")
        for i, s in enumerate(items[:10], 1):
            sig_type = "🔵SQZ" if s["last_signal"] == "SQZ BUY" else "🟢"
            sq = " 🟡SQ" if s["squeeze_level"] >= 2 else ""
            price_str = f"{s['price']:,.0f}" if currency == "원" else f"${s['price']:,.2f}"
            change_str = f"{s['change_pct']:+.1f}%" if s["change_pct"] else ""
            sig_date = s["last_signal_date"] or ""
            rsi_str = f"RSI {s['rsi']:.0f}" if s.get("rsi") else ""
            link = f'{app_url}/{s["symbol"]}'

            lines.append(
                f"{i}. {sig_type} <b>{s['display_name']}</b> ({s['symbol']}){sq}\n"
                f"   💰 {price_str} {change_str} | {rsi_str}\n"
                f"   신호: {s['last_signal']} ({sig_date}) | <a href=\"{link}\">상세</a>"
            )
        if len(items) > 10:
            lines.append(f"   ... 외 {len(items) - 10}개")

    _format_section("국내주식", kr_signals, "원")
    _format_section("미국주식", us_signals, "$")

    lines.append(f"\n총 {len(signals)}종목 | 추세추종 연구소")

    return "\n".join(lines)


async def send_scheduled_buy_alert() -> dict:
    """정기 BUY 신호 알림 전송 — 스케줄러에서 호출."""
    settings = get_settings()

    if not settings.telegram_configured:
        logger.warning("텔레그램 미설정 — BUY 신호 알림 건너뜀")
        return {"status": "skipped", "reason": "telegram_not_configured"}

    try:
        # 1. BUY 신호 조회 (전체 시장 스캔 스냅샷에서)
        signals = await get_recent_buy_signals()
        symbol_count = len(signals)

        # 2. 메시지 생성
        now = datetime.now()
        message = format_buy_signal_message(signals, now)

        # 3. 텔레그램 발송 (재시도 포함)
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
                logger.warning(f"BUY 알림 발송 시도 {attempt + 1}/3 실패: {e}")
                if attempt < 2:
                    await asyncio.sleep(10)

        if not success and not error_msg:
            error_msg = "send_message returned False"

        # 4. 이력 저장
        async with async_session() as session:
            session.add(AlertLog(
                signal_history_id=None,
                channel="telegram",
                alert_type="scheduled_buy",
                message=message,
                sent_at=now,
                success=success,
                error_message=error_msg if not success else None,
                symbol_count=symbol_count,
            ))
            await session.commit()

        status = "sent" if success else "failed"
        logger.info(f"BUY 신호 알림 {status}: {symbol_count}종목")

        return {
            "status": status,
            "symbol_count": symbol_count,
            "message": f"BUY 신호 {symbol_count}종목 전송 {'완료' if success else '실패'}",
        }

    except Exception as e:
        logger.error(f"BUY 신호 알림 오류: {e}")
        # 에러도 이력에 기록
        try:
            async with async_session() as session:
                session.add(AlertLog(
                    signal_history_id=None,
                    channel="telegram",
                    alert_type="scheduled_buy",
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
