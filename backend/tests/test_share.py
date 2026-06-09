from tests.conftest import auth, first_floor, make_project, register


def test_share_link_public_view_and_revoke(client):
    token = register(client)
    p = make_project(client, token)
    floor = first_floor(client, token, p["id"])
    base = f"/api/projects/{p['id']}/floors/{floor['id']}/elements"

    # add an element so the shared floor has content
    client.post(
        base + "/bulk",
        json={"creates": [{"kind": "item", "layer": "furniture", "name": "Sofa", "x": 100, "y": 100}]},
        headers=auth(token),
    )

    # create a share link (editor+)
    r = client.post(f"/api/projects/{p['id']}/share", json={"label": "Client view"}, headers=auth(token))
    assert r.status_code == 201
    link = r.json()
    share_token = link["token"]
    assert share_token and link["label"] == "Client view"

    # it shows up in the list
    links = client.get(f"/api/projects/{p['id']}/share", headers=auth(token)).json()
    assert any(l["token"] == share_token for l in links)

    # PUBLIC: no auth header needed
    pub = client.get(f"/api/shared/{share_token}")
    assert pub.status_code == 200
    body = pub.json()
    assert body["name"] == p["name"]
    assert len(body["floors"]) >= 1

    els = client.get(f"/api/shared/{share_token}/floors/{floor['id']}/elements")
    assert els.status_code == 200
    assert any(e["name"] == "Sofa" for e in els.json())

    # bad token -> 404
    assert client.get("/api/shared/not-a-real-token").status_code == 404

    # revoke -> public access gone
    assert client.delete(f"/api/projects/{p['id']}/share/{link['id']}", headers=auth(token)).status_code == 204
    assert client.get(f"/api/shared/{share_token}").status_code == 404


def test_catalog_is_public(client):
    # catalog is reference data: reachable without authentication
    r = client.get("/api/catalog")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
