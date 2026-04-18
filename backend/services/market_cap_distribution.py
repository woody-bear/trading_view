"""시가총액 3등분 분포 계산 — BuyList 최상단 분포 바용.

market별(KR/US)로 전체 스캔 대상 중 market_cap이 적재된 종목을 대상으로
시총 내림차순 정렬 후 누적 시총 1/3·2/3 경계로 3등분.
각 분위마다 국내/미국 시장 관행적 시총 기준(대/중/소형주) 분류 집계를 함께 반환.
"""

from loguru import logger
from sqlalchemy import select

from database import async_session
from models import StockMaster

_TTL_SEC = 300  # 5분 캐시
_cache: dict = {"data": None, "ts": 0.0}

# ── 대/중/소형주 시총 기준 (실무 관행 · KRX 공식 랭킹 기준과는 다름) ──
# KR: 2조 이상 대형주 / 3천억~2조 중형주 / 3천억 미만 소형주
# US: $10B 이상 대형주 / $2B~$10B 중형주 / $2B 미만 소형주 (S&P/Russell 관행)
KR_LARGE_THRESHOLD = 2_000_000_000_000
KR_MID_THRESHOLD = 300_000_000_000
US_LARGE_THRESHOLD = 10_000_000_000
US_MID_THRESHOLD = 2_000_000_000


def _classify_cap(cap: int, currency: str) -> str:
    """시총 기준 대/중/소형주 분류."""
    if currency == "KRW":
        if cap >= KR_LARGE_THRESHOLD:
            return "large"
        if cap >= KR_MID_THRESHOLD:
            return "mid"
        return "small"
    # USD
    if cap >= US_LARGE_THRESHOLD:
        return "large"
    if cap >= US_MID_THRESHOLD:
        return "mid"
    return "small"


def _thresholds_for(currency: str) -> dict:
    if currency == "KRW":
        return {"large": KR_LARGE_THRESHOLD, "mid": KR_MID_THRESHOLD}
    return {"large": US_LARGE_THRESHOLD, "mid": US_MID_THRESHOLD}


async def compute_distribution() -> dict:
    """KR/US 각각 시총 3등분 분포 계산."""
    import time

    now = time.time()
    if _cache["data"] and (now - _cache["ts"]) < _TTL_SEC:
        return _cache["data"]

    from services.scan_symbols_list import ALL_KR_SYMBOLS, ALL_US_TICKERS

    async with async_session() as session:
        rows = (await session.execute(
            select(StockMaster.symbol, StockMaster.market, StockMaster.market_cap, StockMaster.name)
            .where(StockMaster.market_cap.isnot(None))
        )).all()

    kr_items: list[tuple[str, int, str]] = []
    us_items: list[tuple[str, int, str]] = []
    for sym, market, cap, name in rows:
        if cap is None or cap <= 0:
            continue
        if market == "KR" and sym in ALL_KR_SYMBOLS:
            kr_items.append((sym, int(cap), name))
        elif market == "US" and sym in ALL_US_TICKERS:
            us_items.append((sym, int(cap), name))

    result = {
        "kr": _build_distribution(kr_items, currency="KRW"),
        "us": _build_distribution(us_items, currency="USD"),
    }
    _cache["data"] = result
    _cache["ts"] = now
    return result


def _build_distribution(items: list[tuple[str, int, str]], currency: str) -> dict:
    """정렬된 종목 목록 → 3등분 결과."""
    if not items:
        return {
            "currency": currency,
            "total_count": 0,
            "total_market_cap": 0,
            "tertiles": [],
            "median_position_pct": 50.0,
        }

    # 시총 내림차순 정렬 (상위 = 왼쪽 = 1분위)
    sorted_items = sorted(items, key=lambda x: x[1], reverse=True)
    total_cap = sum(c for _, c, _ in sorted_items)
    total_count = len(sorted_items)

    t1_boundary = total_cap / 3
    t2_boundary = total_cap * 2 / 3
    median_boundary = total_cap / 2

    tertiles = [
        {"rank": 1, "count": 0, "market_cap_sum": 0, "top_symbols": [],
         "size_breakdown": {"large": 0, "mid": 0, "small": 0}},
        {"rank": 2, "count": 0, "market_cap_sum": 0, "top_symbols": [],
         "size_breakdown": {"large": 0, "mid": 0, "small": 0}},
        {"rank": 3, "count": 0, "market_cap_sum": 0, "top_symbols": [],
         "size_breakdown": {"large": 0, "mid": 0, "small": 0}},
    ]

    cumulative = 0
    median_position_pct = 50.0
    median_found = False

    for sym, cap, name in sorted_items:
        prev_cum = cumulative
        cumulative += cap

        # 중앙값(50% 누적) 지점을 바 전체 폭 기준 %로 변환
        # 3등분 바는 폭 33/33/33 고정, 중앙값은 해당 분위 내 상대 위치로 매핑
        if not median_found and cumulative >= median_boundary:
            # 어느 분위에 들어갔는지 + 그 분위 내 위치
            if prev_cum < t1_boundary:
                # 1분위 내부 (0~33% 바)
                ratio = (median_boundary - prev_cum) / cap if cap else 0
                local_cum = prev_cum + ratio * cap
                median_position_pct = (local_cum / t1_boundary) * 33.333 if t1_boundary else 0
            elif prev_cum < t2_boundary:
                # 2분위 내부 (33~66% 바)
                local_start = prev_cum - t1_boundary
                ratio = (median_boundary - prev_cum) / cap if cap else 0
                local_cum = local_start + ratio * cap
                seg_width = t2_boundary - t1_boundary
                median_position_pct = 33.333 + (local_cum / seg_width) * 33.333 if seg_width else 33.333
            else:
                # 3분위 내부 (66~100% 바) — 드물지만 방어
                local_start = prev_cum - t2_boundary
                ratio = (median_boundary - prev_cum) / cap if cap else 0
                local_cum = local_start + ratio * cap
                seg_width = total_cap - t2_boundary
                median_position_pct = 66.666 + (local_cum / seg_width) * 33.333 if seg_width else 66.666
            median_found = True

        # 분위 분류
        if prev_cum < t1_boundary:
            idx = 0
        elif prev_cum < t2_boundary:
            idx = 1
        else:
            idx = 2
        tertiles[idx]["count"] += 1
        tertiles[idx]["market_cap_sum"] += cap
        tertiles[idx]["size_breakdown"][_classify_cap(cap, currency)] += 1
        if len(tertiles[idx]["top_symbols"]) < 3:
            tertiles[idx]["top_symbols"].append({"symbol": sym, "name": name, "market_cap": cap})

    # 각 분위의 대표 카테고리 = 가장 많은 분류 (tie: large > mid > small)
    for t in tertiles:
        br = t["size_breakdown"]
        if t["count"] == 0:
            t["dominant_size"] = None
        else:
            t["dominant_size"] = max(("large", "mid", "small"), key=lambda k: br[k])

    return {
        "currency": currency,
        "total_count": total_count,
        "total_market_cap": total_cap,
        "tertiles": tertiles,
        "median_position_pct": round(median_position_pct, 2),
        "size_thresholds": _thresholds_for(currency),
    }
