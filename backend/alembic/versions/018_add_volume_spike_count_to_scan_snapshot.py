"""add volume_spike_count to scan_snapshot

Revision ID: 018_volume_spike_count
Revises: 017_pattern_case_exit_to_profit
Create Date: 2026-04-15 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "018_volume_spike_count"
down_revision: Union[str, Sequence[str], None] = "017_pattern_case_exit_to_profit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scan_snapshot",
        sa.Column("volume_spike_count", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("scan_snapshot", "volume_spike_count")
