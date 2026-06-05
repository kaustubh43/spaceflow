from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbDep, require_project_role
from app.models import Floor, MembershipRole, Project
from app.schemas.floor import FloorCreate, FloorOut, FloorUpdate

router = APIRouter(prefix="/projects/{project_id}/floors", tags=["floors"])


@router.get("", response_model=list[FloorOut])
def list_floors(
    project_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.viewer)),
) -> list[Floor]:
    return db.scalars(
        select(Floor).where(Floor.project_id == project_id).order_by(Floor.level)
    ).all()


@router.post("", response_model=FloorOut, status_code=status.HTTP_201_CREATED)
def create_floor(
    project_id: int,
    payload: FloorCreate,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> Floor:
    floor = Floor(project_id=project_id, **payload.model_dump())
    db.add(floor)
    db.commit()
    db.refresh(floor)
    return floor


@router.patch("/{floor_id}", response_model=FloorOut)
def update_floor(
    project_id: int,
    floor_id: int,
    payload: FloorUpdate,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> Floor:
    floor = db.get(Floor, floor_id)
    if not floor or floor.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Floor not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(floor, field, value)
    db.commit()
    db.refresh(floor)
    return floor


@router.delete("/{floor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_floor(
    project_id: int,
    floor_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> None:
    floor = db.get(Floor, floor_id)
    if not floor or floor.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Floor not found")
    db.delete(floor)
    db.commit()
