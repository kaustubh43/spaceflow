from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import ElementKind, LayerType


class Element(Base, TimestampMixin):
    """
    A generic placed object on a floor. Covers walls, rooms, furniture,
    appliances, fixtures, switchboards, lights, etc. — distinguished by `kind`
    and grouped for visibility by `layer`.

    Rectangular/point items use x, y, width_cm, depth_cm, rotation_deg.
    Polyline/polygon items (walls, rooms, plumbing lines) use `points`
    (a flat list [x1, y1, x2, y2, ...] in cm). `properties` holds anything
    kind-specific (e.g. switchboard buttons, material, wattage).
    """

    __tablename__ = "elements"

    id: Mapped[int] = mapped_column(primary_key=True)
    floor_id: Mapped[int] = mapped_column(
        ForeignKey("floors.id", ondelete="CASCADE"), index=True
    )

    kind: Mapped[ElementKind] = mapped_column(SAEnum(ElementKind, name="element_kind"))
    layer: Mapped[LayerType] = mapped_column(SAEnum(LayerType, name="layer_type"))
    name: Mapped[str] = mapped_column(String(255), default="")

    # rectangle / point transform (cm). Origin top-left of the floor canvas.
    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    width_cm: Mapped[float] = mapped_column(Float, default=60.0)
    depth_cm: Mapped[float] = mapped_column(Float, default=60.0)
    height_cm: Mapped[float] = mapped_column(Float, default=90.0)
    rotation_deg: Mapped[float] = mapped_column(Float, default=0.0)

    # polyline / polygon geometry (walls, rooms, plumbing runs)
    points: Mapped[list[float] | None] = mapped_column(JSONB, nullable=True)

    color: Mapped[str | None] = mapped_column(String(32), nullable=True)
    z_index: Mapped[int] = mapped_column(Integer, default=0)

    # whether a project contributor (client) may edit this element
    client_editable: Mapped[bool] = mapped_column(Boolean, default=False)

    # an item the client already owns: shown on the plan but NOT charged in the BOM
    is_existing: Mapped[bool] = mapped_column(Boolean, default=False)
    # overrides the catalog unit cost in the BOM when set
    unit_cost_override: Mapped[float | None] = mapped_column(Float, nullable=True)

    catalog_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("catalog_items.id"), nullable=True
    )

    properties: Mapped[dict] = mapped_column(JSONB, default=dict)

    floor: Mapped["Floor"] = relationship(back_populates="elements")  # noqa: F821
