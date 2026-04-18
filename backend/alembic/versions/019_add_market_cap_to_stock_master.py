"""add market_cap to stock_master

Revision ID: 019_market_cap
Revises: 018_volume_spike_count
Create Date: 2026-04-18 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "019_market_cap"
down_revision: Union[str, Sequence[str], None] = "018_volume_spike_count"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "stock_master",
        sa.Column("market_cap", sa.BigInteger(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("stock_master", "market_cap")
