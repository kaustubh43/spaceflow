from datetime import datetime

from pydantic import BaseModel

from app.schemas.floor import FloorOut


class ShareLinkCreate(BaseModel):
    label: str = ""


class ShareLinkOut(BaseModel):
    id: int
    token: str
    label: str
    revoked: bool
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class SharedProjectOut(BaseModel):
    """Public, view-only payload for a shared project (no cost data)."""

    name: str
    client_name: str | None = None
    units: str
    floors: list[FloorOut] = []
