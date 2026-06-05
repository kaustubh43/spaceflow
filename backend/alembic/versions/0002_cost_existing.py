"""editable BOM: existing items, cost overrides, manual cost lines

Revision ID: 0002_cost_existing
Revises: 0001_initial
Create Date: 2026-06-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_cost_existing"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "elements",
        sa.Column(
            "is_existing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "elements",
        sa.Column("unit_cost_override", sa.Float(), nullable=True),
    )

    op.create_table(
        "cost_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=False, server_default="Custom"),
        sa.Column("quantity", sa.Float(), nullable=False, server_default="1"),
        sa.Column("unit", sa.String(length=32), nullable=False, server_default="item"),
        sa.Column("unit_cost", sa.Float(), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("cost_items")
    op.drop_column("elements", "unit_cost_override")
    op.drop_column("elements", "is_existing")
