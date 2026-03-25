"""전체 시장 스캔 — stock_master 전종목을 청크 단위로 스캔하여 DB 스냅샷 저장."""

import asyncio
import time
from datetime import datetime

import pandas as pd
import yfinance as yf
from loguru import logger
from sqlalchemy import delete, select

from database import async_session
from models import ScanSnapshot, ScanSnapshotItem, StockMaster

from indicators.bollinger import calculate_bb, detect_squeeze
from indicators.ema import calculate_ema
from indicators.macd import calculate_macd
from indicators.rsi import calculate_rsi
from indicators.volume import calculate_volume_ratio

CHUNK_SIZE = 100
SCAN_MIN_CANDLES = 60
MAX_SNAPSHOTS = 10  # 보관할 최대 스냅샷 수

# 진행 상태 (메모리)
_progress: dict = {
    "running": False,
    "total_chunks": 0,
    "completed_chunks": 0,
    "scanned_count": 0,
    "total_symbols": 0,
    "started_at": None,
}

_CRYPTO = {
    "BTC-USD": ("BTC/USDT", "Bitcoin", "CRYPTO"),
    "ETH-USD": ("ETH/USDT", "Ethereum", "CRYPTO"),
    "SOL-USD": ("SOL/USDT", "Solana", "CRYPTO"),
    "BNB-USD": ("BNB/USDT", "BNB", "CRYPTO"),
    "XRP-USD": ("XRP/USDT", "Ripple", "CRYPTO"),
    "ADA-USD": ("ADA/USDT", "Cardano", "CRYPTO"),
    "DOGE-USD": ("DOGE/USDT", "Dogecoin", "CRYPTO"),
    "AVAX-USD": ("AVAX/USDT", "Avalanche", "CRYPTO"),
    "LINK-USD": ("LINK/USDT", "Chainlink", "CRYPTO"),
    "DOT-USD": ("DOT/USDT", "Polkadot", "CRYPTO"),
}


def get_progress() -> dict:
    elapsed = round(time.time() - _progress["started_at"]) if _progress["running"] and _progress["started_at"] else 0
    pct = 0
    if _progress["total_chunks"] > 0:
        pct = round(_progress["completed_chunks"] / _progress["total_chunks"] * 100)
    return {
        "running": _progress["running"],
        "total_symbols": _progress["total_symbols"],
        "scanned_count": _progress["scanned_count"],
        "completed_chunks": _progress["completed_chunks"],
        "total_chunks": _progress["total_chunks"],
        "progress_pct": pct,
        "elapsed_seconds": elapsed,
    }


async def _load_symbols() -> list[dict]:
    """stock_master + 암호화폐에서 전체 심볼 로드."""
    symbols = []
    async with async_session() as session:
        result = await session.execute(
            select(StockMaster).where(StockMaster.market == "KR")
        )
        for row in result.scalars().all():
            suffix = ".KS" if row.market_type == "KOSPI" else ".KQ"
            symbols.append({
                "ticker": f"{row.symbol}{suffix}",
                "symbol": row.symbol,
                "name": row.name,
                "market": "KR",
                "market_type": row.market_type,
            })

        # US stocks from stock_master
        result = await session.execute(
            select(StockMaster).where(StockMaster.market == "US")
        )
        for row in result.scalars().all():
            symbols.append({
                "ticker": row.symbol,
                "symbol": row.symbol,
                "name": row.name,
                "market": "US",
                "market_type": "US",
            })

    # Crypto
    for ticker, (sym, name, mtype) in _CRYPTO.items():
        symbols.append({
            "ticker": ticker,
            "symbol": sym,
            "name": name,
            "market": "CRYPTO",
            "market_type": "CRYPTO",
        })

    return symbols


def _batch_download(tickers: list[str]) -> pd.DataFrame | None:
    try:
        return yf.download(tickers, period="1y", interval="1d", progress=False, auto_adjust=True, threads=True, timeout=30)
    except Exception as e:
        logger.error(f"청크 다운로드 실패: {e}")
        return None


def _extract(df_all: pd.DataFrame, ticker: str) -> pd.DataFrame | None:
    try:
        if isinstance(df_all.columns, pd.MultiIndex):
            if ticker not in df_all.columns.get_level_values("Ticker"):
                return None
            df = df_all.xs(ticker, level="Ticker", axis=1)
        else:
            df = df_all
        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.columns = ["open", "high", "low", "close", "volume"]
        df = df.dropna(subset=["close"])
        df = df[(df["open"] > 0) & (df["high"] > 0) & (df["low"] > 0)]
        return df if len(df) >= SCAN_MIN_CANDLES else None
    except Exception:
        return None


