"""add_crisis_event_tables

Revision ID: e2258826d81e
Revises: 016_pattern_case_source
Create Date: 2026-04-03 06:49:12.158608

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2258826d81e'
down_revision: Union[str, Sequence[str], None] = '016_pattern_case_source'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add crisis event history tables."""
    op.create_table(
        'crisis_event',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('event_type', sa.String(length=30), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('is_ongoing', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('description', sa.Text(), nullable=False, server_default=''),
        sa.Column('severity_level', sa.String(length=20), nullable=False, server_default='moderate'),
        sa.Column('best_comparison_event_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ['best_comparison_event_id'], ['crisis_event.id'],
            name='fk_crisis_best_comparison', use_alter=True
        ),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'market_indicator',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=20), nullable=False),
        sa.Column('ticker', sa.String(length=20), nullable=False),
        sa.Column('unit', sa.String(length=30), nullable=False),
        sa.Column('earliest_date', sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticker'),
    )

    op.create_table(
        'event_indicator_stats',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('indicator_id', sa.Integer(), nullable=False),
        sa.Column('max_drawdown_pct', sa.Float(), nullable=True),
        sa.Column('max_gain_pct', sa.Float(), nullable=True),
        sa.Column('days_to_bottom', sa.Integer(), nullable=True),
        sa.Column('recovery_days', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['crisis_event.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['indicator_id'], ['market_indicator.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_id', 'indicator_id', name='uq_event_indicator_stats'),
    )

    op.create_table(
        'indicator_data_point',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('indicator_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('value', sa.Float(), nullable=True),
        sa.Column('change_pct_from_event_start', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['event_id'], ['crisis_event.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['indicator_id'], ['market_indicator.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_id', 'indicator_id', 'date', name='uq_indicator_datapoint'),
    )
    op.create_index('idx_indicator_dp_lookup', 'indicator_data_point', ['event_id', 'indicator_id', 'date'], unique=False)


def downgrade() -> None:
    """Remove crisis event history tables."""
    op.drop_index('idx_indicator_dp_lookup', table_name='indicator_data_point')
    op.drop_table('indicator_data_point')
    op.drop_table('event_indicator_stats')
    op.drop_table('market_indicator')
    op.drop_constraint('fk_crisis_best_comparison', 'crisis_event', type_='foreignkey')
    op.drop_table('crisis_event')
