"""종목 마스터 다운로더 — 한투 API 전종목 리스트를 다운로드하여 DB에 저장."""

import asyncio
import io
import re
import zipfile
from datetime import datetime

import requests
from loguru import logger
from sqlalchemy import delete, select, func

from database import async_session
from models import StockMaster

# 한투 종목 마스터 파일 URL
_KR_MASTER_URLS = {
    "KOSPI": "https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip",
    "KOSDAQ": "https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip",
}

# 미국 주요 종목 하드코딩 (한투 FTP에 미국 마스터 없음)
_US_STOCKS: dict[str, tuple[str, str, bool]] = {}  # 아래서 초기화


def _download_kr_master(market_type: str, url: str) -> list[dict]:
    """한투 종목 마스터 zip 다운로드 + 파싱."""
    try:
        r = requests.get(url, timeout=30)
        if r.status_code != 200:
            logger.error(f"마스터 다운로드 실패 [{market_type}]: HTTP {r.status_code}")
            return []

        z = zipfile.ZipFile(io.BytesIO(r.content))
        data = z.read(z.namelist()[0]).decode("cp949", errors="replace")
        lines = data.strip().split("\n")

        stocks = []
        for line in lines:
            short_code = line[:9].strip()
            # 6자리 숫자 종목코드만
            if len(short_code) < 6 or not short_code[:6].isdigit():
                continue

            symbol = short_code[:6]
            rest = line[21:]

            # 이름 추출: 2개 이상 공백 전까지
            match = re.match(r"(.+?)\s{2,}", rest)
            name = match.group(1).strip() if match else rest[:40].strip()

            # 그룹코드 추출 (이름 뒤 2자리)
            after_name = rest[len(name):].strip()
            group = after_name[:2] if len(after_name) >= 2 else ""

            # ETF/ETN 판별
            is_etf = group in ("EF", "EN", "EW", "BC", "BW")

            if name:
                stocks.append({
                    "symbol": symbol,
                    "name": name,
                    "market": "KR",
                    "market_type": market_type,
                    "is_etf": is_etf,
                })

        return stocks
    except Exception as e:
        logger.error(f"마스터 파싱 실패 [{market_type}]: {e}")
        return []


def _get_us_hardcoded() -> list[dict]:
    """미국 종목 하드코딩 (한투 FTP 미제공, 주요 종목 + ETF).

    market_type 분류:
      NASDAQ100 — QQQ(NASDAQ 100) 구성 종목
      SP500     — S&P 500 기타 대형주 (NYSE 상장 포함)
      ETF       — 미국 ETF
    """
    from routes.search import _US_ETFS
    from services.market_scanner import _get_us_stocks, _NASDAQ100_SYMBOLS

    stocks = []
    for sym, name in _get_us_stocks().items():
        mtype = "NASDAQ100" if sym in _NASDAQ100_SYMBOLS else "SP500"
        stocks.append({"symbol": sym, "name": name, "market": "US", "market_type": mtype, "is_etf": False})
    for sym, name in _US_ETFS.items():
        stocks.append({"symbol": sym, "name": name, "market": "US", "market_type": "ETF", "is_etf": True})
    return stocks


async def refresh_stock_master() -> dict:
    """전종목 마스터 갱신 — 한투 다운로드 + DB 저장."""
    logger.info("종목 마스터 갱신 시작...")

    all_stocks = []

    # 한국 종목 (한투 FTP에서 다운로드)
    for market_type, url in _KR_MASTER_URLS.items():
        items = await asyncio.to_thread(_download_kr_master, market_type, url)
        all_stocks.extend(items)
        logger.info(f"  {market_type}: {len(items)}개")

    # 미국 종목 (하드코딩)
    us = _get_us_hardcoded()
    all_stocks.extend(us)
    logger.info(f"  US: {len(us)}개")

    if not all_stocks:
        logger.warning("종목 마스터 데이터 없음 — 갱신 건너뜀")
        return {"status": "empty"}

    # DB 저장 (전체 삭제 후 삽입)
    now = datetime.utcnow()
    async with async_session() as session:
        await session.execute(delete(StockMaster))

        batch = []
        for s in all_stocks:
            batch.append(StockMaster(
                symbol=s["symbol"],
                name=s["name"],
                market=s["market"],
                market_type=s["market_type"],
                is_etf=s["is_etf"],
                updated_at=now,
            ))

        session.add_all(batch)
        await session.commit()

    kr_count = sum(1 for s in all_stocks if s["market"] == "KR")
    us_count = sum(1 for s in all_stocks if s["market"] == "US")
    etf_count = sum(1 for s in all_stocks if s["is_etf"])

    logger.info(f"종목 마스터 갱신 완료: KR {kr_count} + US {us_count} = {len(all_stocks)}개 (ETF {etf_count}개)")
    return {"status": "ok", "total": len(all_stocks), "kr": kr_count, "us": us_count, "etf": etf_count}


