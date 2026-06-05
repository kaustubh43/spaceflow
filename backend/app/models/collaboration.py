from sqlalchemy import Boolean, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Comment(Base, TimestampMixin):
    """A note pinned to a floor coordinate or a specific element."""

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    floor_id: Mapped[int] = mapped_column(
        ForeignKey("floors.id", ondelete="CASCADE"), index=True
    )
    element_id: Mapped[int | None] = mapped_column(
        ForeignKey("elements.id", ondelete="CASCADE"), nullable=True
    )
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    x: Mapped[float | None] = mapped_column(Float, nullable=True)
    y: Mapped[float | None] = mapped_column(Float, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)

    author: Mapped["User"] = relationship()  # noqa: F821


class Snapshot(Base, TimestampMixin):
    """A saved version of a project's full layout for restore / history."""

    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    label: Mapped[str] = mapped_column(String(255))
    data: Mapped[dict] = mapped_column(JSONB)
