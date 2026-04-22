"""add signal_date to user_position_state

Revision ID: 020_position_signal_date
Revises: 019_market_cap
Create Date: 2026-04-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "020_position_signal_date"
down_revision: Union[str, Sequence[str], None] = "019_market_cap"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_position_state",
        sa.Column("signal_date", sa.String(10), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_position_state", "signal_date")
