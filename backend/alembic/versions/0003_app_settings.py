"""application-wide settings table

Revision ID: 0003_app_settings
Revises: 0002_cost_existing
Create Date: 2026-06-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_app_settings"
down_revision: Union[str, None] = "0002_cost_existing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("app_name", sa.String(length=120), nullable=False, server_default="iDesigner"),
        sa.Column("currency_code", sa.String(length=8), nullable=False, server_default="INR"),
        sa.Column("currency_symbol", sa.String(length=8), nullable=False, server_default="₹"),
        sa.Column("currency_locale", sa.String(length=16), nullable=False, server_default="en-IN"),
        sa.Column("default_units", sa.String(length=8), nullable=False, server_default="cm"),
        sa.Column("accent_color", sa.String(length=16), nullable=False, server_default="#4f46e5"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.execute(
        "INSERT INTO app_settings (id, app_name, currency_code, currency_symbol, "
        "currency_locale, default_units, accent_color) "
        "VALUES (1, 'iDesigner', 'INR', '₹', 'en-IN', 'cm', '#4f46e5')"
    )


def downgrade() -> None:
    op.drop_table("app_settings")
