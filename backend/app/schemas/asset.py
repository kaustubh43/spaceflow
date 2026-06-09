from datetime import datetime

from pydantic import BaseModel, computed_field


class AssetOut(BaseModel):
    id: int
    project_id: int
    filename: str
    original_name: str
    content_type: str
    size: int
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

    @computed_field  # served by the StaticFiles mount at /uploads
    @property
    def url(self) -> str:
        return f"/uploads/{self.project_id}/{self.filename}"
