"""Idempotent seeding: catalog presets, a demo designer + client, and a sample house.

Run via `python -m app.seed`. Controlled by SEED_DEMO env var.
"""
from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    CatalogItem,
    CostItem,
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


def _opening(fid, kind, name, x, y, w, color, rot=0, props=None):
    """A door or window placed on a wall (rot=90 for walls running vertically)."""
    return Element(
        floor_id=fid, kind=kind, layer=LayerType.architecture, name=name,
        x=x, y=y, width_cm=w, depth_cm=12, height_cm=210 if kind == ElementKind.door else 120,
        rotation_deg=rot, color=color, properties=props or {},
    )


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


def _wall(fid, name, points, color="#334155"):
    return Element(floor_id=fid, kind=ElementKind.wall, layer=LayerType.architecture,
                   name=name, points=points, color=color)


def _room(fid, name, points, color="#e2e8f0", props=None):
    return Element(floor_id=fid, kind=ElementKind.room, layer=LayerType.architecture,
                   name=name, points=points, color=color, properties=props or {})


def _place(floor_id, cat, x, y, name=None, rot=0, client_editable=False, props=None,
           w=None, d=None, h=None):
    return Element(
        floor_id=floor_id,
        kind=cat.kind,
        layer=cat.layer,
        name=name or cat.name,
        x=x, y=y,
        width_cm=w or cat.default_width_cm,
        depth_cm=d or cat.default_depth_cm,
        height_cm=h or cat.default_height_cm,
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
    floor = Floor(name="Ground Floor", level=0, width_cm=1320, height_cm=1000, wall_height_cm=290)
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

    # balcony off the master bedroom — a room with a height renders as a 3D railing
    els.append(Element(floor_id=fid, kind=ElementKind.room, layer=LayerType.architecture,
                       name="Balcony", points=[1150, 90, 1300, 90, 1300, 470, 1150, 470],
                       color="#dbeafe", properties={"wall_height": 100}))

    # --- Doors (open by default for clean walkthroughs) ---
    DOOR = ElementKind.door
    els.append(_opening(fid, DOOR, "Main Entrance", 200, 940, 100, "#b45309",
                        rot=0, props={"swing": "left", "open_angle": 90}))
    els.append(_opening(fid, DOOR, "Master Bedroom Door", 660, 280, 90, "#b45309",
                        rot=90, props={"swing": "left", "open_angle": 90}))
    els.append(_opening(fid, DOOR, "Bedroom 2 Door", 660, 720, 90, "#b45309",
                        rot=90, props={"swing": "right", "open_angle": 90}))
    els.append(_opening(fid, DOOR, "Bathroom Door", 320, 800, 80, "#b45309",
                        rot=90, props={"swing": "left", "open_angle": 80}))
    els.append(_opening(fid, DOOR, "Balcony Door", 1140, 280, 90, "#b45309",
                        rot=90, props={"swing": "right", "open_angle": 90}))

    # --- Windows (sill height drives 3D placement) ---
    WIN = ElementKind.window
    els.append(_opening(fid, WIN, "Living Window", 60, 320, 150, "#7dd3fc",
                        rot=90, props={"sill_cm": 90}))
    els.append(_opening(fid, WIN, "Master Window", 900, 60, 150, "#7dd3fc",
                        rot=0, props={"sill_cm": 90}))
    els.append(_opening(fid, WIN, "Bedroom 2 Window", 1140, 720, 140, "#7dd3fc",
                        rot=90, props={"sill_cm": 90}))

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
    # the client already owns the fridge — shown on the plan but not charged
    els.append(_place(fid, c["Refrigerator"], 560, 720, props=None))
    els[-1].is_existing = True
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

    # --- Bill-of-materials work lines (costs without a drawn object) ---
    work = [
        ("Civil work — masonry & plaster", "Civil Work", 1, "job", 120000),
        ("Labour — installation & fit-out", "Labour", 1, "job", 60000),
        ("Painting — whole house", "Painting", 1, "job", 45000),
        ("False ceiling — living & bedrooms", "False Ceiling", 38, "sqm", 1400),
    ]
    for i, (label, cat, qty, unit, cost) in enumerate(work):
        db.add(CostItem(project_id=project.id, label=label, category=cat,
                        quantity=qty, unit=unit, unit_cost=cost, sort_order=i))

    db.commit()
    print(f"   seeded demo project '{project.name}' with {len(els)} elements + {len(work)} cost lines")


def _ensure_users(db) -> tuple[User, User]:
    designer = db.scalar(select(User).where(User.email == settings.DEMO_EMAIL))
    if not designer:
        designer = User(email=settings.DEMO_EMAIL, full_name="Demo Designer",
                        hashed_password=hash_password(settings.DEMO_PASSWORD), role=UserRole.designer)
        db.add(designer); db.commit(); db.refresh(designer)
    client = db.scalar(select(User).where(User.email == "client@idesigner.app"))
    if not client:
        client = User(email="client@idesigner.app", full_name="Demo Client",
                      hashed_password=hash_password("demo1234"), role=UserRole.client)
        db.add(client); db.commit(); db.refresh(client)
    return designer, client


def _new_project(db, designer, client, *, name, description, address, client_name, floors_spec):
    """Create a project with multiple floors. `floors_spec` = list of dicts with
    name/level/width/height/wall_height."""
    project = Project(name=name, description=description, address=address,
                      client_name=client_name, units="cm", owner_id=designer.id)
    project.memberships.append(ProjectMembership(user=designer, role=MembershipRole.owner))
    project.memberships.append(ProjectMembership(user=client, role=MembershipRole.contributor))
    for fs in floors_spec:
        project.floors.append(Floor(name=fs["name"], level=fs["level"],
                                    width_cm=fs["width"], height_cm=fs["height"],
                                    wall_height_cm=fs["wall_height"]))
    db.add(project); db.commit()
    for f in project.floors:
        db.refresh(f)
    return project


def seed_villas(db, c: dict[str, CatalogItem]) -> None:
    """Two complex multi-floor villa demos exercising every layer."""
    designer, client = _ensure_users(db)
    DOOR, WIN = ElementKind.door, ElementKind.window

    # ============================ Villa 1: Luxury 4BHK Villa =====================
    if not db.scalar(select(Project).where(Project.name == "Luxury 4BHK Villa")):
        v1 = _new_project(
            db, designer, client,
            name="Luxury 4BHK Villa",
            description="Two-storey villa: living/dining + kitchen + guest suite below, master + 2 bedrooms + lounge above.",
            address="12 Palm Meadows, Whitefield, Bengaluru",
            client_name="Demo Client",
            floors_spec=[
                {"name": "Ground Floor", "level": 0, "width": 1400, "height": 1100, "wall_height": 320},
                {"name": "First Floor", "level": 1, "width": 1400, "height": 1100, "wall_height": 300},
            ],
        )
        g, u = v1.floors[0].id, v1.floors[1].id
        els: list[Element] = []

        # ---- Ground floor ----
        els += [
            _wall(g, "Perimeter", [60, 60, 1340, 60, 1340, 1040, 60, 1040, 60, 60]),
            _wall(g, "Public/Private split", [720, 60, 720, 1040]),
            _wall(g, "Living/Kitchen split", [60, 620, 720, 620]),
            _wall(g, "Foyer/Guest split", [720, 560, 1340, 560]),
            _wall(g, "Guest bath", [980, 820, 980, 1040]),
            _wall(g, "Guest bath", [720, 820, 980, 820]),
        ]
        els += [
            _room(g, "Living / Dining", [60, 60, 720, 60, 720, 620, 60, 620]),
            _room(g, "Kitchen", [60, 620, 720, 620, 720, 1040, 60, 1040]),
            _room(g, "Foyer & Staircase", [720, 60, 1340, 60, 1340, 560, 720, 560]),
            _room(g, "Guest Bedroom", [720, 560, 1340, 560, 1340, 1040, 980, 1040, 980, 820, 720, 820]),
            _room(g, "Guest Bath", [720, 820, 980, 820, 980, 1040, 720, 1040]),
            _room(g, "Front Deck", [1350, 90, 1520, 90, 1520, 540, 1350, 540],
                  color="#dbeafe", props={"wall_height": 100}),
        ]
        els += [
            _opening(g, DOOR, "Main Entrance", 1030, 60, 110, "#b45309", rot=0, props={"swing": "left", "open_angle": 90}),
            _opening(g, DOOR, "Kitchen Door", 720, 800, 90, "#b45309", rot=90, props={"swing": "right", "open_angle": 90}),
            _opening(g, DOOR, "Guest Bedroom Door", 720, 660, 90, "#b45309", rot=90, props={"swing": "left", "open_angle": 90}),
            _opening(g, DOOR, "Guest Bath Door", 850, 820, 75, "#b45309", rot=0, props={"swing": "left", "open_angle": 80}),
            _opening(g, WIN, "Living Window", 60, 300, 180, "#7dd3fc", rot=90, props={"sill_cm": 90}),
            _opening(g, WIN, "Guest Window", 1340, 760, 150, "#7dd3fc", rot=90, props={"sill_cm": 90}),
        ]
        els += [
            # flooring zones (drawn first so they read as the base)
            _place(g, c["Marble Flooring (Area)"], 390, 340, w=620, d=520, name="Living marble"),
            _place(g, c["Vitrified Tile (Area)"], 390, 830, w=620, d=400, name="Kitchen tile"),
            _place(g, c["Wooden Flooring (Area)"], 1030, 700, w=240, d=240, name="Guest wood"),
            _place(g, c["Area Rug"], 250, 230, client_editable=True),
            # false ceiling
            _place(g, c["Gypsum Ceiling Panel"], 390, 340, w=560, d=460, name="Living false ceiling"),
            _place(g, c["Cove Light Channel"], 390, 130, w=520, d=12, name="Living cove"),
            _place(g, c["POP Tile / Cornice"], 1030, 300),
            # furniture
            _place(g, c["Sofa (3-seat)"], 200, 150, client_editable=True),
            _place(g, c["Coffee Table"], 250, 260, client_editable=True),
            _place(g, c["TV Unit"], 200, 560),
            _place(g, c["Dining Table (6)"], 520, 300),
            _place(g, c["Kitchen Counter"], 180, 660, rot=0),
            _place(g, c["Kitchen Island"], 400, 830),
            _place(g, c["Double Bed"], 1180, 680, client_editable=True),
            _place(g, c["Wardrobe / Cupboard"], 1280, 950, rot=90),
            # appliances
            _place(g, c["Refrigerator"], 120, 760),
            _place(g, c["Television"], 200, 540),
            _place(g, c["Split AC Indoor"], 660, 90),
            # staircase to the first floor (sized to this floor's height)
            _place(g, c["Staircase (straight)"], 1230, 300, h=320, name="Main Staircase"),
            # plumbing
            _place(g, c["WC / Toilet"], 760, 980),
            _place(g, c["Wash Basin"], 900, 980),
            _place(g, c["Shower"], 760, 870),
            _place(g, c["Kitchen Sink"], 300, 660),
            _place(g, c["Water Geyser"], 940, 850),
            # lighting / hvac / electrical / networking
            _place(g, c["Pendant Light"], 520, 280),
            _place(g, c["Ceiling Light"], 200, 450),
            _place(g, c["Ceiling Light"], 1030, 700),
            _place(g, c["Spotlight"], 390, 130),
            _place(g, c["Ceiling Fan"], 1100, 700),
            _place(g, c["Switchboard (6-module)"], 80, 200, name="Living SB"),
            _place(g, c["Distribution Board"], 760, 90, name="Main DB"),
            _place(g, c["CCTV Camera"], 1300, 90),
            _place(g, c["Router / AP"], 800, 120),
        ]
        els[[e.name for e in els].index("Refrigerator")].is_existing = True

        # ---- First floor ----
        els += [
            _wall(u, "Perimeter", [60, 60, 1340, 60, 1340, 1040, 60, 1040, 60, 60]),
            _wall(u, "Master split", [720, 60, 720, 1040]),
            _wall(u, "Lounge/Bedroom split", [720, 560, 1340, 560]),
            _wall(u, "Master bath", [60, 620, 360, 620]),
            _wall(u, "Master bath", [360, 620, 360, 1040]),
        ]
        els += [
            _room(u, "Master Bedroom", [360, 60, 720, 60, 720, 1040, 360, 1040, 360, 620, 60, 620, 60, 60]),
            _room(u, "Master Bath", [60, 620, 360, 620, 360, 1040, 60, 1040]),
            _room(u, "Family Lounge", [720, 60, 1340, 60, 1340, 560, 720, 560]),
            _room(u, "Kids Bedroom", [720, 560, 1340, 560, 1340, 1040, 720, 1040]),
            _room(u, "Master Balcony", [370, 1050, 710, 1050, 710, 1220, 370, 1220],
                  color="#dbeafe", props={"wall_height": 100}),
        ]
        els += [
            _opening(u, DOOR, "Master Door", 540, 60, 90, "#b45309", rot=0, props={"swing": "left", "open_angle": 90}),
            _opening(u, DOOR, "Master Bath Door", 360, 720, 80, "#b45309", rot=90, props={"swing": "right", "open_angle": 80}),
            _opening(u, DOOR, "Kids Door", 720, 700, 90, "#b45309", rot=90, props={"swing": "left", "open_angle": 90}),
            _opening(u, WIN, "Master Window", 540, 60, 160, "#7dd3fc", rot=0, props={"sill_cm": 90}),
            _opening(u, WIN, "Lounge Window", 1340, 300, 180, "#7dd3fc", rot=90, props={"sill_cm": 90}),
            _opening(u, WIN, "Kids Window", 1340, 800, 150, "#7dd3fc", rot=90, props={"sill_cm": 90}),
        ]
        els += [
            _place(u, c["Wooden Flooring (Area)"], 440, 360, w=720, d=560, name="Master wood"),
            _place(u, c["Vitrified Tile (Area)"], 210, 830, w=280, d=400, name="Bath tile"),
            _place(u, c["Marble Flooring (Area)"], 1030, 300, w=600, d=480, name="Lounge marble"),
            _place(u, c["Gypsum Ceiling Panel"], 440, 360, w=640, d=500, name="Master false ceiling"),
            _place(u, c["Cove Light Channel"], 440, 130, w=560, d=12, name="Master cove"),
            _place(u, c["Double Bed"], 540, 300, client_editable=True),
            _place(u, c["Wardrobe / Cupboard"], 680, 850, rot=90),
            _place(u, c["Study Desk"], 200, 250),
            _place(u, c["Single Bed"], 850, 700, client_editable=True),
            _place(u, c["Single Bed"], 1180, 700, client_editable=True),
            _place(u, c["Sofa (3-seat)"], 950, 180),
            _place(u, c["Television"], 1280, 180),
            _place(u, c["WC / Toilet"], 110, 870),
            _place(u, c["Wash Basin"], 280, 980),
            _place(u, c["Shower"], 110, 980),
            _place(u, c["Split AC Indoor"], 700, 120, rot=180),
            _place(u, c["Split AC Indoor"], 1000, 1010),
            _place(u, c["Ceiling Light"], 540, 300),
            _place(u, c["Ceiling Light"], 1030, 300),
            _place(u, c["Ceiling Fan"], 540, 450),
            _place(u, c["Ceiling Fan"], 1030, 750),
            _place(u, c["Switchboard (6-module)"], 740, 90, name="Lounge SB"),
            _place(u, c["Ceiling Speaker"], 1030, 200),
        ]
        db.add_all(els)
        for i, (label, cat, qty, unit, cost) in enumerate([
            ("Civil work — RCC frame & masonry (2 floors)", "Civil Work", 1, "job", 850000),
            ("Staircase — RCC + railing", "Civil Work", 1, "job", 180000),
            ("Painting — whole villa", "Painting", 1, "job", 140000),
            ("False ceiling — living, lounge & master", "False Ceiling", 95, "sqm", 1400),
        ]):
            db.add(CostItem(project_id=v1.id, label=label, category=cat,
                            quantity=qty, unit=unit, unit_cost=cost, sort_order=i))
        db.commit()
        print(f"   seeded '{v1.name}' ({len(els)} elements across 2 floors)")

    # ============================ Villa 2: Hillside Duplex Villa ==================
    if not db.scalar(select(Project).where(Project.name == "Hillside Duplex Villa")):
        v2 = _new_project(
            db, designer, client,
            name="Hillside Duplex Villa",
            description="Compact contemporary duplex: open-plan living/kitchen + office below, three bedrooms above.",
            address="7 Ridge View, Coonoor",
            client_name="Demo Client",
            floors_spec=[
                {"name": "Ground Floor", "level": 0, "width": 1100, "height": 900, "wall_height": 300},
                {"name": "Upper Floor", "level": 1, "width": 1100, "height": 900, "wall_height": 290},
            ],
        )
        g, u = v2.floors[0].id, v2.floors[1].id
        els = []

        els += [
            _wall(g, "Perimeter", [60, 60, 1040, 60, 1040, 840, 60, 840, 60, 60]),
            _wall(g, "Office split", [700, 60, 700, 440]),
            _wall(g, "Office/Bath split", [700, 440, 1040, 440]),
            _wall(g, "Powder room", [700, 640, 1040, 640]),
        ]
        els += [
            _room(g, "Open Living / Kitchen", [60, 60, 700, 60, 700, 840, 60, 840]),
            _room(g, "Home Office", [700, 60, 1040, 60, 1040, 440, 700, 440]),
            _room(g, "Utility / Bath", [700, 440, 1040, 440, 1040, 640, 700, 640]),
            _room(g, "Powder Room", [700, 640, 1040, 640, 1040, 840, 700, 840]),
            _room(g, "Sit-out Deck", [1050, 90, 1240, 90, 1240, 420, 1050, 420],
                  color="#dbeafe", props={"wall_height": 100}),
        ]
        els += [
            _opening(g, DOOR, "Main Entrance", 380, 60, 110, "#b45309", rot=0, props={"swing": "left", "open_angle": 90}),
            _opening(g, DOOR, "Office Door", 700, 250, 85, "#b45309", rot=90, props={"swing": "left", "open_angle": 90}),
            _opening(g, DOOR, "Bath Door", 700, 540, 75, "#b45309", rot=90, props={"swing": "right", "open_angle": 80}),
            _opening(g, WIN, "Living Window", 60, 400, 200, "#7dd3fc", rot=90, props={"sill_cm": 80}),
            _opening(g, WIN, "Office Window", 1040, 250, 150, "#7dd3fc", rot=90, props={"sill_cm": 90}),
        ]
        els += [
            _place(g, c["Wooden Flooring (Area)"], 380, 450, w=600, d=720, name="Living wood"),
            _place(g, c["Marble Flooring (Area)"], 870, 250, w=300, d=340, name="Office marble"),
            _place(g, c["Gypsum Ceiling Panel"], 380, 300, w=560, d=440, name="Living false ceiling"),
            _place(g, c["Cove Light Channel"], 380, 110, w=520, d=12),
            _place(g, c["Area Rug"], 250, 220, client_editable=True),
            _place(g, c["Sofa (3-seat)"], 200, 160, client_editable=True),
            _place(g, c["Coffee Table"], 250, 270, client_editable=True),
            _place(g, c["TV Unit"], 200, 700),
            _place(g, c["Dining Table (6)"], 480, 250),
            _place(g, c["Kitchen Counter"], 180, 760, rot=0),
            _place(g, c["Kitchen Sink"], 300, 760),
            _place(g, c["Refrigerator"], 120, 660),
            _place(g, c["Study Desk"], 870, 150),
            _place(g, c["Bookshelf"], 1000, 120, rot=90),
            _place(g, c["Staircase (straight)"], 620, 250, h=300, name="Main Staircase"),
            _place(g, c["WC / Toilet"], 740, 760),
            _place(g, c["Wash Basin"], 900, 760),
            _place(g, c["Washing Machine"], 900, 500),
            _place(g, c["Split AC Indoor"], 640, 90),
            _place(g, c["Pendant Light"], 480, 230),
            _place(g, c["Ceiling Light"], 200, 450),
            _place(g, c["Ceiling Fan"], 380, 500),
            _place(g, c["Switchboard (6-module)"], 80, 200, name="Living SB"),
            _place(g, c["Distribution Board"], 660, 90, name="Main DB"),
            _place(g, c["Router / AP"], 780, 100),
            _place(g, c["CCTV Camera"], 1000, 90),
        ]
        els[[e.name for e in els].index("Refrigerator")].is_existing = True

        els += [
            _wall(u, "Perimeter", [60, 60, 1040, 60, 1040, 840, 60, 840, 60, 60]),
            _wall(u, "Bedroom split", [560, 60, 560, 840]),
            _wall(u, "Upper split", [560, 450, 1040, 450]),
            _wall(u, "Bath", [60, 560, 300, 560]),
            _wall(u, "Bath", [300, 560, 300, 840]),
        ]
        els += [
            _room(u, "Master Bedroom", [300, 60, 560, 60, 560, 840, 300, 840, 300, 560, 60, 560, 60, 60]),
            _room(u, "Master Bath", [60, 560, 300, 560, 300, 840, 60, 840]),
            _room(u, "Bedroom 2", [560, 60, 1040, 60, 1040, 450, 560, 450]),
            _room(u, "Bedroom 3", [560, 450, 1040, 450, 1040, 840, 560, 840]),
            _room(u, "Balcony", [310, 850, 550, 850, 550, 1010, 310, 1010],
                  color="#dbeafe", props={"wall_height": 100}),
        ]
        els += [
            _opening(u, DOOR, "Master Door", 440, 60, 85, "#b45309", rot=0, props={"swing": "left", "open_angle": 90}),
            _opening(u, DOOR, "Master Bath Door", 300, 650, 75, "#b45309", rot=90, props={"swing": "left", "open_angle": 80}),
            _opening(u, DOOR, "Bedroom 2 Door", 560, 250, 85, "#b45309", rot=90, props={"swing": "right", "open_angle": 90}),
            _opening(u, DOOR, "Bedroom 3 Door", 560, 650, 85, "#b45309", rot=90, props={"swing": "left", "open_angle": 90}),
            _opening(u, WIN, "Master Window", 60, 300, 160, "#7dd3fc", rot=90, props={"sill_cm": 90}),
            _opening(u, WIN, "Bedroom 2 Window", 1040, 250, 150, "#7dd3fc", rot=90, props={"sill_cm": 90}),
            _opening(u, WIN, "Bedroom 3 Window", 1040, 650, 150, "#7dd3fc", rot=90, props={"sill_cm": 90}),
        ]
        els += [
            _place(u, c["Wooden Flooring (Area)"], 300, 300, w=460, d=460, name="Master wood"),
            _place(u, c["Wooden Flooring (Area)"], 800, 250, w=440, d=340, name="Bed2 wood"),
            _place(u, c["Vitrified Tile (Area)"], 180, 700, w=220, d=240, name="Bath tile"),
            _place(u, c["Gypsum Ceiling Panel"], 300, 300, w=420, d=420, name="Master false ceiling"),
            _place(u, c["POP Tile / Cornice"], 800, 250),
            _place(u, c["Double Bed"], 420, 250, client_editable=True),
            _place(u, c["Wardrobe / Cupboard"], 520, 700, rot=90),
            _place(u, c["Single Bed"], 700, 200, client_editable=True),
            _place(u, c["Single Bed"], 700, 650, client_editable=True),
            _place(u, c["Study Desk"], 950, 150),
            _place(u, c["WC / Toilet"], 110, 650),
            _place(u, c["Wash Basin"], 250, 790),
            _place(u, c["Shower"], 110, 790),
            _place(u, c["Water Geyser"], 270, 590),
            _place(u, c["Split AC Indoor"], 440, 90),
            _place(u, c["Ceiling Light"], 300, 300),
            _place(u, c["Ceiling Light"], 800, 250),
            _place(u, c["Ceiling Light"], 800, 650),
            _place(u, c["Ceiling Fan"], 420, 400),
            _place(u, c["Switchboard (6-module)"], 580, 90, name="Bed2 SB"),
            _place(u, c["CCTV Camera"], 1000, 90),
        ]
        db.add_all(els)
        for i, (label, cat, qty, unit, cost) in enumerate([
            ("Civil work — duplex shell", "Civil Work", 1, "job", 620000),
            ("Painting — interior & exterior", "Painting", 1, "job", 110000),
            ("False ceiling — living & master", "False Ceiling", 55, "sqm", 1400),
        ]):
            db.add(CostItem(project_id=v2.id, label=label, category=cat,
                            quantity=qty, unit=unit, unit_cost=cost, sort_order=i))
        db.commit()
        print(f"   seeded '{v2.name}' ({len(els)} elements across 2 floors)")


def main() -> None:
    db = SessionLocal()
    try:
        catalog = seed_catalog(db)
        print(f"   catalog: {len(catalog)} items")
        if settings.SEED_DEMO:
            seed_demo(db, catalog)
            seed_villas(db, catalog)
    finally:
        db.close()


if __name__ == "__main__":
    main()
