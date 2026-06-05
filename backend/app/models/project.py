from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import MembershipRole


class Project(Base, TimestampMixin):
    """One house = one project."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    address: Mapped[str | None] = mapped_column(String(512), nullable=True)
    client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # "cm" or "in" — default display units
    units: Mapped[str] = mapped_column(String(8), default="cm")
    thumbnail_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    memberships: Mapped[list["ProjectMembership"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    floors: Mapped[list["Floor"]] = relationship(  # noqa: F821
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Floor.level",
    )


class ProjectMembership(Base, TimestampMixin):
    __tablename__ = "project_memberships"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[MembershipRole] = mapped_column(
        SAEnum(MembershipRole, name="membership_role"), default=MembershipRole.viewer
    )

    project: Mapped["Project"] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship(back_populates="memberships")  # noqa: F821
