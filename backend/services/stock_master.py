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
    """미국 종목 하드코딩 (한투 FTP 미제공, 주요 종목 + ETF)."""
    from routes.search import _US_ETFS
    from services.market_scanner import _get_us_stocks

    stocks = []
    for sym, name in _get_us_stocks().items():
        stocks.append({"symbol": sym, "name": name, "market": "US", "market_type": "NASDAQ", "is_etf": False})
    for sym, name in _US_ETFS.items():
        stocks.append({"symbol": sym, "name": name, "market": "US", "market_type": "NYSE", "is_etf": True})
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
    """stock_master 테이블에서 종목 검색."""
    async with async_session() as session:
        # 마스터 로드 여부 확인
        count = await session.scalar(select(func.count()).select_from(StockMaster))
        if not count:
            return []

        q = select(StockMaster)
        if market:
            q = q.where(StockMaster.market == market)

        # 이름 또는 심볼로 검색
        q = q.where(
            (StockMaster.name.contains(query)) | (StockMaster.symbol.contains(query.upper()))
        ).limit(limit)

        result = await session.execute(q)
        rows = result.scalars().all()

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
