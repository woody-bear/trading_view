"""StockMaster.sector 초기값 채우기 스크립트.

US 종목: yfinance info['sector'] 조회 (없으면 'Unknown')
KR 종목: market_type 기반 매핑 (KOSPI → 'KOSPI', KOSDAQ → 'KOSDAQ')
CRYPTO: '암호화폐'
ETF: 'ETF'

실행:
  cd backend
  python scripts/populate_sector.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import yfinance as yf
from loguru import logger
from sqlalchemy import select, update

from database import async_session
from models import StockMaster

_KR_MARKET_TYPE_TO_SECTOR: dict[str, str] = {
    "KOSPI": "KOSPI",
    "KOSDAQ": "KOSDAQ",
    "ETF": "ETF",
}

_CRYPTO_MARKET = "CRYPTO"
_CRYPTO_SECTOR = "암호화폐"

_BATCH_SIZE = 50


async def _populate() -> None:
    async with async_session() as session:
        rows = (await session.execute(
            select(StockMaster.id, StockMaster.symbol, StockMaster.market, StockMaster.market_type, StockMaster.is_etf)
        )).all()

    logger.info(f"총 {len(rows)}개 종목 sector 갱신 시작")
    updates: list[dict] = []

    us_rows = [(id_, sym) for id_, sym, mkt, mtype, is_etf in rows
               if mkt == "US" and not is_etf]
    kr_rows = [(id_, sym, mtype, is_etf) for id_, sym, mkt, mtype, is_etf in rows if mkt == "KR"]
    crypto_rows = [(id_,) for id_, sym, mkt, mtype, is_etf in rows if mkt == _CRYPTO_MARKET]
    us_etf_rows = [(id_,) for id_, sym, mkt, mtype, is_etf in rows if mkt == "US" and is_etf]

    # CRYPTO
    for (id_,) in crypto_rows:
        updates.append({"id": id_, "sector": _CRYPTO_SECTOR})

    # US ETF
    for (id_,) in us_etf_rows:
        updates.append({"id": id_, "sector": "ETF"})

    # KR
    for id_, sym, mtype, is_etf in kr_rows:
        if is_etf:
            sector = "ETF"
        else:
            sector = _KR_MARKET_TYPE_TO_SECTOR.get(mtype, "기타")
        updates.append({"id": id_, "sector": sector})

    # US (yfinance 배치)
    logger.info(f"US 주식 {len(us_rows)}개 yfinance sector 조회 시작...")
    for i in range(0, len(us_rows), _BATCH_SIZE):
        batch = us_rows[i:i + _BATCH_SIZE]
        for id_, sym in batch:
            try:
                info = yf.Ticker(sym).info
                sector = info.get("sector") or "기타"
            except Exception:
                sector = "기타"
            updates.append({"id": id_, "sector": sector})
        logger.info(f"  US 진행: {min(i + _BATCH_SIZE, len(us_rows))}/{len(us_rows)}")

    # DB 일괄 반영
    async with async_session() as session:
        for chunk_start in range(0, len(updates), 200):
            chunk = updates[chunk_start:chunk_start + 200]
            for row in chunk:
                await session.execute(
                    update(StockMaster).where(StockMaster.id == row["id"]).values(sector=row["sector"])
                )
        await session.commit()

    logger.info(f"sector 갱신 완료: {len(updates)}개")


if __name__ == "__main__":
    asyncio.run(_populate())
