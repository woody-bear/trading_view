#!/usr/bin/env python
"""SQLite → Supabase PostgreSQL 데이터 마이그레이션.

사용법:
  cd backend
  source .venv/bin/activate
  python scripts/migrate_sqlite_data.py --admin-uuid <UUID>

주의:
  - admin Google 계정으로 먼저 로그인하여 user_profiles 행이 생성된 후 실행
  - watchlist 기존 데이터를 admin UUID로 일괄 설정
  - .env의 TELEGRAM_BOT_TOKEN/CHAT_ID를 admin의 user_alert_config에 INSERT
"""

import argparse
import asyncio
import os
import sys
import uuid

import aiosqlite
import asyncpg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

SQLITE_PATH = os.path.join(os.path.dirname(__file__), "../data/ubb_pro.db")


def get_pg_dsn() -> str:
    db_url = os.getenv("DATABASE_URL", "")
    # Convert SQLAlchemy URL format to asyncpg DSN
    return db_url.replace("postgresql+asyncpg://", "postgresql://")


async def migrate(admin_uuid: str) -> None:
    uid = uuid.UUID(admin_uuid)
    dsn = get_pg_dsn()

    print(f"[migrate] admin UUID: {uid}")
    print(f"[migrate] SQLite: {SQLITE_PATH}")
    print(f"[migrate] Supabase: {dsn[:40]}...")

    if not os.path.exists(SQLITE_PATH):
        print(f"[migrate] SQLite 파일이 없습니다: {SQLITE_PATH}")
        sys.exit(1)

    pg = await asyncpg.connect(dsn)

    try:
        # 1. watchlist 마이그레이션
        print("\n[1/2] watchlist 마이그레이션...")
        async with aiosqlite.connect(SQLITE_PATH) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT market, symbol, display_name, timeframe, data_source, is_active, created_at FROM watchlist"
            ) as cur:
                rows = await cur.fetchall()

        skipped = 0
        inserted = 0
        for row in rows:
            # 이미 있는 경우 user_id만 업데이트
            existing = await pg.fetchrow(
                "SELECT id, user_id FROM watchlist WHERE market=$1 AND symbol=$2",
                row["market"], row["symbol"],
            )
            if existing:
                if existing["user_id"] is None:
                    await pg.execute(
                        "UPDATE watchlist SET user_id=$1 WHERE id=$2",
                        uid, existing["id"],
                    )
                    print(f"  ✓ updated user_id: {row['market']}/{row['symbol']}")
                    inserted += 1
                else:
                    skipped += 1
            else:
                # 신규 INSERT
                await pg.execute(
                    """
                    INSERT INTO watchlist (user_id, market, symbol, display_name, timeframe, data_source, is_active, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                    ON CONFLICT (market, symbol) DO NOTHING
                    """,
                    uid, row["market"], row["symbol"], row["display_name"],
                    row["timeframe"] or "1d", row["data_source"] or "auto",
                    bool(row["is_active"]),
                )
                inserted += 1
                print(f"  + inserted: {row['market']}/{row['symbol']}")

        print(f"  → {inserted}개 처리, {skipped}개 건너뜀")

        # 2. 텔레그램 설정 → user_alert_config
        print("\n[2/2] 텔레그램 설정 → user_alert_config 마이그레이션...")
        bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
        chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()

        if bot_token and chat_id:
            await pg.execute(
                """
                INSERT INTO user_alert_config (user_id, telegram_bot_token, telegram_chat_id, is_active)
                VALUES ($1, $2, $3, true)
                ON CONFLICT (user_id) DO UPDATE
                    SET telegram_bot_token = EXCLUDED.telegram_bot_token,
                        telegram_chat_id   = EXCLUDED.telegram_chat_id
                """,
                uid, bot_token, chat_id,
            )
            print(f"  ✓ user_alert_config 저장됨 (chat_id: {chat_id})")
        else:
            print("  ⚠ TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정 — 건너뜀")

        print("\n✅ 마이그레이션 완료!")
        print("\n다음 단계:")
        print("  alembic upgrade head  # 013_watchlist_user_id_not_null 실행")

    finally:
        await pg.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SQLite → Supabase 마이그레이션")
    parser.add_argument("--admin-uuid", required=True, help="admin Google 로그인 후 생성된 UUID")
    args = parser.parse_args()

    asyncio.run(migrate(args.admin_uuid))
