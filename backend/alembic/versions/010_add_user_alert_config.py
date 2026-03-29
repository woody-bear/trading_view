"""add user_alert_config table

Revision ID: 010_add_user_alert_config
Revises: 009_add_user_profiles
Create Date: 2026-03-29

"""
from alembic import op
import sqlalchemy as sa

revision = "010_add_user_alert_config"
down_revision = "009_add_user_profiles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_alert_config",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=False,
            unique=True,
        ),
        sa.Column("telegram_bot_token", sa.Text(), nullable=True),
        sa.Column("telegram_chat_id", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.execute(
        "ALTER TABLE user_alert_config ADD CONSTRAINT fk_user_alert_config_auth "
        "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE user_alert_config DROP CONSTRAINT fk_user_alert_config_auth")
    op.drop_table("user_alert_config")
