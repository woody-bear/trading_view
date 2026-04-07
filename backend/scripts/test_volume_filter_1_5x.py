"""
현재 DB의 chart_buy 스냅샷 결과를 1.5x 거래량 필터로 재검증.
기존: signal_vol > avg_vol
변경: signal_vol > avg_vol * 1.5
"""

import sys
import os
from pathlib import Path

# backend 경로 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

import sqlite3
import pandas as pd
from datetime import datetime

DB_PATH = Path(__file__).parent.parent / "data" / "ubb_pro.db"
CACHE_DIR = Path(__file__).parent.parent / "data" / "charts"


def load_latest_chart_buy() -> list[dict]:
    """최신 completed 스냅샷의 chart_buy 종목 목록 로드."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 최신 completed 스냅샷 ID
    cur.execute(
        "SELECT id FROM scan_snapshot WHERE status='completed' ORDER BY completed_at DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        print("완료된 스냅샷 없음")
        conn.close()
        return []

    snapshot_id = row[0]
    print(f"스냅샷 ID: {snapshot_id}")

    cur.execute(
        """SELECT symbol, name, market, market_type, last_signal_date, volume_ratio
           FROM scan_snapshot_item
           WHERE snapshot_id=? AND category='chart_buy'
           ORDER BY confidence DESC""",
        (snapshot_id,),
    )
    rows = cur.fetchall()
    conn.close()

    return [
        {
            "symbol": r[0],
            "name": r[1],
            "market": r[2],
            "market_type": r[3],
            "last_signal_date": r[4],
            "volume_ratio_stored": r[5],
        }
        for r in rows
    ]


def load_parquet(symbol: str, market_type: str) -> pd.DataFrame | None:
    """캐시된 parquet 파일 로드."""
    norm_market = "KR" if market_type in ("KOSPI", "KOSDAQ") else market_type
    safe_symbol = symbol.replace("/", "_")
    path = CACHE_DIR / f"{norm_market}_{safe_symbol}_1d.parquet"
    if not path.exists():
        return None
    try:
        df = pd.read_parquet(path)
        if df.empty or len(df) < 10:
            return None
        return df
    except Exception as e:
        print(f"  parquet 읽기 실패 ({symbol}): {e}")
        return None


def passes_volume_filter(df: pd.DataFrame, buy_date: str, multiplier: float) -> tuple[bool, float, float]:
    """
    BUY 신호 발생일 거래량 > 직전 5거래일 평균 * multiplier
    Returns: (pass, signal_vol, avg_vol)
    """
    try:
        signal_date = datetime.strptime(buy_date, "%Y-%m-%d").date()
    except Exception:
        return True, 0, 0

    matching = [i for i, idx in enumerate(df.index) if idx.date() == signal_date]
    if not matching:
        return True, 0, 0  # 날짜 없으면 통과 (데이터 부족)

    signal_idx = matching[0]
    if signal_idx < 1:
        return True, 0, 0

    prior = df["volume"].iloc[max(0, signal_idx - 5):signal_idx]
    prior_nonzero = prior[prior > 0]
    if len(prior_nonzero) < 1:
        return True, 0, 0

    avg_vol = float(prior_nonzero.mean())
    signal_vol = float(df["volume"].iloc[signal_idx])
    if signal_vol == 0:
        return True, 0, 0

    return signal_vol > avg_vol * multiplier, signal_vol, avg_vol


def main():
    items = load_latest_chart_buy()
    print(f"현재 chart_buy 종목 수: {len(items)}\n")

    if not items:
        return

    passed_1x = []
    passed_1_5x = []
    no_cache = []

    for item in items:
        sym = item["symbol"]
        mtype = item["market_type"]
        buy_date = item["last_signal_date"]

        df = load_parquet(sym, mtype)
        if df is None:
            no_cache.append(item)
            continue

        ok_1x, sv, av = passes_volume_filter(df, buy_date, 1.0)
        ok_1_5x, _, _ = passes_volume_filter(df, buy_date, 1.5)

        ratio_str = f"{sv/av:.2f}x" if av > 0 else "N/A"

        item_with_ratio = {**item, "vol_ratio_signal_vs_avg": ratio_str, "signal_vol": sv, "avg_vol": av}

        if ok_1x:
            passed_1x.append(item_with_ratio)
        if ok_1_5x:
            passed_1_5x.append(item_with_ratio)

    print("=" * 60)
    print(f"기존 필터 통과 (>1x):   {len(passed_1x)}개")
    print(f"신규 필터 통과 (>1.5x): {len(passed_1_5x)}개")
    print(f"캐시 없음 (제외):       {len(no_cache)}개")
    print("=" * 60)

    print("\n[1.5x 필터 통과 종목]")
    if passed_1_5x:
        for i, it in enumerate(passed_1_5x, 1):
            print(
                f"  {i:2}. {it['symbol']:10} {it['name'][:16]:16} "
                f"[{it['market_type']:6}] "
                f"신호일: {it['last_signal_date']}  "
                f"거래량비율: {it['vol_ratio_signal_vs_avg']}"
            )
    else:
        print("  없음")

    print("\n[기존 통과 → 1.5x 미통과 (탈락) 종목]")
    passed_1_5x_syms = {it["symbol"] for it in passed_1_5x}
    dropped = [it for it in passed_1x if it["symbol"] not in passed_1_5x_syms]
    if dropped:
        for i, it in enumerate(dropped, 1):
            print(
                f"  {i:2}. {it['symbol']:10} {it['name'][:16]:16} "
                f"[{it['market_type']:6}] "
                f"신호일: {it['last_signal_date']}  "
                f"거래량비율: {it['vol_ratio_signal_vs_avg']}"
            )
    else:
        print("  없음")

    if no_cache:
        print(f"\n[parquet 캐시 없는 종목 ({len(no_cache)}개) — 재스캔 시 처리됨]")
        for it in no_cache:
            print(f"  - {it['symbol']} ({it['name'][:16]}) [{it['market_type']}]")


if __name__ == "__main__":
    main()