def _check_trend(df: pd.DataFrame, ema: dict) -> str:
    e20 = ema.get("ema_20")
    e50 = ema.get("ema_50")
    e200 = ema.get("ema_200")
    if e20 is None or e50 is None or e200 is None:
        return "NEUTRAL"
    if len(e20.dropna()) < 10:
        return "NEUTRAL"
    price = float(df["close"].iloc[-1])
    last_e20, last_e50, last_e200 = float(e20.iloc[-1]), float(e50.iloc[-1]), float(e200.iloc[-1])
    e20_recent = e20.dropna().tail(5)
    e20_slope = (float(e20_recent.iloc[-1]) - float(e20_recent.iloc[0])) if len(e20_recent) >= 5 else 0
    if last_e20 > last_e50 > last_e200 and price > last_e20 and e20_slope > 0:
        return "BULL"
    if last_e20 < last_e50 < last_e200 and price < last_e20:
        return "BEAR"
    return "NEUTRAL"


def _is_dead_cross(ema: dict) -> bool:
    e20 = ema.get("ema_20")
    e50 = ema.get("ema_50")
    if e20 is None or e50 is None:
        return False
    try:
        return float(e20.iloc[-1]) < float(e50.iloc[-1])
    except Exception:
        return False


def _check_buy_signal_precise(df: pd.DataFrame, last_rsi: float, last_sq: int) -> tuple[str | None, str | None]:
    """Pine Script 정밀 BUY 신호 판정 — _simulate_signals 사용.

    사전 필터를 통과한 종목에만 적용 (RSI < 50 또는 스퀴즈 해소 가능성).
    Returns: (signal_text, signal_date) or (None, None)
    """
    # 사전 필터: BUY 가능성이 있는 종목만 정밀 검사
    if last_rsi >= 55 and last_sq == 0:
        return None, None

    try:
        from routes.charts import _calc_all, _simulate_signals

        timestamps = [int(idx.timestamp()) for idx in df.index]
        indicators_data, _, _ = _calc_all(df, timestamps)
        markers = _simulate_signals(df, timestamps, indicators_data, "1d")

        if not markers:
            return None, None

        last_marker = markers[-1]
        if last_marker["text"] in ("BUY", "SQZ BUY"):
            signal_dt = datetime.utcfromtimestamp(last_marker["time"])
            # 3일 이내
            if (datetime.utcnow() - signal_dt).days <= 3:
                return last_marker["text"], signal_dt.strftime("%Y-%m-%d")

        return None, None
    except Exception:
        return None, None


def _analyze_ticker(df: pd.DataFrame, info: dict) -> dict | None:
    """단일 종목 지표 계산 + 분류."""
    try:
        bb = calculate_bb(df)
        squeeze_series = detect_squeeze(df)
        rsi = calculate_rsi(df)
        macd = calculate_macd(df)
        vol = calculate_volume_ratio(df)
        ema = calculate_ema(df)

        if _is_dead_cross(ema):
            return None

        trend = _check_trend(df, ema)
        last_sq = int(squeeze_series.iloc[-1]) if not pd.isna(squeeze_series.iloc[-1]) else 0
        last_rsi = float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50
        last_pctb = float(bb["pct_b"].iloc[-1]) if bb.get("pct_b") is not None and not pd.isna(bb["pct_b"].iloc[-1]) else 0.5
        last_bbw = float(bb["width"].iloc[-1]) if bb.get("width") is not None and not pd.isna(bb["width"].iloc[-1]) else 0
        last_macd = float(macd["histogram"].iloc[-1]) if macd.get("histogram") is not None and not pd.isna(macd["histogram"].iloc[-1]) else 0
        last_vol = float(vol.iloc[-1]) if not pd.isna(vol.iloc[-1]) else 1.0
        price = float(df["close"].iloc[-1])
        open_price = float(df["open"].iloc[-1])
        change = ((price - open_price) / open_price * 100) if open_price != 0 else 0

        # 점수
        score = last_sq * 25
        if trend == "BULL":
            score += 15
        if last_rsi < 40:
            score += 10
        if last_pctb < 0.3:
            score += 5
        if last_macd > 0:
            score += 5
        if last_vol > 1.0:
            score += 5

        # 카테고리 분류
        categories = []
        if last_sq >= 2 and trend == "BULL":
            categories.append("picks")
        if last_sq >= 3 and trend == "BULL":
            categories.append("max_sq")

        # 차트 BUY 신호 (Pine Script 정밀 판정 + 사전 필터)
        buy_signal, buy_date = _check_buy_signal_precise(df, last_rsi, last_sq)
        if buy_signal:
            categories.append("chart_buy")

        if not categories:
            return None

        base = {
            "symbol": info["symbol"],
            "name": info["name"],
            "market": info["market"],
            "market_type": info["market_type"],
            "price": round(price, 2),
            "change_pct": round(change, 2),
            "rsi": round(last_rsi, 1),
            "bb_pct_b": round(last_pctb * 100, 1),
            "bb_width": round(last_bbw * 100, 2),
            "squeeze_level": last_sq,
            "macd_hist": round(last_macd, 4),
            "volume_ratio": round(last_vol, 1),
            "confidence": round(score, 1),
            "trend": trend,
            "categories": categories,
        }

        # chart_buy에 추가 필드
        if "chart_buy" in categories:
            base["last_signal"] = buy_signal
            base["last_signal_date"] = buy_date

        return base
    except Exception:
        return None


