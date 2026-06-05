from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CostItem(Base, TimestampMixin):
    """A manual line item in a project's bill of materials.

    For costs that aren't placed objects: civil work, labour, painting,
    transport, design fee, etc. Fully editable by the designer.
    """

    __tablename__ = "cost_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(120), default="Custom")
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit: Mapped[str] = mapped_column(String(32), default="item")
    unit_cost: Mapped[float] = mapped_column(Float, default=0.0)
    sort_order: Mapped[int] = mapped_column(default=0)
