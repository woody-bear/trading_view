"""watchlist add user_id column (nullable)

Revision ID: 012_watchlist_add_user_id
Revises: 011_add_user_position_state
Create Date: 2026-03-29

"""
from alembic import op
import sqlalchemy as sa

revision = "012_watchlist_add_user_id"
down_revision = "011_add_user_position_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "watchlist",
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.execute(
        "ALTER TABLE watchlist ADD CONSTRAINT fk_watchlist_user_id "
        "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    )
    op.create_index("idx_watchlist_user_id", "watchlist", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_watchlist_user_id", table_name="watchlist")
    op.execute("ALTER TABLE watchlist DROP CONSTRAINT fk_watchlist_user_id")
    op.drop_column("watchlist", "user_id")
