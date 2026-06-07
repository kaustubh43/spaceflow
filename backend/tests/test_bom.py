from sqlalchemy.orm import sessionmaker

from app.models import CatalogItem, ElementKind, LayerType
from tests.conftest import auth, first_floor, make_project, register


def _add_catalog(engine, unit_cost=10000.0) -> int:
    Session = sessionmaker(bind=engine)
    db = Session()
    c = CatalogItem(
        name="Test Sofa", category="Living", layer=LayerType.furniture,
        kind=ElementKind.item, default_width_cm=200, default_depth_cm=90,
        default_height_cm=85, color="#000000", unit_cost=unit_cost, default_properties={},
    )
    db.add(c)
    db.commit()
    cid = c.id
    db.close()
    return cid


def test_bom_existing_manual_and_override(client, engine):
    token = register(client)
    p = make_project(client, token)
    floor = first_floor(client, token, p["id"])
    base = f"/api/projects/{p['id']}/floors/{floor['id']}/elements"
    cid = _add_catalog(engine, 10000)

    # 2 charged + 1 existing (not charged)
    client.post(
        base + "/bulk",
        json={
            "creates": [
                {"kind": "item", "layer": "furniture", "name": "S", "catalog_item_id": cid},
                {"kind": "item", "layer": "furniture", "name": "S", "catalog_item_id": cid},
                {"kind": "item", "layer": "furniture", "name": "S", "catalog_item_id": cid, "is_existing": True},
            ]
        },
        headers=auth(token),
    )
    # a manual work line
    client.post(
        f"/api/projects/{p['id']}/cost-items",
        json={"label": "Labour", "category": "Labour", "quantity": 1, "unit_cost": 5000},
        headers=auth(token),
    )

    bom = client.get(f"/api/projects/{p['id']}/bom", headers=auth(token)).json()
    assert bom["existing_value"] == 10000          # the existing sofa, not charged
    assert bom["charged_total"] == 25000           # 2*10000 + 5000 labour
    cats = {l["category"] for l in bom["lines"]}
    assert {"Living", "Labour"} <= cats

    # override the catalog item's unit cost across the project
    r = client.post(
        f"/api/projects/{p['id']}/bom/item-override",
        json={"catalog_item_id": cid, "unit_cost": 20000},
        headers=auth(token),
    )
    assert r.status_code == 204
    bom2 = client.get(f"/api/projects/{p['id']}/bom", headers=auth(token)).json()
    assert bom2["charged_total"] == 45000          # 2*20000 + 5000
