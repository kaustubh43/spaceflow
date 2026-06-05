from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbDep, require_project_role
from app.models import (
    CatalogItem,
    CostItem,
    Element,
    Floor,
    MembershipRole,
    Project,
    Snapshot,
)
from app.schemas.element import ElementOut
from app.schemas.misc import (
    BOMLine,
    BOMReport,
    CostItemCreate,
    CostItemOut,
    CostItemUpdate,
    ItemCostOverride,
    SnapshotCreate,
    SnapshotOut,
)

router = APIRouter(prefix="/projects/{project_id}", tags=["reports"])


@router.get("/bom", response_model=BOMReport)
def bill_of_materials(
    project_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.viewer)),
) -> BOMReport:
    """Build a costed BOM: placed catalog items (with per-item cost overrides and
    'existing/not charged' handling) plus manual cost lines (civil work, labour…)."""
    floor_ids = [f.id for f in project.floors]
    catalog = {c.id: c for c in db.scalars(select(CatalogItem)).all()}

    elements = (
        db.scalars(
            select(Element).where(
                Element.floor_id.in_(floor_ids), Element.catalog_item_id.isnot(None)
            )
        ).all()
        if floor_ids
        else []
    )

    # group placed elements by catalog item, split into charged vs existing
    grouped: dict[int, dict] = defaultdict(
        lambda: {"charged": 0, "existing": 0, "override": None}
    )
    for el in elements:
        g = grouped[el.catalog_item_id]
        if el.is_existing:
            g["existing"] += 1
        else:
            g["charged"] += 1
        if el.unit_cost_override is not None:
            g["override"] = el.unit_cost_override

    lines: list[BOMLine] = []
    charged_total = 0.0
    existing_value = 0.0

    for cid, g in grouped.items():
        item = catalog.get(cid)
        if not item:
            continue
        unit_cost = g["override"] if g["override"] is not None else item.unit_cost
        if g["charged"]:
            total = unit_cost * g["charged"]
            charged_total += total
            lines.append(
                BOMLine(
                    source="item", ref_id=cid, name=item.name, category=item.category,
                    layer=item.layer, quantity=g["charged"], unit_cost=unit_cost,
                    total_cost=total, is_existing=False,
                    editable_cost=True, editable_qty=False,
                )
            )
        if g["existing"]:
            existing_value += unit_cost * g["existing"]
            lines.append(
                BOMLine(
                    source="item", ref_id=cid, name=item.name, category=item.category,
                    layer=item.layer, quantity=g["existing"], unit_cost=unit_cost,
                    total_cost=0.0, is_existing=True,
                    editable_cost=True, editable_qty=False,
                )
            )

    # manual cost lines
    cost_items = db.scalars(
        select(CostItem).where(CostItem.project_id == project_id).order_by(
            CostItem.sort_order, CostItem.id
        )
    ).all()
    for ci in cost_items:
        total = ci.quantity * ci.unit_cost
        charged_total += total
        lines.append(
            BOMLine(
                source="manual", ref_id=ci.id, name=ci.label, category=ci.category,
                layer=None, quantity=ci.quantity, unit=ci.unit, unit_cost=ci.unit_cost,
                total_cost=total, editable_cost=True, editable_qty=True,
            )
        )

    lines.sort(key=lambda ln: (ln.source != "item", ln.category, ln.is_existing, ln.name))
    return BOMReport(
        lines=lines,
        charged_total=charged_total,
        existing_value=existing_value,
        grand_total=charged_total,
    )


@router.post("/bom/item-override", status_code=status.HTTP_204_NO_CONTENT)
def override_item_cost(
    project_id: int,
    payload: ItemCostOverride,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> None:
    """Apply a unit-cost override and/or 'existing' flag to every placed element
    of a catalog item across the project (the editable-BOM hook)."""
    floor_ids = [f.id for f in project.floors]
    if not floor_ids:
        return
    els = db.scalars(
        select(Element).where(
            Element.floor_id.in_(floor_ids),
            Element.catalog_item_id == payload.catalog_item_id,
        )
    ).all()
    for el in els:
        if payload.unit_cost is not None:
            el.unit_cost_override = payload.unit_cost
        if payload.is_existing is not None:
            el.is_existing = payload.is_existing
    db.commit()


# ---- manual cost line CRUD ----
@router.get("/cost-items", response_model=list[CostItemOut])
def list_cost_items(
    project_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.viewer)),
) -> list[CostItem]:
    return db.scalars(
        select(CostItem).where(CostItem.project_id == project_id).order_by(
            CostItem.sort_order, CostItem.id
        )
    ).all()


@router.post("/cost-items", response_model=CostItemOut, status_code=status.HTTP_201_CREATED)
def create_cost_item(
    project_id: int,
    payload: CostItemCreate,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> CostItem:
    ci = CostItem(project_id=project_id, **payload.model_dump())
    db.add(ci)
    db.commit()
    db.refresh(ci)
    return ci


@router.patch("/cost-items/{item_id}", response_model=CostItemOut)
def update_cost_item(
    project_id: int,
    item_id: int,
    payload: CostItemUpdate,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> CostItem:
    ci = db.get(CostItem, item_id)
    if not ci or ci.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cost item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ci, field, value)
    db.commit()
    db.refresh(ci)
    return ci


@router.delete("/cost-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cost_item(
    project_id: int,
    item_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> None:
    ci = db.get(CostItem, item_id)
    if not ci or ci.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cost item not found")
    db.delete(ci)
    db.commit()


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
