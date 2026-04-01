"""pattern_case: source + user_id 컬럼 추가

Revision ID: 016_add_source_user_id_pattern_case
Revises: 015_add_alert_log_columns
Create Date: 2026-04-01
"""
from alembic import op
import sqlalchemy as sa

revision = '016_pattern_case_source'
down_revision = '015_add_alert_log_columns'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # source: 'chart' (차트 자동) | 'manual' (수동 입력)
    op.add_column('pattern_case', sa.Column('source', sa.String(20), nullable=False, server_default='manual'))
    # user_id: Supabase auth.users.id — nullable (기존 데이터 호환)
    op.add_column('pattern_case', sa.Column('user_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index('idx_pattern_case_user', 'pattern_case', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_pattern_case_user', table_name='pattern_case')
    op.drop_column('pattern_case', 'user_id')
    op.drop_column('pattern_case', 'source')
