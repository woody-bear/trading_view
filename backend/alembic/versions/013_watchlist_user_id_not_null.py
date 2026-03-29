"""watchlist user_id NOT NULL (마이그레이션 완료 후 실행)

Revision ID: 013_watchlist_user_id_not_null
Revises: 012_watchlist_add_user_id
Create Date: 2026-03-29

주의: 이 마이그레이션은 migrate_sqlite_data.py 스크립트로
      모든 watchlist 행에 user_id가 설정된 후에만 실행하세요.
"""
from alembic import op

revision = "013_watchlist_user_id_not_null"
down_revision = "012_watchlist_add_user_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("watchlist", "user_id", nullable=False)


def downgrade() -> None:
    op.alter_column("watchlist", "user_id", nullable=True)
