"""BUY 신호 텔레그램 정기 알림 서비스 — 전체 시장 스캔(scan_snapshot) 기반."""

import asyncio
from datetime import datetime, timedelta

from loguru import logger
from sqlalchemy import func, select

from database import async_session
from models import AlertLog, ScanSnapshot, ScanSnapshotItem, UserAlertConfig


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
    """BUY 신호 목록을 텔레그램 HTML 메시지로 포맷 — 지수별 분류."""
    from services.scan_symbols_list import (
        KOSPI200_SYMBOLS, KOSDAQ150_SYMBOLS, KRX_EXTRA_SYMBOLS, KRX_BIO_EXTRA_SYMBOLS,
        SP500_TICKERS, NASDAQ100_EXTRA_TICKERS, RUSSELL1000_EXTRA_TICKERS, RUSSELL2000_EXTRA_TICKERS,
    )

    if timestamp is None:
        timestamp = datetime.now()
    date_str = timestamp.strftime("%-m/%-d %H:%M")

    # 지수 정의 (순서 = 중복 시 우선순위)
    KR_INDICES = [
        ("코스피200", KOSPI200_SYMBOLS),
        ("코스닥150", KOSDAQ150_SYMBOLS),
        ("KRX반도체/2차전지", KRX_EXTRA_SYMBOLS),
        ("KRX바이오", KRX_BIO_EXTRA_SYMBOLS),
    ]
    US_INDICES = [
        ("S&P500", SP500_TICKERS),
        ("나스닥100", NASDAQ100_EXTRA_TICKERS),
        ("Russell1000", RUSSELL1000_EXTRA_TICKERS),
        ("Russell2000", RUSSELL2000_EXTRA_TICKERS),
    ]

    def _assign(sigs: list[dict], indices: list[tuple]) -> dict[str, list[dict]]:
        """지수별 버킷에 배분 — 먼저 오는 지수 우선, 종목 중복 없음."""
        seen: set[str] = set()
        buckets: dict[str, list[dict]] = {name: [] for name, _ in indices}
        for name, symbol_set in indices:
            for s in sigs:
                if s["symbol"] not in seen and s["symbol"] in symbol_set:
                    buckets[name].append(s)
                    seen.add(s["symbol"])
        return buckets

    def _stock_line(s: dict) -> str:
        sig_type = "🔵" if s["last_signal"] == "SQZ BUY" else "🟢"
        sq = " SQ" if s["squeeze_level"] >= 2 else ""
        rsi_str = f" R{s['rsi']:.0f}" if s.get("rsi") else ""
        return f"  {sig_type} {s['display_name']}{sq}{rsi_str}"

    def _index_row(name: str, items: list[dict]) -> list[str]:
        if not items:
            return [f"<b>{name}</b> : 없음"]
        rows = [f"<b>{name}</b> : {len(items)}종목"]
        rows += [_stock_line(s) for s in items]
        return rows

    kr_signals = [s for s in signals if s["market"] == "KR"]
    us_signals = [s for s in signals if s["market"] == "US"]
    crypto_signals = [s for s in signals if s["market"] == "CRYPTO"]

    kr_buckets = _assign(kr_signals, KR_INDICES)
    us_buckets = _assign(us_signals, US_INDICES)

    lines = [f"📊 <b>전체 시장 BUY 신호</b> ({date_str})\n"]

    lines.append("🇰🇷 <b>국내주식</b>")
    for name, _ in KR_INDICES:
        lines += _index_row(name, kr_buckets[name])

    lines.append("\n🇺🇸 <b>미국주식</b>")
    for name, _ in US_INDICES:
        lines += _index_row(name, us_buckets[name])

    lines.append("\n₿ <b>암호화폐</b>")
    if crypto_signals:
        lines += [_stock_line(s) for s in crypto_signals]
    else:
        lines.append("암호화폐 : 없음")

    lines.append(f"\n총 {len(signals)}종목 | 추세추종 연구소")
    return "\n".join(lines)


async def send_scheduled_buy_alert() -> dict:
    """정기 BUY 신호 알림 전송 — 사용자별 개별 발송."""
    from services.telegram_bot import TelegramService

    try:
        # ── 중복 발송 방지: 최근 3분 이내 scheduled_buy 발송 이력 확인 ──
        async with async_session() as session:
            cutoff = datetime.utcnow() - timedelta(minutes=3)
            recent_count = await session.scalar(
                select(func.count(AlertLog.id)).where(
                    AlertLog.alert_type == "scheduled_buy",
                    AlertLog.success.is_(True),
                    AlertLog.sent_at >= cutoff,
                )
            )
            if recent_count and recent_count > 0:
                logger.warning(f"BUY 알림 중복 방지: 최근 3분 이내 이미 {recent_count}건 발송됨 — 건너뜀")
                return {"status": "skipped", "reason": "duplicate_guard", "recent_count": recent_count}

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
            logger.warning("활성 텔레그램 설정 없음 — BUY 신호 알림 건너뜀")
            return {"status": "skipped", "reason": "no_active_configs"}

        # BUY 신호는 전체 시장 기준 (사용자별 동일 메시지)
        signals = await get_recent_buy_signals()
        symbol_count = len(signals)
        now = datetime.now()
        message = format_buy_signal_message(signals, now)

        total_sent = 0
        total_failed = 0

        for config in configs:
            try:
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
                        logger.warning(f"BUY 알림 발송 시도 {attempt + 1}/3 실패 (user {config.user_id}): {e}")
                        if attempt < 2:
                            await asyncio.sleep(10)

                if not success and not error_msg:
                    error_msg = "send_message returned False"

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

                if success:
                    total_sent += 1
                else:
                    total_failed += 1

            except Exception as e:
                logger.error(f"BUY 알림 오류 (user {config.user_id}): {e}")
                total_failed += 1

        logger.info(f"BUY 신호 알림 완료: {symbol_count}종목, {total_sent}명 성공, {total_failed}명 실패")
        return {
            "status": "done",
            "symbol_count": symbol_count,
            "sent": total_sent,
            "failed": total_failed,
        }

    except Exception as e:
        logger.error(f"BUY 신호 알림 전체 오류: {e}")
        return {"status": "error", "message": str(e)}
