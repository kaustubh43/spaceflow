from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AppSettings(Base, TimestampMixin):
    """Application-wide settings, edited from the admin panel. Single row (id=1)."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    app_name: Mapped[str] = mapped_column(String(120), default="iDesigner")
    currency_code: Mapped[str] = mapped_column(String(8), default="INR")
    currency_symbol: Mapped[str] = mapped_column(String(8), default="₹")
    currency_locale: Mapped[str] = mapped_column(String(16), default="en-IN")
    default_units: Mapped[str] = mapped_column(String(8), default="cm")
    accent_color: Mapped[str] = mapped_column(String(16), default="#4f46e5")
