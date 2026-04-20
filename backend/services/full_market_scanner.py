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
from services.scan_conditions import (
    MIN_CANDLES,
    check_buy_signal_precise,
    check_trend,
    is_dead_cross,
    is_large_cap,
    is_pullback,
)

CHUNK_SIZE = 100
MAX_SNAPSHOTS = 10  # 보관할 최대 스냅샷 수

# 진행 상태 (메모리)
_progress: dict = {
    "running": False,
    "total_chunks": 0,
    "completed_chunks": 0,
    "scanned_count": 0,
    "total_symbols": 0,
    "started_at": None,
    "current_snapshot_id": None,
    "live_chart_buy_count": 0,
    "live_pullback_buy_count": 0,
    "markets": None,  # ["KR"] / ["US", "CRYPTO"] / None(전체)
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
        "current_snapshot_id": _progress.get("current_snapshot_id"),
        "live_chart_buy_count": _progress.get("live_chart_buy_count", 0),
        "live_pullback_buy_count": _progress.get("live_pullback_buy_count", 0),
        "elapsed_seconds": elapsed,
        "markets": _progress.get("markets"),
        "live_dead_cross": _progress.get("live_dead_cross", 0),
        "live_alive": _progress.get("live_alive", 0),
    }


async def _load_symbols(markets: list[str] | None = None) -> list[dict]:
    """큐레이션 종목 리스트 로드. markets=None이면 전체, 아니면 해당 시장만.

    markets 예시:
      ["KR"]            — 국내만 (코스피200+코스닥150+KRX섹터)
      ["US", "CRYPTO"]  — 미국+암호화폐 (S&P500+나스닥100+10코인)
      None              — 전체
    """
    from services.scan_symbols_list import ALL_KR_SYMBOLS, ALL_US_TICKERS

    include_kr = markets is None or "KR" in markets
    include_us = markets is None or "US" in markets
    include_crypto = markets is None or "CRYPTO" in markets

    symbols = []
    async with async_session() as session:
        if include_kr:
            result = await session.execute(
                select(StockMaster).where(
                    StockMaster.market == "KR",
                    StockMaster.symbol.in_(ALL_KR_SYMBOLS),
                )
            )
            for row in result.scalars().all():
                suffix = ".KS" if row.market_type == "KOSPI" else ".KQ"
                symbols.append({
                    "ticker": f"{row.symbol}{suffix}",
                    "symbol": row.symbol,
                    "name": row.name,
                    "market": "KR",
                    "market_type": row.market_type,
                    "is_etf": row.is_etf,
                })

        if include_us:
            result = await session.execute(
                select(StockMaster).where(
                    StockMaster.market == "US",
                    StockMaster.symbol.in_(ALL_US_TICKERS),
                )
            )
            found_us: dict[str, StockMaster] = {row.symbol: row for row in result.scalars().all()}
            for ticker in sorted(ALL_US_TICKERS):
                row = found_us.get(ticker)
                symbols.append({
                    "ticker": ticker,
                    "symbol": ticker,
                    "name": row.name if row else ticker,
                    "market": "US",
                    "market_type": "US",
                })

    if include_crypto:
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
        return yf.download(tickers, period="1y", interval="1d", progress=False, auto_adjust=True, threads=False, timeout=60)
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
        return df if len(df) >= MIN_CANDLES else None
    except Exception:
        return None


def _has_volume_spike_recent(df: pd.DataFrame, lookback: int = 10) -> bool:
    """최근 lookback 거래일(기본 10) 중 한 봉이라도
    '당일 거래량 > 직전 5거래일 평균 × 1.5'를 만족하면 True.

    데이터 부족(봉 수 < 6) 시 False. CRYPTO 제외는 호출부에서 처리.
    """
    n = len(df)
    if n < 6:
        return False
    start = max(1, n - lookback)  # 첫 봉은 prior가 없어 제외
    vols = df["volume"]
    for i in range(start, n):
        prior = vols.iloc[max(0, i - 5):i]
        prior_nonzero = prior[prior > 0]
        if len(prior_nonzero) < 1:
            continue
        day_vol = float(vols.iloc[i])
        if day_vol <= 0:
            continue
        if day_vol > float(prior_nonzero.mean()) * 1.5:
            return True
    return False