async def search_master(query: str, market: str = "", limit: int = 20) -> list[dict]:
    """stock_master 테이블에서 종목 검색. 심볼 완전일치 → 심볼 시작 → 이름/심볼 포함 순으로 정렬."""
    async with async_session() as session:
        count = await session.scalar(select(func.count()).select_from(StockMaster))
        if not count:
            return []

        q_upper = query.upper()

        base = select(StockMaster)
        if market:
            base = base.where(StockMaster.market == market)

        # 우선순위 1: 심볼 완전 일치
        exact = base.where(StockMaster.symbol == q_upper).limit(limit)
        exact_rows = (await session.execute(exact)).scalars().all()

        # 우선순위 2: 심볼 앞자리 일치 (예: "rea" → "REAL")
        prefix = base.where(
            StockMaster.symbol.startswith(q_upper),
            StockMaster.symbol != q_upper,
        ).limit(limit)
        prefix_rows = (await session.execute(prefix)).scalars().all()

        # 우선순위 3: 이름 또는 심볼 포함 (대소문자 무시, 이미 수집한 것 제외)
        seen = {r.symbol for r in exact_rows + prefix_rows}
        contains = base.where(
            (StockMaster.name.ilike(f'%{query}%')) | (StockMaster.symbol.contains(q_upper))
        ).limit(limit)
        contains_rows = [r for r in (await session.execute(contains)).scalars().all() if r.symbol not in seen]

        rows = (exact_rows + prefix_rows + contains_rows)[:limit]

        return [
            {
                "symbol": r.symbol,
                "name": r.name,
                "market": r.market,
                "market_type": r.market_type,
                "is_etf": r.is_etf,
                "display": f"{r.name} ({r.symbol}) - {r.market_type}{'·ETF' if r.is_etf else ''}",
            }
            for r in rows
        ]


async def get_master_count() -> int:
    """마스터 테이블 종목 수."""
    async with async_session() as session:
        return await session.scalar(select(func.count()).select_from(StockMaster)) or 0


async def get_all_symbols() -> dict:
    """큐레이션 스캔 대상 종목 목록 + 카테고리별 집계 반환.

    코스피200, 코스닥150, KRX반도체/2차전지 추가 + S&P500 + 나스닥100 단독 + Russell1000 단독 종목 포함.
    """
    from services.scan_symbols_list import (
        ALL_KR_SYMBOLS, ALL_US_TICKERS, KOSPI200_SYMBOLS, KOSDAQ150_SYMBOLS,
        NASDAQ100_EXTRA_TICKERS, RUSSELL1000_EXTRA_TICKERS, SP500_TICKERS,
        US_ETF_TICKERS,
    )

    async with async_session() as session:
        # KR: stock_master 기반
        kr_rows = (await session.execute(
            select(StockMaster).where(
                StockMaster.market == "KR",
                StockMaster.symbol.in_(ALL_KR_SYMBOLS),
            ).order_by(StockMaster.market_type, StockMaster.symbol)
        )).scalars().all()

        # US: stock_master 우선, 없으면 ticker 직접 포함
        us_rows = (await session.execute(
            select(StockMaster).where(
                StockMaster.market == "US",
                StockMaster.symbol.in_(ALL_US_TICKERS),
            )
        )).scalars().all()
        us_map: dict[str, StockMaster] = {r.symbol: r for r in us_rows}

        breakdown = {"kospi": 0, "kospi_etf": 0, "kosdaq": 0, "nasdaq100": 0, "sp500": 0, "russell1000": 0, "us_etf": 0}
        symbols = []

        for r in kr_rows:
            if r.market_type == "KOSPI" and not r.is_etf:
                breakdown["kospi"] += 1
            elif r.market_type == "KOSPI" and r.is_etf:
                breakdown["kospi_etf"] += 1
            elif r.market_type == "KOSDAQ":
                breakdown["kosdaq"] += 1
            symbols.append({
                "symbol": r.symbol,
                "name": r.name,
                "market": r.market,
                "market_type": r.market_type,
                "is_etf": r.is_etf,
                "indices": [],
            })

        for ticker in sorted(ALL_US_TICKERS):
            r = us_map.get(ticker)
            # 소속 지수 목록 (복수 가능)
            indices: list[str] = []
            if ticker in SP500_TICKERS:
                indices.append("SP500")
            if ticker in NASDAQ100_EXTRA_TICKERS:
                indices.append("NASDAQ100")
            if ticker in RUSSELL1000_EXTRA_TICKERS:
                indices.append("RUSSELL1000")
            # 1차 분류 기준 (NASDAQ100 > RUSSELL1000 > ETF > SP500)
            if ticker in NASDAQ100_EXTRA_TICKERS:
                mtype = "NASDAQ100"
                breakdown["nasdaq100"] += 1
            elif ticker in RUSSELL1000_EXTRA_TICKERS:
                mtype = "RUSSELL1000"
                breakdown["russell1000"] += 1
            elif ticker in US_ETF_TICKERS:
                mtype = "ETF"
                breakdown["us_etf"] += 1
            else:
                mtype = "SP500"
                breakdown["sp500"] += 1
            symbols.append({
                "symbol": ticker,
                "name": r.name if r else ticker,
                "market": "US",
                "market_type": mtype,
                "is_etf": r.is_etf if r else False,
                "indices": indices,
            })

        return {"total": len(symbols), "breakdown": breakdown, "symbols": symbols}
