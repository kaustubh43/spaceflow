from typing import Any

from pydantic import BaseModel

from app.models.enums import ElementKind, LayerType


class ElementBase(BaseModel):
    kind: ElementKind
    layer: LayerType
    name: str = ""
    x: float = 0.0
    y: float = 0.0
    width_cm: float = 60.0
    depth_cm: float = 60.0
    height_cm: float = 90.0
    rotation_deg: float = 0.0
    points: list[float] | None = None
    color: str | None = None
    z_index: int = 0
    client_editable: bool = False
    catalog_item_id: int | None = None
    properties: dict[str, Any] = {}


class ElementCreate(ElementBase):
    pass


class ElementUpdate(BaseModel):
    kind: ElementKind | None = None
    layer: LayerType | None = None
    name: str | None = None
    x: float | None = None
    y: float | None = None
    width_cm: float | None = None
    depth_cm: float | None = None
    height_cm: float | None = None
    rotation_deg: float | None = None
    points: list[float] | None = None
    color: str | None = None
    z_index: int | None = None
    client_editable: bool | None = None
    catalog_item_id: int | None = None
    properties: dict[str, Any] | None = None


class ElementOut(ElementBase):
    id: int
    floor_id: int

    model_config = {"from_attributes": True}


class BulkElementUpdate(BaseModel):
    """Used by the editor to persist many moves/edits in one call."""

    creates: list[ElementCreate] = []
    updates: dict[int, ElementUpdate] = {}
    deletes: list[int] = []
