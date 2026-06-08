from tests.conftest import auth, first_floor, make_project, register


def test_snapshot_create_and_restore(client):
    token = register(client)
    p = make_project(client, token)
    floor = first_floor(client, token, p["id"])
    base = f"/api/projects/{p['id']}/floors/{floor['id']}/elements"

    bed = client.post(
        base + "/bulk",
        json={"creates": [{"kind": "item", "layer": "furniture", "name": "Bed", "x": 100}]},
        headers=auth(token),
    ).json()["items"][0]

    snap = client.post(
        f"/api/projects/{p['id']}/snapshots", json={"label": "v1"}, headers=auth(token)
    ).json()

    # move the bed, then restore
    client.post(base + "/bulk", json={"updates": {str(bed["id"]): {"x": 500}}}, headers=auth(token))
    moved = client.get(base, headers=auth(token)).json()[0]
    assert moved["x"] == 500

    r = client.post(
        f"/api/projects/{p['id']}/snapshots/{snap['id']}/restore", headers=auth(token)
    )
    assert r.status_code == 204
    els = client.get(base, headers=auth(token)).json()
    assert any(e["name"] == "Bed" and e["x"] == 100 for e in els)
