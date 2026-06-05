from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbDep, require_project_role
from app.models import (
    CatalogItem,
    Element,
    Floor,
    MembershipRole,
    Project,
    Snapshot,
)
from app.schemas.element import ElementOut
from app.schemas.misc import BOMLine, BOMReport, SnapshotCreate, SnapshotOut

router = APIRouter(prefix="/projects/{project_id}", tags=["reports"])


@router.get("/bom", response_model=BOMReport)
def bill_of_materials(
    project_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.viewer)),
) -> BOMReport:
    """Aggregate placed catalog items across all floors into a costed BOM."""
    floor_ids = [f.id for f in project.floors]
    if not floor_ids:
        return BOMReport(lines=[], grand_total=0.0)

    elements = db.scalars(
        select(Element).where(
            Element.floor_id.in_(floor_ids), Element.catalog_item_id.isnot(None)
        )
    ).all()

    catalog = {c.id: c for c in db.scalars(select(CatalogItem)).all()}
    counts: dict[int, int] = defaultdict(int)
    for el in elements:
        counts[el.catalog_item_id] += 1

    lines: list[BOMLine] = []
    grand_total = 0.0
    for cid, qty in counts.items():
        item = catalog.get(cid)
        if not item:
            continue
        total = item.unit_cost * qty
        grand_total += total
        lines.append(
            BOMLine(
                name=item.name,
                category=item.category,
                layer=item.layer,
                quantity=qty,
                unit_cost=item.unit_cost,
                total_cost=total,
            )
        )
    lines.sort(key=lambda line_item: (line_item.layer.value, line_item.name))
    return BOMReport(lines=lines, grand_total=grand_total)


# ---- snapshots / version history ----


@router.get("/snapshots", response_model=list[SnapshotOut])
def list_snapshots(
    project_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.viewer)),
) -> list[Snapshot]:
    return db.scalars(
        select(Snapshot)
        .where(Snapshot.project_id == project_id)
        .order_by(Snapshot.created_at.desc())
    ).all()


@router.post("/snapshots", response_model=SnapshotOut, status_code=status.HTTP_201_CREATED)
def create_snapshot(
    project_id: int,
    payload: SnapshotCreate,
    db: DbDep,
    user: CurrentUser,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> Snapshot:
    data: dict = {"floors": []}
    for floor in project.floors:
        elements = db.scalars(
            select(Element).where(Element.floor_id == floor.id)
        ).all()
        data["floors"].append(
            {
                "floor_id": floor.id,
                "elements": [
                    ElementOut.model_validate(e).model_dump() for e in elements
                ],
            }
        )
    snap = Snapshot(
        project_id=project_id, author_id=user.id, label=payload.label, data=data
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return snap


@router.post("/snapshots/{snapshot_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
def restore_snapshot(
    project_id: int,
    snapshot_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> None:
    snap = db.get(Snapshot, snapshot_id)
    if not snap or snap.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Snapshot not found")

    floors_by_id = {f.id: f for f in project.floors}
    for floor_data in snap.data.get("floors", []):
        floor = floors_by_id.get(floor_data["floor_id"])
        if not floor:
            continue
        # wipe current elements, then recreate from snapshot
        for el in db.scalars(select(Element).where(Element.floor_id == floor.id)).all():
            db.delete(el)
        db.flush()
        for el_data in floor_data["elements"]:
            el_data.pop("id", None)
            el_data.pop("floor_id", None)
            db.add(Element(floor_id=floor.id, **el_data))
    db.commit()
