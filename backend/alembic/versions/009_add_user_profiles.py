"""add user_profiles table

Revision ID: 009_add_user_profiles
Revises: 1ac8ad4cd49b
Create Date: 2026-03-29

"""
from alembic import op
import sqlalchemy as sa

revision = "009_add_user_profiles"
down_revision = "1ac8ad4cd49b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    # FK to auth.users — cross-schema, must use raw SQL
    op.execute(
        "ALTER TABLE user_profiles ADD CONSTRAINT fk_user_profiles_auth "
        "FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE user_profiles DROP CONSTRAINT fk_user_profiles_auth")
    op.drop_table("user_profiles")
