"""pattern_case: exit_price 제거 + profit_krw 추가

Revision ID: 017_pattern_case_exit_to_profit
Revises: d225f0d428e2
Create Date: 2026-04-14
"""
from alembic import op
import sqlalchemy as sa

revision = '017_pattern_case_exit_to_profit'
down_revision = 'd225f0d428e2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 매도수익금(원화) 컬럼 추가 — nullable (기존 데이터 호환)
    op.add_column('pattern_case', sa.Column('profit_krw', sa.Float(), nullable=True))
    # 청산가 컬럼 제거 (단가 → 수익금 체계로 전환)
    op.drop_column('pattern_case', 'exit_price')


def downgrade() -> None:
    op.add_column('pattern_case', sa.Column('exit_price', sa.Float(), nullable=True))
    op.drop_column('pattern_case', 'profit_krw')