async def run_full_scan() -> dict:
    """전체 시장 스캔 실행 — 청크 단위 다운로드 + DB 스냅샷 저장."""
    global _progress

    if _progress["running"]:
        # 10분 이상이면 강제 해제
        if _progress["started_at"] and time.time() - _progress["started_at"] > 600:
            logger.warning("전체 스캔 고착 감지 (10분 초과) — 강제 해제")
            _progress["running"] = False
        else:
            return {"status": "already_running"}

    _progress["running"] = True
    _progress["started_at"] = time.time()
    _progress["scanned_count"] = 0

    # 스냅샷 생성
    async with async_session() as session:
        snapshot = ScanSnapshot(status="running", started_at=datetime.utcnow())
        session.add(snapshot)
        await session.commit()
        await session.refresh(snapshot)
        snapshot_id = snapshot.id

    try:
        symbols = await _load_symbols()
        total = len(symbols)
        _progress["total_symbols"] = total

        # 청크 분할
        chunks = []
        for i in range(0, total, CHUNK_SIZE):
            chunks.append(symbols[i:i + CHUNK_SIZE])
        _progress["total_chunks"] = len(chunks)
        _progress["completed_chunks"] = 0

        logger.info(f"전체 스캔 시작: {total}개 종목, {len(chunks)}개 청크")

        all_items = []
        scanned = 0

        for ci, chunk in enumerate(chunks):
            tickers = [s["ticker"] for s in chunk]
            ticker_map = {s["ticker"]: s for s in chunk}

            try:
                df_all = await asyncio.wait_for(
                    asyncio.to_thread(_batch_download, tickers), timeout=120
                )
            except asyncio.TimeoutError:
                logger.warning(f"청크 {ci + 1}/{len(chunks)} 다운로드 타임아웃 (120초) — 건너뜀")
                _progress["completed_chunks"] = ci + 1
                continue
            if df_all is None or df_all.empty:
                _progress["completed_chunks"] = ci + 1
                continue

            for ticker in tickers:
                info = ticker_map[ticker]
                df = _extract(df_all, ticker)
                if df is None:
                    continue
                scanned += 1
                result = _analyze_ticker(df, info)
                if result:
                    all_items.append(result)

            _progress["completed_chunks"] = ci + 1
            _progress["scanned_count"] = scanned

            if ci < len(chunks) - 1:
                await asyncio.sleep(1)  # rate limit 방지

        # DB 저장
        picks_count = 0
        max_sq_count = 0
        buy_count = 0

        async with async_session() as session:
            for item in all_items:
                for cat in item["categories"]:
                    session.add(ScanSnapshotItem(
                        snapshot_id=snapshot_id,
                        category=cat,
                        symbol=item["symbol"],
                        name=item["name"],
                        market=item["market"],
                        market_type=item["market_type"],
                        price=item.get("price"),
                        change_pct=item.get("change_pct"),
                        rsi=item.get("rsi"),
                        bb_pct_b=item.get("bb_pct_b"),
                        bb_width=item.get("bb_width"),
                        squeeze_level=item.get("squeeze_level"),
                        macd_hist=item.get("macd_hist"),
                        volume_ratio=item.get("volume_ratio"),
                        confidence=item.get("confidence"),
                        trend=item.get("trend"),
                        last_signal=item.get("last_signal"),
                        last_signal_date=item.get("last_signal_date"),
                    ))
                    if cat == "picks":
                        picks_count += 1
                    elif cat == "max_sq":
                        max_sq_count += 1
                    elif cat == "chart_buy":
                        buy_count += 1

            # 스냅샷 완료 업데이트
            snap = await session.get(ScanSnapshot, snapshot_id)
            snap.status = "completed"
            snap.total_symbols = total
            snap.scanned_count = scanned
            snap.picks_count = picks_count
            snap.max_sq_count = max_sq_count
            snap.buy_count = buy_count
            snap.completed_at = datetime.utcnow()
            await session.commit()

        # 오래된 스냅샷 정리
        await _cleanup_old_snapshots()

        elapsed = round(time.time() - _progress["started_at"])
        logger.info(
            f"전체 스캔 완료: {scanned}/{total} 분석 | "
            f"추천 {picks_count} | MAX SQ {max_sq_count} | BUY {buy_count} | "
            f"{elapsed}초 소요"
        )

        return {
            "status": "completed",
            "snapshot_id": snapshot_id,
            "scanned": scanned,
            "total": total,
            "picks": picks_count,
            "max_sq": max_sq_count,
            "chart_buy": buy_count,
            "elapsed_seconds": elapsed,
        }

    except Exception as e:
        logger.error(f"전체 스캔 실패: {e}")
        async with async_session() as session:
            snap = await session.get(ScanSnapshot, snapshot_id)
            if snap:
                snap.status = "failed"
                snap.error_message = str(e)[:500]
                snap.completed_at = datetime.utcnow()
                await session.commit()
        return {"status": "failed", "error": str(e)}
    finally:
        _progress["running"] = False