def _passes_volume_filter(df: pd.DataFrame, buy_date: str) -> bool:
    """BUY 신호 발생일 거래량이 직전 5거래일 평균보다 높은지 확인.

    데이터 부족(신규상장, 거래정지 후 재개, 거래량 0) 시 True 반환(필터 건너뜀).
    """
    from datetime import datetime as dt
    signal_date = dt.strptime(buy_date, "%Y-%m-%d").date()
    matching = [i for i, idx in enumerate(df.index) if idx.date() == signal_date]
    if not matching:
        return True
    signal_idx = matching[0]
    if signal_idx < 1:
        return True
    prior = df["volume"].iloc[max(0, signal_idx - 5):signal_idx]
    prior_nonzero = prior[prior > 0]
    if len(prior_nonzero) < 1:
        return True
    avg_vol = float(prior_nonzero.mean())
    signal_vol = float(df["volume"].iloc[signal_idx])
    if signal_vol == 0:
        return True
    return signal_vol > avg_vol * 1.5


def _analyze_ticker(df: pd.DataFrame, info: dict) -> dict | None:
    """단일 종목 지표 계산 + 분류."""
    try:
        bb = calculate_bb(df)
        squeeze_series = detect_squeeze(df)
        rsi = calculate_rsi(df)
        macd = calculate_macd(df)
        vol = calculate_volume_ratio(df)
        ema = calculate_ema(df)

        if is_dead_cross(ema):
            return "dead_cross"

        trend = check_trend(df, ema)
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

        # chart_buy: 20거래일 이내 BUY/SQZ BUY + 거래량 필터 (dead cross는 위에서 이미 제외)
        buy_signal, buy_date = check_buy_signal_precise(df, last_rsi, last_sq)
        if buy_signal:
            categories.append("chart_buy")
            # pullback_buy: chart_buy 조건 + 눌림목 필터 + 대형주 필터
            if is_pullback(ema) and is_large_cap(info["symbol"], info["market"], info.get("is_etf", False)):
                categories.append("pullback_buy")
            logger.debug(f"[chart_buy] {info['symbol']} signal={buy_signal} date={buy_date} pullback={'pullback_buy' in categories}")

        # 투자과열: RSI >= 70 또는 (RSI >= 65 + 거래량 2배+) — 한국 개별주, 거래량 있는 종목만
        if info["market"] == "KR" and not info.get("is_etf", False) and last_vol >= 0.1:
            if last_rsi >= 70 or (last_rsi >= 65 and last_vol >= 2.0):
                categories.append("overheat")

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


