"""add dead_cross_count and alive_count to scan_snapshot

Revision ID: d225f0d428e2
Revises: 78b47ebbdeb0
Create Date: 2026-04-12 17:21:01.130745

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd225f0d428e2'
down_revision: Union[str, Sequence[str], None] = '78b47ebbdeb0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('scan_snapshot', sa.Column('dead_cross_count', sa.Integer(), nullable=True))
    op.add_column('scan_snapshot', sa.Column('alive_count', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('scan_snapshot', 'alive_count')
    op.drop_column('scan_snapshot', 'dead_cross_count')
