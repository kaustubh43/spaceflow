from tests.conftest import auth, first_floor, make_project, register


def test_bulk_create_update_delete(client):
    token = register(client)
    p = make_project(client, token)
    floor = first_floor(client, token, p["id"])
    base = f"/api/projects/{p['id']}/floors/{floor['id']}/elements"

    # create two elements via bulk, with client (temp) ids for id-map remapping
    r = client.post(
        base + "/bulk",
        json={
            "creates": [
                {"kind": "item", "layer": "furniture", "name": "Sofa", "x": 100, "y": 100, "client_id": -1},
                {"kind": "wall", "layer": "architecture", "name": "W", "points": [0, 0, 200, 0], "client_id": -2},
            ]
        },
        headers=auth(token),
    )
    assert r.status_code == 200
    body = r.json()
    els = body["items"]
    assert len(els) == 2
    # the id_map echoes each temp id to its new database id
    assert set(body["id_map"].keys()) == {"-1", "-2"}
    sofa = next(e for e in els if e["name"] == "Sofa")
    assert body["id_map"]["-1"] == sofa["id"]

    # update the sofa position
    r = client.post(
        base + "/bulk",
        json={"updates": {str(sofa["id"]): {"x": 333}}},
        headers=auth(token),
    )
    moved = next(e for e in r.json()["items"] if e["id"] == sofa["id"])
    assert moved["x"] == 333

    # delete it
    r = client.post(base + "/bulk", json={"deletes": [sofa["id"]]}, headers=auth(token))
    items = r.json()["items"]
    assert all(e["id"] != sofa["id"] for e in items)
    assert len(items) == 1


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