async def run_full_scan(markets: list[str] | None = None) -> dict:
    """시장 스캔 실행 — 청크 단위 다운로드 + DB 스냅샷 저장.

    markets=["KR"]           → 국내만 (코스피200+코스닥150+KRX섹터, ~351종목)
    markets=["US","CRYPTO"]  → 미국+암호화폐 (S&P500+나스닥100+10코인, ~522종목)
    markets=None             → 전체 (~873종목)
    """
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
    _progress["current_snapshot_id"] = None
    _progress["live_chart_buy_count"] = 0
    _progress["live_pullback_buy_count"] = 0
    _progress["live_dead_cross"] = 0
    _progress["live_alive"] = 0
    _progress["markets"] = markets

    # 스냅샷 생성
    async with async_session() as session:
        snapshot = ScanSnapshot(status="running", started_at=datetime.utcnow())
        session.add(snapshot)
        await session.commit()
        await session.refresh(snapshot)
        snapshot_id = snapshot.id
        _progress["current_snapshot_id"] = snapshot_id

    try:
        symbols = await _load_symbols(markets)
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
        dead_cross_count = 0
        alive_count = 0
        volume_spike_count = 0

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

            chunk_realtime: list[tuple[str, dict]] = []  # (category, item)
            for ticker in tickers:
                info = ticker_map[ticker]
                df = _extract(df_all, ticker)
                if df is None:
                    continue
                scanned += 1

                # chart_cache에 parquet 저장 (상세 페이지 즉시 로드용)
                try:
                    from services.chart_cache import _save_parquet
                    _save_parquet(info["symbol"], info["market_type"], "1d", df.copy())
                except Exception:
                    pass

                result = _analyze_ticker(df, info)
                # 거래량 급증 집계 — dead cross와 독립적으로 KR/US 전 종목 대상
                if info["market"] != "CRYPTO":
                    if _has_volume_spike_recent(df, lookback=10):
                        volume_spike_count += 1
                if result == "dead_cross":
                    if info["market"] != "CRYPTO":
                        dead_cross_count += 1
                    continue
                if info["market"] != "CRYPTO":
                    alive_count += 1
                if result:
                    all_items.append(result)
                    for cat in result["categories"]:
                        if cat in ("chart_buy", "pullback_buy"):
                            chunk_realtime.append((cat, result))

            # chart_buy / pullback_buy 즉시 DB 저장 (실시간 표시용)
            if chunk_realtime:
                try:
                    async with async_session() as s2:
                        for cat, item in chunk_realtime:
                            s2.add(ScanSnapshotItem(
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
                        await s2.commit()
                    _progress["live_chart_buy_count"] += sum(1 for c, _ in chunk_realtime if c == "chart_buy")
                    _progress["live_pullback_buy_count"] += sum(1 for c, _ in chunk_realtime if c == "pullback_buy")
                except Exception as e:
                    logger.warning(f"realtime 저장 실패 (청크 {ci + 1}): {e}")

            _progress["completed_chunks"] = ci + 1
            _progress["scanned_count"] = scanned
            _progress["live_dead_cross"] = dead_cross_count
            _progress["live_alive"] = alive_count

            if ci < len(chunks) - 1:
                await asyncio.sleep(1)  # rate limit 방지

        # DB 저장
        picks_count = 0
        max_sq_count = 0
        buy_count = 0

        pullback_count = 0
        async with async_session() as session:
            for item in all_items:
                for cat in item["categories"]:
                    if cat in ("chart_buy", "pullback_buy"):
                        # 이미 청크별로 저장됨 — 중복 방지
                        if cat == "chart_buy":
                            buy_count += 1
                        elif cat == "pullback_buy":
                            pullback_count += 1
                        continue
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

            # 스냅샷 완료 업데이트 (0건 분석이면 failed 처리)
            snap = await session.get(ScanSnapshot, snapshot_id)
            snap.status = "completed" if scanned > 0 else "failed"
            snap.total_symbols = total
            snap.scanned_count = scanned
            snap.picks_count = picks_count
            snap.max_sq_count = max_sq_count
            snap.buy_count = buy_count
            snap.dead_cross_count = dead_cross_count
            snap.alive_count = alive_count
            snap.volume_spike_count = volume_spike_count
            snap.completed_at = datetime.utcnow()
            await session.commit()

        # 오래된 스냅샷 정리
        await _cleanup_old_snapshots()

        elapsed = round(time.time() - _progress["started_at"])
        logger.info(
            f"전체 스캔 완료: {scanned}/{total} 분석 | "
            f"추천 {picks_count} | MAX SQ {max_sq_count} | BUY {buy_count} | 눌림목 {pullback_count} | "
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
            "pullback_buy": pullback_count,
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
        _progress["current_snapshot_id"] = None


def _cap_chart_buy(items: list[dict]) -> list[dict]:
    """cap 없이 전체 반환."""
    return items


async def get_latest_snapshot() -> dict | None:
    """최신 완료된 스냅샷 + 아이템 조회. 스캔 중이면 running snapshot의 chart_buy도 포함."""
    async with async_session() as session:
        # 스캔 진행 중: running snapshot의 chart_buy 실시간 조회
        live_chart_buy_items = []
        running_snap_id = _progress.get("current_snapshot_id")
        if _progress.get("running") and running_snap_id:
            live_result = await session.execute(
                select(ScanSnapshotItem)
                .where(
                    ScanSnapshotItem.snapshot_id == running_snap_id,
                    ScanSnapshotItem.category == "chart_buy",
                )
                .order_by(ScanSnapshotItem.confidence.desc())
            )
            for item in live_result.scalars().all():
                live_chart_buy_items.append({
                    "symbol": item.symbol, "name": item.name,
                    "market": item.market, "market_type": item.market_type,
                    "price": item.price, "change_pct": item.change_pct,
                    "rsi": item.rsi, "bb_pct_b": item.bb_pct_b,
                    "bb_width": item.bb_width, "squeeze_level": item.squeeze_level,
                    "macd_hist": item.macd_hist, "volume_ratio": item.volume_ratio,
                    "confidence": item.confidence, "trend": item.trend,
                    "last_signal": item.last_signal,
                    "last_signal_date": item.last_signal_date,
                })

        result = await session.execute(
            select(ScanSnapshot)
            .where(ScanSnapshot.status == "completed")
            .order_by(ScanSnapshot.completed_at.desc())
            .limit(1)
        )
        snapshot = result.scalar_one_or_none()

        # 완료 스냅샷 없고 running 중이면 live 데이터만 반환
        if not snapshot:
            if live_chart_buy_items:
                return {
                    "snapshot_id": running_snap_id,
                    "status": "running",
                    "total_symbols": _progress.get("total_symbols", 0),
                    "scanned_count": _progress.get("scanned_count", 0),
                    "picks_count": 0, "buy_count": len(live_chart_buy_items),
                    "started_at": None, "completed_at": None,
                    "picks": {},
                    "chart_buy": {"items": _cap_chart_buy(live_chart_buy_items)},
                    "pullback_buy": {"items": []},
                    "overheat": {"items": []},
                    "market_health": {
                        "dead_cross": _progress.get("live_dead_cross", 0),
                        "alive": _progress.get("live_alive", 0),
                    },
                }
            return None

        items_result = await session.execute(
            select(ScanSnapshotItem, StockMaster.is_etf)
            .outerjoin(
                StockMaster,
                (StockMaster.symbol == ScanSnapshotItem.symbol) &
                (StockMaster.market == ScanSnapshotItem.market),
            )
            .where(ScanSnapshotItem.snapshot_id == snapshot.id)
            .order_by(ScanSnapshotItem.confidence.desc())
        )
        rows = items_result.all()
        items = [r[0] for r in rows]
        is_etf_map: dict[str, bool] = {r[0].symbol: bool(r[1]) for r in rows}

        # 카테고리별 그룹핑 (picks + max_sq 통합)
        picks_by_market = {}
        picks_seen = set()
        chart_buy_items = []
        pullback_buy_items = []
        overheat_items = []

        for item in items:
            d = {
                "symbol": item.symbol, "name": item.name,
                "market": item.market, "market_type": item.market_type,
                "is_etf": is_etf_map.get(item.symbol, False),
                "price": item.price, "change_pct": item.change_pct,
                "rsi": item.rsi, "bb_pct_b": item.bb_pct_b,
                "bb_width": item.bb_width, "squeeze_level": item.squeeze_level,
                "macd_hist": item.macd_hist, "volume_ratio": item.volume_ratio,
                "confidence": item.confidence, "trend": item.trend,
                "last_signal": item.last_signal,
                "last_signal_date": item.last_signal_date,
            }
            if item.category in ("picks", "max_sq"):
                key = f"{item.market_type}:{item.symbol}"
                if key not in picks_seen:
                    picks_seen.add(key)
                    picks_by_market.setdefault(item.market_type.lower(), []).append(d)
            elif item.category == "chart_buy":
                chart_buy_items.append(d)
            elif item.category == "pullback_buy":
                pullback_buy_items.append(d)
            elif item.category == "overheat":
                overheat_items.append(d)

        # cap 없이 전체 반환 + 섹터 첨부
        final_chart_buy = _cap_chart_buy(live_chart_buy_items if live_chart_buy_items else chart_buy_items)
        final_pullback_buy = _cap_chart_buy(pullback_buy_items)

        # 대형주 여부 태깅 (chart_buy 아이템 기준)
        for item in final_chart_buy:
            item["is_large_cap"] = is_large_cap(item["symbol"], item["market"], item.get("is_etf", False))
        large_cap_buy_count = sum(1 for i in final_chart_buy if i.get("is_large_cap", False))

        # 업종(sector) 병렬 fetch — chart_buy + pullback_buy 합산 후 중복 제거
        try:
            from services.sector_cache import get_sectors
            all_for_sector = {i["symbol"]: i for i in (final_chart_buy + final_pullback_buy)}.values()
            sector_map = await get_sectors(list(all_for_sector))
            for lst in (final_chart_buy, final_pullback_buy):
                for i in lst:
                    i["sector"] = sector_map.get(i["symbol"], "기타")
        except Exception as e:
            logger.warning(f"업종 fetch 실패: {e}")

        # market_health는 alive/dead_cross 집계가 있는 최신 스냅샷에서 가져옴
        # (전체 스캔의 일부 경로는 집계 컬럼이 NULL로 저장될 수 있어, 가장 가까운
        #  집계-가능 스냅샷으로 폴백하여 UI의 EMA 추세 바 회귀를 방지)
        mh_dead = snapshot.dead_cross_count
        mh_alive = snapshot.alive_count
        mh_spike = snapshot.volume_spike_count
        if mh_dead is None or mh_alive is None:
            mh_result = await session.execute(
                select(ScanSnapshot)
                .where(
                    ScanSnapshot.status == "completed",
                    ScanSnapshot.alive_count.isnot(None),
                    ScanSnapshot.dead_cross_count.isnot(None),
                )
                .order_by(ScanSnapshot.completed_at.desc())
                .limit(1)
            )
            mh_snap = mh_result.scalar_one_or_none()
            if mh_snap:
                mh_dead = mh_snap.dead_cross_count
                mh_alive = mh_snap.alive_count
                if mh_spike is None:
                    mh_spike = mh_snap.volume_spike_count
        if mh_spike is None:
            spike_result = await session.execute(
                select(ScanSnapshot)
                .where(
                    ScanSnapshot.status == "completed",
                    ScanSnapshot.volume_spike_count.isnot(None),
                )
                .order_by(ScanSnapshot.completed_at.desc())
                .limit(1)
            )
            spike_snap = spike_result.scalar_one_or_none()
            if spike_snap:
                mh_spike = spike_snap.volume_spike_count

        return {
            "snapshot_id": snapshot.id,
            "status": "running" if _progress.get("running") else snapshot.status,
            "total_symbols": snapshot.total_symbols,
            "scanned_count": snapshot.scanned_count,
            "picks_count": snapshot.picks_count + snapshot.max_sq_count,
            "buy_count": len(final_chart_buy),
            "started_at": snapshot.started_at.isoformat() if snapshot.started_at else None,
            "completed_at": snapshot.completed_at.isoformat() if snapshot.completed_at else None,
            "picks": picks_by_market,
            "chart_buy": {"items": final_chart_buy, "total": snapshot.buy_count or len(chart_buy_items), "large_cap_count": large_cap_buy_count},
            "pullback_buy": {"items": final_pullback_buy},
            "overheat": {"items": overheat_items},
            "market_health": {
                "dead_cross": mh_dead or 0,
                "alive": mh_alive or 0,
                # volume_spike는 아직 집계되지 않은 경우(None) 프론트에서 바를 숨길 수 있도록 None 유지
                "volume_spike": mh_spike,
                # 거래량 급증 비율 분모 = alive + dead_cross (CRYPTO 제외 총 분석 종목)
                "volume_total": (mh_alive or 0) + (mh_dead or 0),
            },
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


async def get_snapshot_buy_items(snapshot_id: int) -> list[dict]:
    """특정 스냅샷의 차트 BUY 신호 종목 목록 반환."""
    async with async_session() as session:
        result = await session.execute(
            select(ScanSnapshotItem)
            .where(
                ScanSnapshotItem.snapshot_id == snapshot_id,
                ScanSnapshotItem.category == "chart_buy",
            )
            .order_by(ScanSnapshotItem.confidence.desc())
        )
        items = result.scalars().all()
        return [
            {
                "symbol": i.symbol,
                "name": i.name,
                "market_type": i.market_type,
                "price": i.price,
                "change_pct": i.change_pct,
                "rsi": round(i.rsi, 1) if i.rsi else None,
                "squeeze_level": i.squeeze_level,
                "confidence": round(i.confidence, 1) if i.confidence else None,
                "last_signal_date": i.last_signal_date,
            }
            for i in items
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
