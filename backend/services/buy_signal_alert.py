"""국내주식 BUY 신호 텔레그램 정기 알림 서비스."""

import asyncio
from datetime import datetime, timedelta

from loguru import logger
from sqlalchemy import select

from config import get_settings
from database import async_session
from models import AlertLog, SignalHistory, Watchlist


async def get_recent_buy_signals(days: int = 3) -> list[dict]:
    """최근 N일(자연일) 이내 BUY 신호가 발생한 국내 종목 조회.

    - signal_history에서 BUY 상태 전환 이력 조회
    - KR/KOSPI/KOSDAQ 시장 필터
    - 동일 종목 중복 제거 (최신 신호 유지)
    - 신뢰도 내림차순 정렬, 최대 20개
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

    async with async_session() as session:
        result = await session.execute(
            select(SignalHistory, Watchlist)
            .join(Watchlist, SignalHistory.watchlist_id == Watchlist.id)
            .where(
                SignalHistory.signal_state == "BUY",
                SignalHistory.detected_at >= cutoff,
                Watchlist.market.in_(["KR", "KOSPI", "KOSDAQ"]),
                Watchlist.is_active == True,
            )
            .order_by(SignalHistory.detected_at.desc())
        )
        rows = result.all()

    # 종목별 중복 제거 (최신 신호만)
    seen = set()
    signals = []
    for sh, w in rows:
        if w.symbol in seen:
            continue
        seen.add(w.symbol)

        # 신호 강도
        confidence = sh.confidence or 0
        if confidence >= 90:
            grade = "STRONG"
        elif confidence >= 70:
            grade = "NORMAL"
        elif confidence >= 60:
            grade = "WEAK"
        else:
            grade = ""

        signals.append({
            "symbol": w.symbol,
            "display_name": w.display_name or w.symbol,
            "market": w.market,
            "price": sh.price or 0,
            "change_pct": ((sh.price or 0) - (sh.ema_20 or sh.price or 1)) / (sh.ema_20 or sh.price or 1) * 100 if sh.price else 0,
            "confidence": confidence,
            "grade": grade,
            "squeeze_level": sh.squeeze_level or 0,
            "detected_at": sh.detected_at,
        })

    # 신뢰도 순 정렬
    signals.sort(key=lambda x: x["confidence"], reverse=True)

    return signals[:20]


def format_buy_signal_message(signals: list[dict], timestamp: datetime = None) -> str:
    """BUY 신호 목록을 텔레그램 HTML 메시지로 포맷."""
    if timestamp is None:
        timestamp = datetime.now()

    settings = get_settings()
    app_url = getattr(settings, "APP_URL", None) or "http://localhost:3000"
    date_str = timestamp.strftime("%-m/%-d %H:%M")

    if not signals:
        return (
            f"📊 <b>국내주식 BUY 신호</b> ({date_str})\n\n"
            f"현재 BUY 신호 종목이 없습니다.\n\n"
            f"추세추종 연구소"
        )

    lines = [f"📊 <b>국내주식 BUY 신호</b> ({date_str})\n"]

    total = len(signals)
    display = signals[:20]
    remaining = total - len(display)

    for i, s in enumerate(display, 1):
        # 강도 이모지
        grade_emoji = "🔥" if s["grade"] == "STRONG" else "⚡" if s["grade"] == "NORMAL" else "💡"
        # 스퀴즈 표시
        sq = " 🟡SQ" if s["squeeze_level"] >= 2 else ""
        # 신호 발생일
        sig_date = s["detected_at"].strftime("%-m/%-d")
        # 가격 포맷
        price_str = f"{s['price']:,.0f}"
        change_str = f"{s['change_pct']:+.1f}%" if s["change_pct"] else ""
        # 링크
        link = f'{app_url}/{s["symbol"]}'

        lines.append(
            f"{i}. <b>{s['display_name']}</b> ({s['symbol']}){sq}\n"
            f"   💰 {price_str}원 {change_str}\n"
            f"   {grade_emoji} {s['grade']} ({s['confidence']:.0f}점) | 신호일: {sig_date}\n"
            f"   <a href=\"{link}\">📈 상세보기</a>\n"
        )

    if remaining > 0:
        lines.append(f"... 외 {remaining}개 종목\n")

    lines.append(f"총 {total}종목 | 추세추종 연구소")

    return "\n".join(lines)


async def send_scheduled_buy_alert() -> dict:
    """정기 BUY 신호 알림 전송 — 스케줄러에서 호출."""
    settings = get_settings()

    if not settings.telegram_configured:
        logger.warning("텔레그램 미설정 — BUY 신호 알림 건너뜀")
        return {"status": "skipped", "reason": "telegram_not_configured"}

    try:
        # 1. BUY 신호 조회
        signals = await get_recent_buy_signals(days=3)
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
