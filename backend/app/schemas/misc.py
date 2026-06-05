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
    name: str
    category: str
    layer: LayerType
    quantity: int
    unit_cost: float
    total_cost: float


class BOMReport(BaseModel):
    lines: list[BOMLine]
    grand_total: float
