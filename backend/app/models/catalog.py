from sqlalchemy import Float, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import ElementKind, LayerType


class CatalogItem(Base, TimestampMixin):
    """Reusable preset (TV unit, bed, fridge, WC, ...) with default sizing."""

    __tablename__ = "catalog_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(120), index=True)
    layer: Mapped[LayerType] = mapped_column(SAEnum(LayerType, name="layer_type"))
    kind: Mapped[ElementKind] = mapped_column(
        SAEnum(ElementKind, name="element_kind"), default=ElementKind.item
    )

    default_width_cm: Mapped[float] = mapped_column(Float, default=60.0)
    default_depth_cm: Mapped[float] = mapped_column(Float, default=60.0)
    default_height_cm: Mapped[float] = mapped_column(Float, default=90.0)

    color: Mapped[str] = mapped_column(String(32), default="#9aa5b1")
    icon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # estimated unit cost for the bill of materials
    unit_cost: Mapped[float] = mapped_column(Float, default=0.0)

    default_properties: Mapped[dict] = mapped_column(JSONB, default=dict)
