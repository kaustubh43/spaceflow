from tests.conftest import auth, first_floor, make_project, register


def test_bulk_create_update_delete(client):
    token = register(client)
    p = make_project(client, token)
    floor = first_floor(client, token, p["id"])
    base = f"/api/projects/{p['id']}/floors/{floor['id']}/elements"

    # create two elements via bulk
    r = client.post(
        base + "/bulk",
        json={
            "creates": [
                {"kind": "item", "layer": "furniture", "name": "Sofa", "x": 100, "y": 100},
                {"kind": "wall", "layer": "architecture", "name": "W", "points": [0, 0, 200, 0]},
            ]
        },
        headers=auth(token),
    )
    assert r.status_code == 200
    els = r.json()
    assert len(els) == 2
    sofa = next(e for e in els if e["name"] == "Sofa")

    # update the sofa position
    r = client.post(
        base + "/bulk",
        json={"updates": {str(sofa["id"]): {"x": 333}}},
        headers=auth(token),
    )
    moved = next(e for e in r.json() if e["id"] == sofa["id"])
    assert moved["x"] == 333

    # delete it
    r = client.post(base + "/bulk", json={"deletes": [sofa["id"]]}, headers=auth(token))
    assert all(e["id"] != sofa["id"] for e in r.json())
    assert len(r.json()) == 1


def test_single_element_crud(client):
    token = register(client)
    p = make_project(client, token)
    floor = first_floor(client, token, p["id"])
    base = f"/api/projects/{p['id']}/floors/{floor['id']}/elements"

    created = client.post(
        base,
        json={"kind": "item", "layer": "furniture", "name": "Bed", "width_cm": 160},
        headers=auth(token),
    )
    assert created.status_code == 201
    eid = created.json()["id"]

    patched = client.patch(f"{base}/{eid}", json={"width_cm": 180}, headers=auth(token))
    assert patched.json()["width_cm"] == 180

    assert client.delete(f"{base}/{eid}", headers=auth(token)).status_code == 204
