"""drop_daily_top_pick

Revision ID: 78b47ebbdeb0
Revises: 016_pattern_case_source
Create Date: 2026-04-12 10:19:43.253614

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '78b47ebbdeb0'
down_revision: Union[str, Sequence[str], None] = '016_pattern_case_source'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """daily_top_pick 테이블 삭제 — 추천종목 기능 제거."""
    op.drop_index("idx_daily_top_pick_date", table_name="daily_top_pick")
    op.drop_table("daily_top_pick")


def downgrade() -> None:
    """daily_top_pick 테이블 재생성 (롤백용)."""
    op.create_table(
        "daily_top_pick",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("scan_date", sa.String(length=10), nullable=False),
        sa.Column("market_type", sa.String(length=10), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("change_pct", sa.Float(), nullable=True),
        sa.Column("signal_state", sa.String(length=10), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("grade", sa.String(length=20), nullable=True),
        sa.Column("rsi", sa.Float(), nullable=True),
        sa.Column("bb_pct_b", sa.Float(), nullable=True),
        sa.Column("squeeze_level", sa.Integer(), nullable=True),
        sa.Column("macd_hist", sa.Float(), nullable=True),
        sa.Column("volume_ratio", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_daily_top_pick_date", "daily_top_pick", ["scan_date", "market_type"])
