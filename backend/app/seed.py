"""Idempotent seeding: catalog presets, a demo designer + client, and a sample house.

Run via `python -m app.seed`. Controlled by SEED_DEMO env var.
"""
from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    CatalogItem,
    Element,
    ElementKind,
    Floor,
    LayerType,
    MembershipRole,
    Project,
    ProjectMembership,
    User,
    UserRole,
)
from app.seed_data import CATALOG


def seed_catalog(db) -> dict[str, CatalogItem]:
    by_name: dict[str, CatalogItem] = {}
    existing = {c.name: c for c in db.scalars(select(CatalogItem)).all()}
    for (name, cat, layer, kind, w, d, h, color, icon, cost, props) in CATALOG:
        item = existing.get(name)
        if not item:
            item = CatalogItem(
                name=name, category=cat, layer=layer, kind=kind,
                default_width_cm=w, default_depth_cm=d, default_height_cm=h,
                color=color, icon=icon, unit_cost=cost, default_properties=props,
            )
            db.add(item)
        by_name[name] = item
    db.commit()
    for item in by_name.values():
        db.refresh(item)
    return by_name


def _place(floor_id, cat, x, y, name=None, rot=0, client_editable=False, props=None):
    return Element(
        floor_id=floor_id,
        kind=cat.kind,
        layer=cat.layer,
        name=name or cat.name,
        x=x, y=y,
        width_cm=cat.default_width_cm,
        depth_cm=cat.default_depth_cm,
        height_cm=cat.default_height_cm,
        rotation_deg=rot,
        color=cat.color,
        catalog_item_id=cat.id,
        client_editable=client_editable,
        properties={**cat.default_properties, **(props or {})},
    )


