from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbDep, require_project_role
from app.models import Element, Floor, MembershipRole, Project
from app.schemas.element import (
    BulkElementResult,
    BulkElementUpdate,
    ElementCreate,
    ElementOut,
    ElementUpdate,
)

router = APIRouter(prefix="/projects/{project_id}/floors/{floor_id}", tags=["elements"])


def _get_floor(db: DbDep, project_id: int, floor_id: int) -> Floor:
    floor = db.get(Floor, floor_id)
    if not floor or floor.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Floor not found")
    return floor


def _can_edit_element(role: MembershipRole, element: Element | None, new_flag: bool | None) -> bool:
    """Editors/owners edit anything; contributors only client-editable items."""
    if role in (MembershipRole.editor, MembershipRole.owner):
        return True
    if role == MembershipRole.contributor:
        # contributors may only touch elements explicitly marked client-editable,
        # and may not flip that flag themselves
        if new_flag is not None:
            return False
        return bool(element and element.client_editable)
    return False


@router.get("/elements", response_model=list[ElementOut])
def list_elements(
    project_id: int,
    floor_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.viewer)),
) -> list[Element]:
    _get_floor(db, project_id, floor_id)
    return db.scalars(
        select(Element).where(Element.floor_id == floor_id).order_by(Element.z_index)
    ).all()


@router.post("/elements", response_model=ElementOut, status_code=status.HTTP_201_CREATED)
def create_element(
    project_id: int,
    floor_id: int,
    payload: ElementCreate,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.contributor)),
) -> Element:
    _get_floor(db, project_id, floor_id)
    role = project._membership.role  # type: ignore[attr-defined]
    if role == MembershipRole.contributor:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Contributors cannot add elements")
    data = payload.model_dump()
    data.pop("client_id", None)
    element = Element(floor_id=floor_id, **data)
    db.add(element)
    db.commit()
    db.refresh(element)
    return element


@router.patch("/elements/{element_id}", response_model=ElementOut)
def update_element(
    project_id: int,
    floor_id: int,
    element_id: int,
    payload: ElementUpdate,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.contributor)),
) -> Element:
    _get_floor(db, project_id, floor_id)
    element = db.get(Element, element_id)
    if not element or element.floor_id != floor_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Element not found")
    role = project._membership.role  # type: ignore[attr-defined]
    if not _can_edit_element(role, element, payload.client_editable):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed to edit this element")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(element, field, value)
    db.commit()
    db.refresh(element)
    return element


@router.delete("/elements/{element_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_element(
    project_id: int,
    floor_id: int,
    element_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> None:
    _get_floor(db, project_id, floor_id)
    element = db.get(Element, element_id)
    if not element or element.floor_id != floor_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Element not found")
    db.delete(element)
    db.commit()


@router.post("/elements/bulk", response_model=BulkElementResult)
def bulk_update(
    project_id: int,
    floor_id: int,
    payload: BulkElementUpdate,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> BulkElementResult:
    """Persist a batch of editor changes (creates, updates, deletes) atomically.

    Returns the full floor element list plus an ``id_map`` of the client's
    temporary ids to the new database ids, so the editor can keep its undo
    history valid across saves (and across reopening the project).
    """
    _get_floor(db, project_id, floor_id)

    created: list[tuple[int | None, Element]] = []
    for create in payload.creates:
        data = create.model_dump()
        client_id = data.pop("client_id", None)
        element = Element(floor_id=floor_id, **data)
        db.add(element)
        created.append((client_id, element))

    for element_id, update in payload.updates.items():
        element = db.get(Element, element_id)
        if element and element.floor_id == floor_id:
            for field, value in update.model_dump(exclude_unset=True).items():
                setattr(element, field, value)

    for element_id in payload.deletes:
        element = db.get(Element, element_id)
        if element and element.floor_id == floor_id:
            db.delete(element)

    db.commit()

    id_map = {cid: el.id for cid, el in created if cid is not None}
    items = db.scalars(
        select(Element).where(Element.floor_id == floor_id).order_by(Element.z_index)
    ).all()
    return BulkElementResult(items=items, id_map=id_map)
