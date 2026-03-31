"""alert_log add alert_type and symbol_count columns

Revision ID: 015_add_alert_log_columns
Revises: 014_add_pattern_case
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = '015_add_alert_log_columns'
down_revision = '014_add_pattern_case'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # alert_type: 발송 유형 (scheduled_buy / scheduled_sell / realtime / test)
    op.add_column('alert_log', sa.Column('alert_type', sa.String(length=30), nullable=True, server_default='realtime'))
    # symbol_count: 발송 종목 수
    op.add_column('alert_log', sa.Column('symbol_count', sa.Integer(), nullable=True))
    # signal_history_id nullable=True (기존 NOT NULL이 문제 있을 수 있음)
    op.alter_column('alert_log', 'signal_history_id', nullable=True)


def downgrade() -> None:
    op.drop_column('alert_log', 'symbol_count')
    op.drop_column('alert_log', 'alert_type')