def seed_demo(db, catalog: dict[str, CatalogItem]) -> None:
    designer = db.scalar(select(User).where(User.email == settings.DEMO_EMAIL))
    if not designer:
        designer = User(
            email=settings.DEMO_EMAIL,
            full_name="Demo Designer",
            hashed_password=hash_password(settings.DEMO_PASSWORD),
            role=UserRole.designer,
        )
        db.add(designer)
        db.commit()
        db.refresh(designer)

    client = db.scalar(select(User).where(User.email == "client@idesigner.app"))
    if not client:
        client = User(
            email="client@idesigner.app",
            full_name="Demo Client",
            hashed_password=hash_password("demo1234"),
            role=UserRole.client,
        )
        db.add(client)
        db.commit()
        db.refresh(client)

    # only seed the sample house once
    if db.scalar(select(Project).where(Project.name == "Sample 2BHK Apartment")):
        return

    project = Project(
        name="Sample 2BHK Apartment",
        description="A demo project showcasing layers, fixtures and furniture.",
        address="404 Greenview Residency, Bengaluru",
        client_name="Demo Client",
        units="cm",
        owner_id=designer.id,
    )
    project.memberships.append(ProjectMembership(user=designer, role=MembershipRole.owner))
    # client can comment and tweak items flagged client-editable
    project.memberships.append(ProjectMembership(user=client, role=MembershipRole.contributor))
    floor = Floor(name="Ground Floor", level=0, width_cm=1200, height_cm=1000, wall_height_cm=290)
    project.floors.append(floor)
    db.add(project)
    db.commit()
    db.refresh(floor)

    fid = floor.id
    els: list[Element] = []

    # --- Architecture: perimeter + partitions (walls as polylines) ---
    els.append(Element(floor_id=fid, kind=ElementKind.wall, layer=LayerType.architecture,
                       name="Perimeter",
                       points=[60, 60, 1140, 60, 1140, 940, 60, 940, 60, 60], color="#334155"))
    # vertical partition splitting left (living/kitchen) from right (bedrooms)
    els.append(Element(floor_id=fid, kind=ElementKind.wall, layer=LayerType.architecture,
                       name="Partition", points=[660, 60, 660, 940], color="#334155"))
    # horizontal partition on the right creating two bedrooms
    els.append(Element(floor_id=fid, kind=ElementKind.wall, layer=LayerType.architecture,
                       name="Partition", points=[660, 500, 1140, 500], color="#334155"))
    # bathroom box bottom-left
    els.append(Element(floor_id=fid, kind=ElementKind.wall, layer=LayerType.architecture,
                       name="Bathroom wall", points=[60, 700, 320, 700, 320, 940], color="#334155"))

    # --- Rooms (labelled polygons) ---
    rooms = [
        ("Living / Dining", [60, 60, 660, 60, 660, 700, 320, 700, 320, 940, 60, 940]),
        ("Kitchen", [320, 700, 660, 700, 660, 940, 320, 940]),
        ("Bathroom", [60, 700, 320, 700, 320, 940, 60, 940]),
        ("Master Bedroom", [660, 60, 1140, 60, 1140, 500, 660, 500]),
        ("Bedroom 2", [660, 500, 1140, 500, 1140, 940, 660, 940]),
    ]
    for rname, pts in rooms:
        els.append(Element(floor_id=fid, kind=ElementKind.room, layer=LayerType.architecture,
                           name=rname, points=pts, color="#e2e8f0"))

    c = catalog
    # --- Furniture ---
    els.append(_place(fid, c["Sofa (3-seat)"], 120, 120, client_editable=True))
    els.append(_place(fid, c["TV Unit"], 120, 320))
    els.append(_place(fid, c["Coffee Table"], 150, 230, client_editable=True))
    els.append(_place(fid, c["Dining Table (6)"], 360, 760))
    els.append(_place(fid, c["Kitchen Counter"], 380, 720, rot=0))
    els.append(_place(fid, c["Double Bed"], 760, 150, client_editable=True))
    els.append(_place(fid, c["Wardrobe / Cupboard"], 940, 80))
    els.append(_place(fid, c["Single Bed"], 760, 620, client_editable=True))
    els.append(_place(fid, c["Study Desk"], 980, 560))

    # --- Appliances ---
    els.append(_place(fid, c["Refrigerator"], 560, 720))
    els.append(_place(fid, c["Television"], 130, 300))
    els.append(_place(fid, c["Split AC Indoor"], 800, 75))

    # --- Plumbing (bathroom + kitchen) ---
    els.append(_place(fid, c["WC / Toilet"], 90, 870))
    els.append(_place(fid, c["Wash Basin"], 230, 870))
    els.append(_place(fid, c["Shower"], 90, 730))
    els.append(_place(fid, c["Kitchen Sink"], 470, 720))

    # --- Electrical ---
    els.append(_place(fid, c["Switchboard (6-module)"], 80, 200, name="Living SB"))
    els.append(_place(fid, c["Switchboard (6-module)"], 700, 90, name="Bedroom SB"))
    els.append(_place(fid, c["Distribution Board"], 600, 90, name="Main DB"))
    els.append(_place(fid, c["Power Socket (16A)"], 120, 360))

    # --- Lighting ---
    els.append(_place(fid, c["Ceiling Light"], 330, 350))
    els.append(_place(fid, c["Ceiling Light"], 880, 250))
    els.append(_place(fid, c["Ceiling Light"], 880, 700))
    els.append(_place(fid, c["Pendant Light"], 420, 800))

    # --- HVAC ---
    els.append(_place(fid, c["Ceiling Fan"], 330, 380))
    els.append(_place(fid, c["Exhaust Fan"], 280, 720))

    # --- Networking ---
    els.append(_place(fid, c["CCTV Camera"], 1100, 80))
    els.append(_place(fid, c["Router / AP"], 620, 120))

    db.add_all(els)
    db.commit()
    print(f"   seeded demo project '{project.name}' with {len(els)} elements")


def main() -> None:
    db = SessionLocal()
    try:
        catalog = seed_catalog(db)
        print(f"   catalog: {len(catalog)} items")
        if settings.SEED_DEMO:
            seed_demo(db, catalog)
    finally:
        db.close()


if __name__ == "__main__":
    main()
