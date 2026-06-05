from typing import Any

from pydantic import BaseModel

from app.models.enums import ElementKind, LayerType
from app.schemas.auth import UserOut


class CatalogItemOut(BaseModel):
    id: int
    name: str
    category: str
    layer: LayerType
    kind: ElementKind
    default_width_cm: float
    default_depth_cm: float
    default_height_cm: float
    color: str
    icon: str | None = None
    unit_cost: float
    default_properties: dict[str, Any] = {}

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    body: str
    element_id: int | None = None
    x: float | None = None
    y: float | None = None


class CommentUpdate(BaseModel):
    body: str | None = None
    resolved: bool | None = None


class CommentOut(BaseModel):
    id: int
    floor_id: int
    element_id: int | None
    author: UserOut
    body: str
    x: float | None
    y: float | None
    resolved: bool

    model_config = {"from_attributes": True}


class SnapshotCreate(BaseModel):
    label: str


class SnapshotOut(BaseModel):
    id: int
    project_id: int
    label: str
    author: UserOut | None = None

    model_config = {"from_attributes": True}


class BOMLine(BaseModel):
    # source = "item" (placed catalog object) or "manual" (cost line)
    source: str
    # for item lines: the catalog item id (used to push cost/existing edits)
    ref_id: int | None = None
    name: str
    category: str
    layer: LayerType | None = None
    quantity: float
    unit: str = "item"
    unit_cost: float
    total_cost: float
    is_existing: bool = False
    editable_cost: bool = True
    editable_qty: bool = False


class BOMReport(BaseModel):
    lines: list[BOMLine]
    charged_total: float
    existing_value: float  # reference value of existing (not charged) items
    grand_total: float


# ---- manual cost line items ----
class CostItemBase(BaseModel):
    label: str
    category: str = "Custom"
    quantity: float = 1.0
    unit: str = "item"
    unit_cost: float = 0.0
    sort_order: int = 0


class CostItemCreate(CostItemBase):
    pass


class CostItemUpdate(BaseModel):
    label: str | None = None
    category: str | None = None
    quantity: float | None = None
    unit: str | None = None
    unit_cost: float | None = None
    sort_order: int | None = None


class CostItemOut(CostItemBase):
    id: int
    project_id: int

    model_config = {"from_attributes": True}


class ItemCostOverride(BaseModel):
    """Apply a unit-cost override and/or existing flag to all placed elements
    of a given catalog item across the project (used by the editable BOM)."""

    catalog_item_id: int
    unit_cost: float | None = None
    is_existing: bool | None = None
