"""시장분위기 집계 서비스.

EMA 정배열/역배열 비율 + 거래량 급등 비율을 KR/US/CRYPTO 시장별로 산출.
스케줄러가 주기적으로 DB 스냅샷을 저장하고, API는 최신 스냅샷을 즉시 반환.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

import pandas as pd
import yfinance as yf
from loguru import logger
from sqlalchemy import delete, select

from database import async_session
from indicators.ema import calculate_ema
from models import MarketSentimentSnapshot, StockMaster
from schemas.market_sentiment import (
    EmaAlignmentStats,
    MarketSentimentByMarket,
    MarketSentimentResponse,
    VolumeSpikeStats,
    VolumeSpikePeriod,
)

_EMA_MIN_CANDLES = 120
_VOL_AVG_DAYS = 20
_VOL_SPIKE_RATIO = 3.0
_LOOKBACK_PERIODS = [20, 30, 60]
_DOWNLOAD_PERIOD = "1y"
_SNAPSHOT_KEEP = 10

_CRYPTO_TICKERS = [
    "BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD",
    "ADA-USD", "DOGE-USD", "AVAX-USD", "LINK-USD", "DOT-USD",
]


def _is_golden(ema: dict) -> bool:
    """EMA5 > EMA10 > EMA20 > EMA60 > EMA120 최신값 비교."""
    keys = ["ema_5", "ema_10", "ema_20", "ema_60", "ema_120"]
    vals: list[float] = []
    for k in keys:
        s = ema.get(k)
        if s is None or len(s.dropna()) == 0:
            return False
        vals.append(float(s.dropna().iloc[-1]))
    return all(vals[i] > vals[i + 1] for i in range(len(vals) - 1))


def _is_death(ema: dict) -> bool:
    """EMA5 < EMA10 < EMA20 < EMA60 < EMA120 최신값 비교."""
    keys = ["ema_5", "ema_10", "ema_20", "ema_60", "ema_120"]
    vals: list[float] = []
    for k in keys:
        s = ema.get(k)
        if s is None or len(s.dropna()) == 0:
            return False
        vals.append(float(s.dropna().iloc[-1]))
    return all(vals[i] < vals[i + 1] for i in range(len(vals) - 1))


def _compute_ema_alignment(tickers: list[str]) -> EmaAlignmentStats:
    """배치 다운로드 후 EMA 정배열/역배열 집계."""
    golden = death = other = total = 0

    if not tickers:
        return EmaAlignmentStats(
            golden=0, death=0, other=0, total=0,
            golden_pct=0.0, death_pct=0.0, other_pct=0.0,
        )

    try:
        df_all = yf.download(
            tickers, period=_DOWNLOAD_PERIOD, interval="1d",
            progress=False, auto_adjust=True, threads=False, timeout=60,
        )
    except Exception as e:
        logger.error(f"EMA download error: {e}")
        return EmaAlignmentStats(
            golden=0, death=0, other=0, total=0,
            golden_pct=0.0, death_pct=0.0, other_pct=0.0,
        )

    for ticker in tickers:
        try:
            if isinstance(df_all.columns, pd.MultiIndex):
                if ticker not in df_all.columns.get_level_values("Ticker"):
                    continue
                df = df_all.xs(ticker, level="Ticker", axis=1)
            else:
                df = df_all

            df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
            df.columns = ["open", "high", "low", "close", "volume"]
            df = df.dropna(subset=["close"])
            if len(df) < _EMA_MIN_CANDLES:
                continue

            ema = calculate_ema(df)
            total += 1
            if _is_golden(ema):
                golden += 1
            elif _is_death(ema):
                death += 1
            else:
                other += 1
        except Exception:
            continue

    if total == 0:
        return EmaAlignmentStats(
            golden=0, death=0, other=0, total=0,
            golden_pct=0.0, death_pct=0.0, other_pct=0.0,
        )

    return EmaAlignmentStats(
        golden=golden,
        death=death,
        other=other,
        total=total,
        golden_pct=round(golden / total * 100, 1),
        death_pct=round(death / total * 100, 1),
        other_pct=round(other / total * 100, 1),
    )


def _compute_volume_spike(tickers: list[str], sectors: dict[str, str]) -> VolumeSpikeStats:
    """거래량 급등 종목 비율 + 상위 섹터 집계."""
    if not tickers:
        return VolumeSpikeStats(periods=[
            VolumeSpikePeriod(period_days=p, spike_count=0, total=0, spike_pct=0.0, top_sector="기타")
            for p in _LOOKBACK_PERIODS
        ])

    try:
        df_all = yf.download(
            tickers, period=_DOWNLOAD_PERIOD, interval="1d",
            progress=False, auto_adjust=True, threads=False, timeout=60,
        )
    except Exception as e:
        logger.error(f"Volume download error: {e}")
        return VolumeSpikeStats(periods=[
            VolumeSpikePeriod(period_days=p, spike_count=0, total=0, spike_pct=0.0, top_sector="기타")
            for p in _LOOKBACK_PERIODS
        ])

    vol_map: dict[str, pd.Series] = {}
    for ticker in tickers:
        try:
            if isinstance(df_all.columns, pd.MultiIndex):
                if ticker not in df_all.columns.get_level_values("Ticker"):
                    continue
                df = df_all.xs(ticker, level="Ticker", axis=1)
            else:
                df = df_all

            vol = df["Volume"].dropna() if "Volume" in df.columns else pd.Series(dtype=float)
            if len(vol) > _VOL_AVG_DAYS:
                vol_map[ticker] = vol
        except Exception:
            continue

    valid_tickers = list(vol_map.keys())
    total_count = len(valid_tickers)

    periods_result: list[VolumeSpikePeriod] = []
    for period in _LOOKBACK_PERIODS:
        spike_tickers: list[str] = []
        for ticker, vol in vol_map.items():
            try:
                avg_20 = vol.iloc[-(period + _VOL_AVG_DAYS):-period].replace(0, pd.NA).dropna().mean()
                if pd.isna(avg_20) or avg_20 <= 0:
                    continue
                lookback = vol.iloc[-period:]
                if (lookback > avg_20 * _VOL_SPIKE_RATIO).any():
                    spike_tickers.append(ticker)
            except Exception:
                continue

        sector_counts = Counter(sectors.get(t, "기타") for t in spike_tickers)
        top_sector = sector_counts.most_common(1)[0][0] if sector_counts else "기타"

        periods_result.append(VolumeSpikePeriod(
            period_days=period,
            spike_count=len(spike_tickers),
            total=total_count,
            spike_pct=round(len(spike_tickers) / total_count * 100, 1) if total_count else 0.0,
            top_sector=top_sector,
        ))

    return VolumeSpikeStats(periods=periods_result)


async def _get_market_tickers_and_sectors(market: str) -> tuple[list[str], dict[str, str]]:
    """시장별 ticker 목록 + sector 매핑 반환."""
    if market == "CRYPTO":
        sectors = {t: "암호화폐" for t in _CRYPTO_TICKERS}
        return _CRYPTO_TICKERS, sectors

    from services.scan_symbols_list import ALL_KR_SYMBOLS, ALL_US_TICKERS

    target_set = ALL_KR_SYMBOLS if market == "KR" else ALL_US_TICKERS

    async with async_session() as session:
        rows = (await session.execute(
            select(StockMaster.symbol, StockMaster.sector)
            .where(StockMaster.market == market)
        )).all()

    tickers: list[str] = []
    sectors: dict[str, str] = {}
    for sym, sec in rows:
        if sym in target_set:
            tickers.append(sym)
            sectors[sym] = sec or "기타"

    return tickers, sectors


def _market_by_market_to_dict(m: MarketSentimentByMarket) -> dict:
    return {
        "ema_alignment": m.ema_alignment.model_dump(),
        "volume_spike": m.volume_spike.model_dump(),
    }


async def compute_and_save_snapshot(market: str | None = None) -> str:
    """시장분위기 집계 후 DB 스냅샷 저장. market=None이면 전체(KR/US/CRYPTO) 계산."""
    markets = ["KR", "US", "CRYPTO"] if market is None else [market]

    async with async_session() as session:
        # 최신 스냅샷 로드 (부분 업데이트를 위해)
        row = (await session.execute(
            select(MarketSentimentSnapshot).order_by(MarketSentimentSnapshot.id.desc()).limit(1)
        )).scalars().first()

        kr_data = row.kr_data if row else None
        us_data = row.us_data if row else None
        crypto_data = row.crypto_data if row else None

    for mkt in markets:
        logger.info(f"market_sentiment snapshot: {mkt} 집계 시작")
        tickers, sectors = await _get_market_tickers_and_sectors(mkt)

        ema_stats = _compute_ema_alignment(tickers)
        vol_stats = _compute_volume_spike(tickers, sectors)

        by_market = MarketSentimentByMarket(ema_alignment=ema_stats, volume_spike=vol_stats)
        data = _market_by_market_to_dict(by_market)

        if mkt == "KR":
            kr_data = data
        elif mkt == "US":
            us_data = data
        else:
            crypto_data = data

        logger.info(f"market_sentiment snapshot: {mkt} 완료 — golden={ema_stats.golden}, death={ema_stats.death}")

    async with async_session() as session:
        snapshot = MarketSentimentSnapshot(
            kr_data=kr_data,
            us_data=us_data,
            crypto_data=crypto_data,
        )
        session.add(snapshot)
        await session.flush()
        new_id = snapshot.id

        # 오래된 스냅샷 정리 (최신 _SNAPSHOT_KEEP개만 유지)
        old_ids = (await session.execute(
            select(MarketSentimentSnapshot.id)
            .order_by(MarketSentimentSnapshot.id.desc())
            .offset(_SNAPSHOT_KEEP)
        )).scalars().all()
        if old_ids:
            await session.execute(
                delete(MarketSentimentSnapshot).where(MarketSentimentSnapshot.id.in_(old_ids))
            )
        await session.commit()

    return f"snapshot id={new_id} saved (markets={markets})"


async def get_latest_snapshot() -> MarketSentimentResponse | None:
    """DB에서 최신 스냅샷 조회. 없으면 None 반환."""
    async with async_session() as session:
        row = (await session.execute(
            select(MarketSentimentSnapshot).order_by(MarketSentimentSnapshot.id.desc()).limit(1)
        )).scalars().first()

    if row is None:
        return None

    def _parse(data: dict | None) -> MarketSentimentByMarket:
        if not data:
            return MarketSentimentByMarket(
                ema_alignment=EmaAlignmentStats(golden=0, death=0, other=0, total=0, golden_pct=0.0, death_pct=0.0, other_pct=0.0),
                volume_spike=VolumeSpikeStats(periods=[
                    VolumeSpikePeriod(period_days=p, spike_count=0, total=0, spike_pct=0.0, top_sector="기타")
                    for p in _LOOKBACK_PERIODS
                ]),
            )
        return MarketSentimentByMarket(**data)

    return MarketSentimentResponse(
        KR=_parse(row.kr_data),
        US=_parse(row.us_data),
        CRYPTO=_parse(row.crypto_data),
        computed_at=row.created_at.isoformat(),
    )
