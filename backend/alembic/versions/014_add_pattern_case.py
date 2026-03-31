"""add pattern_case table

Revision ID: 014_add_pattern_case
Revises: 013_watchlist_user_id_not_null
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = '014_add_pattern_case'
down_revision = '014_watchlist_user_market_index'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'pattern_case',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('symbol', sa.String(length=20), nullable=False),
        sa.Column('stock_name', sa.String(length=100), nullable=False),
        sa.Column('market', sa.String(length=10), nullable=False),
        sa.Column('market_type', sa.String(length=20), nullable=True),
        sa.Column('pattern_type', sa.String(length=30), nullable=False, server_default='custom'),
        sa.Column('signal_date', sa.String(length=10), nullable=False),
        sa.Column('entry_price', sa.Float(), nullable=True),
        sa.Column('exit_price', sa.Float(), nullable=True),
        sa.Column('result_pct', sa.Float(), nullable=True),
        sa.Column('hold_days', sa.Integer(), nullable=True),
        sa.Column('rsi', sa.Float(), nullable=True),
        sa.Column('bb_pct_b', sa.Float(), nullable=True),
        sa.Column('bb_width', sa.Float(), nullable=True),
        sa.Column('macd_hist', sa.Float(), nullable=True),
        sa.Column('volume_ratio', sa.Float(), nullable=True),
        sa.Column('ema_alignment', sa.String(length=10), nullable=True),
        sa.Column('squeeze_level', sa.Integer(), nullable=True),
        sa.Column('conditions_met', sa.Integer(), nullable=True),
        sa.Column('tags', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_pattern_case_date', 'pattern_case', ['signal_date'])
    op.create_index('idx_pattern_case_type', 'pattern_case', ['pattern_type'])


def downgrade() -> None:
    op.drop_index('idx_pattern_case_type', table_name='pattern_case')
    op.drop_index('idx_pattern_case_date', table_name='pattern_case')
    op.drop_table('pattern_case')
