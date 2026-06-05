from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Floor(Base, TimestampMixin):
    """A level within a house (Ground, First, ...). Each has its own canvas."""

    __tablename__ = "floors"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(120), default="Ground Floor")
    level: Mapped[int] = mapped_column(Integer, default=0)

    # canvas configuration
    width_cm: Mapped[float] = mapped_column(Float, default=1200.0)
    height_cm: Mapped[float] = mapped_column(Float, default=1000.0)
    grid_cm: Mapped[float] = mapped_column(Float, default=10.0)
    wall_height_cm: Mapped[float] = mapped_column(Float, default=280.0)

    project: Mapped["Project"] = relationship(back_populates="floors")  # noqa: F821
    elements: Mapped[list["Element"]] = relationship(  # noqa: F821
        back_populates="floor", cascade="all, delete-orphan"
    )
