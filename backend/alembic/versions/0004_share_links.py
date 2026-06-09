"""share links (tokenized view-only project access)

Revision ID: 0004_share_links
Revises: 0003_app_settings
Create Date: 2026-06-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_share_links"
down_revision: Union[str, None] = "0003_app_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "share_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_share_links_project_id", "share_links", ["project_id"])
    op.create_index("ix_share_links_token", "share_links", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_share_links_token", table_name="share_links")
    op.drop_index("ix_share_links_project_id", table_name="share_links")
    op.drop_table("share_links")
