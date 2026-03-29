"""add user_position_state table

Revision ID: 011_add_user_position_state
Revises: 010_add_user_alert_config
Create Date: 2026-03-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "011_add_user_position_state"
down_revision = "010_add_user_alert_config"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_position_state",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("market", sa.String(10), nullable=False),
        sa.Column("completed_stages", JSONB, nullable=False, server_default="[]"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "symbol", "market", name="uq_user_position"),
    )
    op.execute(
        "ALTER TABLE user_position_state ADD CONSTRAINT fk_user_position_state_auth "
        "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE user_position_state DROP CONSTRAINT fk_user_position_state_auth")
    op.drop_table("user_position_state")
