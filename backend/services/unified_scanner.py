"""통합 시장 스캔 — 1회 다운로드로 추천/MAX SQ/차트 BUY 3개 결과 동시 생성."""

import asyncio
from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf
from loguru import logger

from indicators.bollinger import calculate_bb, detect_squeeze
from indicators.ema import calculate_ema
from indicators.macd import calculate_macd
from indicators.rsi import calculate_rsi
from indicators.volume import calculate_volume_ratio

# 캐시
_cache: dict = {}
_scan_time: str | None = None
_scanning = False
_scan_started_at: float = 0  # 스캔 시작 시간 (타임아웃 감지용)

SCAN_MIN_CANDLES = 60


_CRYPTO = {
    "BTC-USD": ("BTC/USDT", "Bitcoin"),
    "ETH-USD": ("ETH/USDT", "Ethereum"),
    "SOL-USD": ("SOL/USDT", "Solana"),
    "BNB-USD": ("BNB/USDT", "BNB"),
    "XRP-USD": ("XRP/USDT", "Ripple"),
    "ADA-USD": ("ADA/USDT", "Cardano"),
    "DOGE-USD": ("DOGE/USDT", "Dogecoin"),
    "AVAX-USD": ("AVAX/USDT", "Avalanche"),
    "LINK-USD": ("LINK/USDT", "Chainlink"),
    "DOT-USD": ("DOT/USDT", "Polkadot"),
}


async def _get_all_stocks() -> dict[str, dict]:
    """scan_symbols_list 기준 전체 종목 로드 (full_market_scanner 공용 함수 재사용)."""
    from services.full_market_scanner import _load_symbols
    symbol_list = await _load_symbols()  # markets=None → KR+US+CRYPTO 전체
    return {
        s["ticker"]: {
            "name": s["name"],
            "symbol": s["symbol"],
            "market": s["market"],
            "market_type": s["market_type"],
        }
        for s in symbol_list
    }


def _batch_download(tickers: list[str]) -> pd.DataFrame | None:
    import concurrent.futures
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(
                yf.download, tickers,
                period="2y", interval="1d", progress=False, auto_adjust=True, threads=True
            )
            return future.result(timeout=180)  # 3분 초과 시 포기
    except concurrent.futures.TimeoutError:
        logger.error(f"통합 스캔 배치 다운로드 타임아웃 (3분 초과, {len(tickers)}개 종목)")
        return None
    except Exception as e:
        logger.error(f"통합 스캔 배치 다운로드 실패: {e}")
        return None


def _extract(df_all: pd.DataFrame, ticker: str) -> pd.DataFrame | None:
    try:
        if isinstance(df_all.columns, pd.MultiIndex):
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


def _is_dead_cross(ema: dict) -> bool:
    """EMA 20 < EMA 50이면 데드크로스."""
    e20 = ema.get("ema_20")
    e50 = ema.get("ema_50")
    if e20 is None or e50 is None:
        return False
    try:
        return float(e20.iloc[-1]) < float(e50.iloc[-1])
    except Exception:
        return False


def _check_trend(df: pd.DataFrame, ema: dict) -> str:
    e20 = ema.get("ema_20")
    e50 = ema.get("ema_50")
    e200 = ema.get("ema_200")
    if e20 is None or e50 is None or e200 is None:
        return "NEUTRAL"
    if len(e20.dropna()) < 10:
        return "NEUTRAL"
    price = float(df["close"].iloc[-1])
    last_e20 = float(e20.iloc[-1])
    last_e50 = float(e50.iloc[-1])
    last_e200 = float(e200.iloc[-1])
    e20_recent = e20.dropna().tail(5)
    e20_slope = (float(e20_recent.iloc[-1]) - float(e20_recent.iloc[0])) if len(e20_recent) >= 5 else 0
    if last_e20 > last_e50 > last_e200 and price > last_e20 and e20_slope > 0:
        return "BULL"
    if last_e20 < last_e50 < last_e200 and price < last_e20:
        return "BEAR"
    return "NEUTRAL"


def get_scan_status() -> dict:
    """현재 스캔 진행 상태를 반환."""
    global _scanning
    import time
    elapsed = round(time.time() - _scan_started_at) if _scanning and _scan_started_at else 0
    # 상태 조회 시에도 고착 감지 — scan_all() 재호출 없이도 자동 해제
    if _scanning and _scan_started_at and time.time() - _scan_started_at > 300:
        logger.warning(f"스캔 고착 감지 ({elapsed}초 경과) — 상태 조회 중 강제 해제")
        _scanning = False
        elapsed = 0
    return {
        "scanning": _scanning,
        "elapsed_seconds": elapsed,
        "scan_time": _scan_time,
        "has_cache": bool(_cache),
    }


def get_cache():
    return _cache, _scan_time


