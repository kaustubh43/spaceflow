from pydantic import BaseModel


class FloorBase(BaseModel):
    name: str = "Ground Floor"
    level: int = 0
    width_cm: float = 1200.0
    height_cm: float = 1000.0
    grid_cm: float = 10.0
    wall_height_cm: float = 280.0


class FloorCreate(FloorBase):
    pass


class FloorUpdate(BaseModel):
    name: str | None = None
    level: int | None = None
    width_cm: float | None = None
    height_cm: float | None = None
    grid_cm: float | None = None
    wall_height_cm: float | None = None


class FloorOut(FloorBase):
    id: int
    project_id: int

    model_config = {"from_attributes": True}
