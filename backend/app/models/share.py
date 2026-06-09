from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ShareLink(Base, TimestampMixin):
    """A tokenized, view-only public link to a project (no account needed)."""

    __tablename__ = "share_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    label: Mapped[str] = mapped_column(String(255), default="")
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
