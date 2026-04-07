"""전체 시장 차트 마커 기반 최근 BUY 신호 종목 스캔.

코스피/코스닥/미국 전체 주요 종목을 주봉 기준으로 스캔하여
마지막 마커가 BUY/SQZ BUY이고 3일 이내인 종목만 반환.
"""

import asyncio
from datetime import datetime

import pandas as pd
import yfinance as yf
from loguru import logger

# 메모리 캐시
_latest_buy_cache: list[dict] = []
_last_scan_time: str | None = None
_scanning = False


async def _get_all_stocks() -> dict[str, dict]:
    """scan_symbols_list 기준 전체 종목 로드 (full_market_scanner 공용 함수 재사용)."""
    from services.full_market_scanner import _load_symbols
    symbol_list = await _load_symbols(["KR", "US"])  # CRYPTO 제외
    return {
        s["ticker"]: {
            "name": s["name"],
            "symbol": s["symbol"],
            "market": s["market"],
            "market_type": s["market_type"],
        }
        for s in symbol_list
    }


def _batch_download_daily(tickers: list[str]) -> pd.DataFrame | None:
    try:
        return yf.download(tickers, period="2y", interval="1d", progress=False, auto_adjust=True, threads=False)
    except Exception as e:
        logger.error(f"일봉 배치 다운로드 실패: {e}")
        return None


def _extract_ticker(df_all: pd.DataFrame, ticker: str) -> pd.DataFrame | None:
    try:
        if isinstance(df_all.columns, pd.MultiIndex):
            df = df_all.xs(ticker, level="Ticker", axis=1)
        else:
            df = df_all
        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.columns = ["open", "high", "low", "close", "volume"]
        df = df.dropna(subset=["close"])
        df = df[(df["open"] > 0) & (df["high"] > 0) & (df["low"] > 0)]
        return df if len(df) >= 35 else None
    except Exception:
        return None


async def scan_latest_buy(timeframe: str = "1d") -> list[dict]:
    """전체 시장에서 차트 마지막 신호가 BUY/SQZ BUY (3일 이내)인 종목 반환."""
    global _latest_buy_cache, _last_scan_time, _scanning

    if _scanning:
        return _latest_buy_cache

    _scanning = True
    results = []

    try:
        all_stocks = await _get_all_stocks()
        tickers = list(all_stocks.keys())
        logger.info(f"차트 BUY 스캔 시작: {len(tickers)}개 종목 일봉 다운로드...")

        df_all = await asyncio.to_thread(_batch_download_daily, tickers)
        if df_all is None or df_all.empty:
            logger.warning("차트 BUY 스캔: 다운로드 실패")
            return _latest_buy_cache

        from routes.charts import _calc_all, _simulate_signals

        scanned = 0
        for ticker in tickers:
            try:
                df = _extract_ticker(df_all, ticker)
                if df is None:
                    continue

                scanned += 1
                timestamps = [int(idx.timestamp()) for idx in df.index]
                indicators, _, current = _calc_all(df, timestamps)
                markers = _simulate_signals(df, timestamps, indicators, timeframe)

                if not markers:
                    continue

                last = markers[-1]
                if last["text"] not in ("BUY", "SQZ BUY"):
                    continue

                # 10거래일 이내 (df는 실제 거래일만 포함 → 주말·공휴일 자동 제외)
                signal_dt = datetime.utcfromtimestamp(last["time"])
                signal_date = signal_dt.date()
                sig_matching = [i for i, idx in enumerate(df.index) if idx.date() == signal_date]
                if not sig_matching:
                    continue
                if len(df) - 1 - sig_matching[0] > 10:
                    continue

                # 거래량 필터: 신호일 거래량 > 직전 5거래일 평균
                from services.full_market_scanner import _passes_volume_filter
                if not _passes_volume_filter(df, signal_dt.strftime("%Y-%m-%d")):
                    continue

                info = all_stocks[ticker]
                last_close = float(df["close"].iloc[-1])
                last_open = float(df["open"].iloc[-1])
                change_pct = ((last_close - last_open) / last_open * 100) if last_open else 0

                results.append({
                    "symbol": info["symbol"],
                    "display_name": info["name"],
                    "market": info["market"],
                    "market_type": info["market_type"],
                    "last_signal": last["text"],
                    "last_signal_date": datetime.utcfromtimestamp(last["time"]).strftime("%Y-%m-%d"),
                    "price": round(last_close, 2),
                    "change_pct": round(change_pct, 2),
                    "squeeze_level": current.get("squeeze_level", 0) if current else 0,
                    "rsi": round(current.get("rsi", 0), 1) if current and current.get("rsi") else None,
                    "trend": current.get("trend") if current else None,
                })

            except Exception:
                continue

        # 한국 2개 + 미국 1개 제한
        kr_items = [r for r in results if r["market"] == "KR"][:2]
        us_items = [r for r in results if r["market"] == "US"][:1]
        results = kr_items + us_items

        _latest_buy_cache = results
        _last_scan_time = datetime.utcnow().isoformat()
        logger.info(f"차트 BUY 스캔 완료: {scanned}개 분석, {len(results)}개 BUY 신호 (일봉 3일 이내)")

    except Exception as e:
        logger.error(f"차트 BUY 스캔 실패: {e}")
    finally:
        _scanning = False

    return results


def get_cache() -> tuple[list[dict], str | None]:
    """캐시된 결과 반환."""
    return _latest_buy_cache, _last_scan_time
