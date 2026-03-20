from datetime import datetime

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session
from fetchers import get_fetcher
from indicators.signal_engine import SignalEngine
from models import AlertLog, CurrentSignal, OHLCVCache, SignalHistory, SystemLog, Watchlist
from services.telegram_bot import TelegramService

def _get_engine():
    return SignalEngine()  # 매번 최신 민감도 설정 반영

engine = _get_engine()
telegram = TelegramService()
_scanning = False


async def scan_symbol(session: AsyncSession, item: Watchlist) -> None:
    """단일 종목 스캔: fetch → calculate → judge → compare → notify."""
    try:
        fetcher = get_fetcher(item.market)
        df = await fetcher.fetch_ohlcv(item.symbol, item.timeframe)
        if df is None:
            return

        # 지표 계산
        indicators = engine.calculate_indicators(df)
        if indicators is None:
            return

        # 이전 상태 조회
        prev = await session.get(CurrentSignal, item.id)
        prev_state = prev.signal_state if prev else "NEUTRAL"

        # 신호 판정
        result = engine.judge_signal(indicators, prev_state)

        # current_signal 업데이트
        iv = result.indicators
        if prev is None:
            prev = CurrentSignal(watchlist_id=item.id)
            session.add(prev)

        prev.signal_state = result.state
        prev.confidence = result.confidence
        prev.price = iv.price
        prev.change_pct = iv.change_pct
        prev.rsi = iv.rsi
        prev.bb_pct_b = iv.bb_pct_b
        prev.bb_width = iv.bb_width
        prev.squeeze_level = iv.squeeze_level
        prev.macd_hist = iv.macd_hist
        prev.volume_ratio = iv.volume_ratio
        prev.ema_20 = iv.ema_20
        prev.ema_50 = iv.ema_50
        prev.ema_200 = iv.ema_200
        prev.updated_at = datetime.utcnow()

        # OHLCV 캐시 저장
        await _save_ohlcv_cache(session, item.id, item.timeframe, df)

        # 상태 전환 감지
        if result.state != prev_state:
            # 신호 이력 기록
            history = SignalHistory(
                watchlist_id=item.id,
                signal_state=result.state,
                prev_state=prev_state,
                confidence=result.confidence,
                timeframe=item.timeframe,
                price=iv.price,
                rsi=iv.rsi,
                bb_pct_b=iv.bb_pct_b,
                bb_width=iv.bb_width,
                squeeze_level=iv.squeeze_level,
                macd_hist=iv.macd_hist,
                volume_ratio=iv.volume_ratio,
                ema_20=iv.ema_20,
                ema_50=iv.ema_50,
                ema_200=iv.ema_200,
            )
            session.add(history)
            await session.flush()

            # 텔레그램 발송 (BUY/SELL만, 쿨다운 체크)
            if result.state in ("BUY", "SELL") and not await _is_cooldown(session, item.id, result.state, prev_state):
                success = await telegram.send_signal_alert(
                    symbol=item.symbol,
                    display_name=item.display_name or item.symbol,
                    market=item.market,
                    result=result,
                    prev_state=prev_state,
                    timeframe=item.timeframe,
                )
                alert = AlertLog(
                    signal_history_id=history.id,
                    channel="telegram",
                    message=f"{result.state} {result.confidence:.0f}",
                    success=success,
                )
                session.add(alert)


            logger.info(f"{item.symbol}: {prev_state} → {result.state} (confidence={result.confidence:.0f})")
        else:
            logger.debug(f"{item.symbol}: {result.state} 유지")

        await session.commit()

    except Exception as e:
        await session.rollback()
        logger.error(f"{item.symbol} 스캔 실패: {e}")
        # 시스템 로그 기록
        async with async_session() as log_session:
            log_session.add(SystemLog(
                level="ERROR",
                source="scanner",
                message=f"{item.symbol} 스캔 실패: {str(e)[:200]}",
            ))
            await log_session.commit()


async def run_scan(watchlist_ids: list[int] | None = None) -> dict:
    """전체 또는 지정 종목 스캔."""
    global _scanning
    if _scanning:
        logger.warning("스캔 이미 진행 중 — 스킵")
        return {"status": "skipped", "reason": "already_scanning"}

    _scanning = True
    scanned = 0
    skipped = 0
    errors = 0

    try:
        async with async_session() as session:
            query = select(Watchlist).where(Watchlist.is_active.is_(True))
            if watchlist_ids:
                query = query.where(Watchlist.id.in_(watchlist_ids))
            result = await session.execute(query)
            items = result.scalars().all()

            for item in items:
                try:
                    await scan_symbol(session, item)
                    scanned += 1
                except Exception as e:
                    errors += 1
                    logger.error(f"{item.symbol} 처리 중 에러: {e}")

        return {"status": "completed", "scanned": scanned, "skipped": skipped, "errors": errors}
    finally:
        _scanning = False


async def _is_cooldown(session: AsyncSession, watchlist_id: int, new_state: str, prev_state: str) -> bool:
    """알림 쿨다운 체크. 방향 전환(BUY↔SELL)은 쿨다운 무시."""
    from config import get_settings
    from datetime import timedelta

    # 방향 전환은 즉시 발송
    if prev_state in ("BUY", "SELL") and prev_state != new_state:
        return False

    settings = get_settings()
    cutoff = datetime.utcnow() - timedelta(minutes=settings.ALERT_COOLDOWN_MINUTES)

    result = await session.execute(
        select(AlertLog)
        .join(SignalHistory)
        .where(
            SignalHistory.watchlist_id == watchlist_id,
            SignalHistory.signal_state == new_state,
            AlertLog.sent_at > cutoff,
            AlertLog.success.is_(True),
        )
        .limit(1)
    )
    if result.scalar_one_or_none():
        logger.debug(f"쿨다운 중: watchlist_id={watchlist_id} {new_state}")
        return True
    return False


async def _save_ohlcv_cache(session: AsyncSession, watchlist_id: int, timeframe: str, df) -> None:
    """OHLCV 캔들 데이터 캐시 저장 (최대 500개 유지)."""
    from sqlalchemy import delete, func

    # 최근 500개만 유지
    rows = []
    for idx, row in df.tail(500).iterrows():
        ts = int(idx.timestamp()) if hasattr(idx, "timestamp") else int(idx)
        rows.append(OHLCVCache(
            watchlist_id=watchlist_id,
            timeframe=timeframe,
            timestamp=ts,
            open=float(row["open"]),
            high=float(row["high"]),
            low=float(row["low"]),
            close=float(row["close"]),
            volume=float(row["volume"]),
        ))

    # 기존 데이터 삭제 후 삽입 (UPSERT 대신 단순화)
    await session.execute(
        delete(OHLCVCache).where(
            OHLCVCache.watchlist_id == watchlist_id,
            OHLCVCache.timeframe == timeframe,
        )
    )
    session.add_all(rows)


