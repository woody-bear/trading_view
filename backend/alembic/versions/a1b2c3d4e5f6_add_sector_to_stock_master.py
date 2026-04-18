"""add sector to stock_master

Revision ID: a1b2c3d4e5f6
Revises: d225f0d428e2
Create Date: 2026-04-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '019_market_cap'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('stock_master', sa.Column('sector', sa.String(100), nullable=True, server_default='기타'))


def downgrade() -> None:
    op.drop_column('stock_master', 'sector')