async def get_latest_snapshot() -> dict | None:
    """최신 완료된 스냅샷 + 아이템 조회."""
    async with async_session() as session:
        result = await session.execute(
            select(ScanSnapshot)
            .where(ScanSnapshot.status == "completed")
            .order_by(ScanSnapshot.completed_at.desc())
            .limit(1)
        )
        snapshot = result.scalar_one_or_none()
        if not snapshot:
            return None

        items_result = await session.execute(
            select(ScanSnapshotItem)
            .where(ScanSnapshotItem.snapshot_id == snapshot.id)
            .order_by(ScanSnapshotItem.confidence.desc())
        )
        items = items_result.scalars().all()

        # 카테고리별 그룹핑
        picks_by_market = {}
        max_sq_by_market = {}
        chart_buy_items = []

        for item in items:
            d = {
                "symbol": item.symbol, "name": item.name,
                "market": item.market, "market_type": item.market_type,
                "price": item.price, "change_pct": item.change_pct,
                "rsi": item.rsi, "bb_pct_b": item.bb_pct_b,
                "bb_width": item.bb_width, "squeeze_level": item.squeeze_level,
                "macd_hist": item.macd_hist, "volume_ratio": item.volume_ratio,
                "confidence": item.confidence, "trend": item.trend,
                "last_signal": item.last_signal,
                "last_signal_date": item.last_signal_date,
            }
            if item.category == "picks":
                picks_by_market.setdefault(item.market_type.lower(), []).append(d)
            elif item.category == "max_sq":
                max_sq_by_market.setdefault(item.market_type.lower(), []).append(d)
            elif item.category == "chart_buy":
                chart_buy_items.append(d)

        return {
            "snapshot_id": snapshot.id,
            "status": snapshot.status,
            "total_symbols": snapshot.total_symbols,
            "scanned_count": snapshot.scanned_count,
            "picks_count": snapshot.picks_count,
            "max_sq_count": snapshot.max_sq_count,
            "buy_count": snapshot.buy_count,
            "started_at": snapshot.started_at.isoformat() if snapshot.started_at else None,
            "completed_at": snapshot.completed_at.isoformat() if snapshot.completed_at else None,
            "picks": picks_by_market,
            "max_sq": max_sq_by_market,
            "chart_buy": {"items": chart_buy_items},
        }


async def get_snapshot_history(limit: int = 10) -> list[dict]:
    """최근 스냅샷 이력 조회."""
    async with async_session() as session:
        result = await session.execute(
            select(ScanSnapshot)
            .order_by(ScanSnapshot.started_at.desc())
            .limit(limit)
        )
        snapshots = result.scalars().all()
        return [
            {
                "id": s.id,
                "status": s.status,
                "total_symbols": s.total_symbols,
                "scanned_count": s.scanned_count,
                "picks_count": s.picks_count,
                "max_sq_count": s.max_sq_count,
                "buy_count": s.buy_count,
                "error_message": s.error_message,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                "elapsed_seconds": round((s.completed_at - s.started_at).total_seconds())
                    if s.completed_at and s.started_at else None,
            }
            for s in snapshots
        ]


async def _cleanup_old_snapshots():
    """오래된 스냅샷 삭제 (최근 MAX_SNAPSHOTS개만 보관)."""
    async with async_session() as session:
        result = await session.execute(
            select(ScanSnapshot.id)
            .order_by(ScanSnapshot.started_at.desc())
            .offset(MAX_SNAPSHOTS)
        )
        old_ids = [row[0] for row in result.all()]
        if old_ids:
            await session.execute(
                delete(ScanSnapshotItem).where(ScanSnapshotItem.snapshot_id.in_(old_ids))
            )
            await session.execute(
                delete(ScanSnapshot).where(ScanSnapshot.id.in_(old_ids))
            )
            await session.commit()
            logger.info(f"오래된 스냅샷 {len(old_ids)}개 삭제")