async def scan_all() -> dict:
    """1회 다운로드로 추천/MAX SQ/차트 BUY 3개 결과 동시 생성."""
    global _cache, _scan_time, _scanning, _scan_started_at
    import time

    if _scanning:
        # 5분 이상 스캔 중이면 고착으로 판단하고 강제 해제
        if time.time() - _scan_started_at > 300:
            logger.warning("스캔 플래그 고착 감지 (5분 초과) — 강제 해제")
            _scanning = False
        else:
            return _cache

    _scanning = True
    _scan_started_at = time.time()
    try:
        all_stocks = await _get_all_stocks()
        tickers = list(all_stocks.keys())
        logger.info(f"통합 스캔 시작: {len(tickers)}개 종목 다운로드...")

        df_all = await asyncio.to_thread(_batch_download, tickers)
        if df_all is None or df_all.empty:
            logger.warning("통합 스캔: 다운로드 실패")
            return _cache

        # 결과 수집 (시장별)
        picks_by_market: dict[str, list] = {"KOSPI": [], "KOSDAQ": [], "US": [], "CRYPTO": []}
        maxsq_by_market: dict[str, list] = {"KOSPI": [], "KOSDAQ": [], "US": [], "CRYPTO": []}
        buy_items = []

        from routes.charts import _calc_all, _simulate_signals

        scanned = 0
        for ticker in tickers:
            try:
                df = _extract(df_all, ticker)
                if df is None:
                    continue
                scanned += 1

                info = all_stocks[ticker]
                bb = calculate_bb(df)
                squeeze_series = detect_squeeze(df)
                rsi = calculate_rsi(df)
                macd = calculate_macd(df)
                vol = calculate_volume_ratio(df)
                ema = calculate_ema(df)

                # 데드크로스 제외
                if _is_dead_cross(ema):
                    continue

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

                score = last_sq * 25
                if trend == "BULL": score += 15
                if last_rsi < 40: score += 10
                if last_pctb < 0.3: score += 5
                if last_macd > 0: score += 5
                if last_vol > 1.0: score += 5

                sym = info["symbol"]
                name = info["name"]
                mtype = info["market_type"]

                item = {
                    "symbol": sym, "name": name, "market_type": mtype,
                    "price": round(price, 2), "change_pct": round(change, 2),
                    "rsi": round(last_rsi, 1), "bb_pct_b": round(last_pctb * 100, 1),
                    "bb_width": round(last_bbw * 100, 2), "squeeze_level": last_sq,
                    "macd_hist": round(last_macd, 4), "volume_ratio": round(last_vol, 1),
                    "confidence": round(score, 1), "trend": trend,
                    "trend_label": "상승추세" if trend == "BULL" else "하락추세" if trend == "BEAR" else "횡보",
                }

                # 1. 추천 종목 (MID/MAX SQ + 상승추세)
                if last_sq >= 2 and trend == "BULL":
                    picks_by_market.setdefault(mtype, []).append(item)

                # 2. MAX SQ (MAX SQ + 상승추세)
                if last_sq >= 3 and trend == "BULL":
                    maxsq_by_market.setdefault(mtype, []).append(item)

                # 3. 차트 BUY 신호 (일봉 3일 이내)
                timestamps = [int(idx.timestamp()) for idx in df.index]
                indicators_data, _, current = _calc_all(df, timestamps)
                markers = _simulate_signals(df, timestamps, indicators_data, "1d")
                if markers:
                    last_marker = markers[-1]
                    if last_marker["text"] in ("BUY", "SQZ BUY"):
                        signal_dt = datetime.utcfromtimestamp(last_marker["time"])
                        if (datetime.utcnow() - signal_dt) <= timedelta(days=3):
                            buy_items.append({
                                "symbol": sym, "display_name": name,
                                "market": info["market"], "market_type": mtype,
                                "last_signal": last_marker["text"],
                                "last_signal_date": signal_dt.strftime("%Y-%m-%d"),
                                "price": round(price, 2), "change_pct": round(change, 2),
                                "squeeze_level": current.get("squeeze_level", 0) if current else 0,
                                "rsi": round(current.get("rsi", 0), 1) if current and current.get("rsi") else None,
                                "trend": current.get("trend") if current else trend,
                            })

            except Exception:
                continue

        # 정렬 (스퀴즈 + 강도순)
        for lst in picks_by_market.values():
            lst.sort(key=lambda r: (r["squeeze_level"], r["confidence"]), reverse=True)
        for lst in maxsq_by_market.values():
            lst.sort(key=lambda r: (r["squeeze_level"], r["confidence"]), reverse=True)

        # 차트 BUY: 한국 2개 + 미국 1개
        kr_buy = [r for r in buy_items if r["market"] == "KR"][:2]
        us_buy = [r for r in buy_items if r["market"] == "US"][:2]

        _cache = {
            "picks": {
                "kospi": picks_by_market.get("KOSPI", [])[:3],
                "kosdaq": picks_by_market.get("KOSDAQ", [])[:3],
                "us": picks_by_market.get("US", [])[:3],
                "crypto": picks_by_market.get("CRYPTO", [])[:3],
                "scan_date": datetime.now().strftime("%Y-%m-%d"),
            },
            "max_sq": {
                "kospi": maxsq_by_market.get("KOSPI", [])[:5],
                "kosdaq": maxsq_by_market.get("KOSDAQ", [])[:5],
                "us": maxsq_by_market.get("US", [])[:5],
                "crypto": maxsq_by_market.get("CRYPTO", [])[:5],
            },
            "chart_buy": {
                "items": kr_buy + us_buy,
                "scan_time": datetime.utcnow().isoformat(),
            },
            "scanned": scanned,
        }
        _scan_time = datetime.utcnow().isoformat()

        total_picks = sum(len(v[:3]) for v in picks_by_market.values())
        total_maxsq = sum(len(v[:5]) for v in maxsq_by_market.values())
        total_buy = len(kr_buy) + len(us_buy)
        logger.info(f"통합 스캔 완료: {scanned}개 분석 | 추천 {total_picks} | MAX SQ {total_maxsq} | BUY {total_buy}")

    except Exception as e:
        logger.error(f"통합 스캔 실패: {e}")
    finally:
        _scanning = False

    return _cache


