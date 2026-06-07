from tests.conftest import auth, make_project, register


def test_create_and_list_project(client):
    token = register(client)
    p = make_project(client, token, "Villa")
    assert p["name"] == "Villa"
    # a ground floor is auto-created
    floors = client.get(f"/api/projects/{p['id']}/floors", headers=auth(token)).json()
    assert len(floors) == 1

    # the listing reports the requester's role on each project
    listing = client.get("/api/projects", headers=auth(token)).json()
    mine = next(x for x in listing if x["id"] == p["id"])
    assert mine["my_role"] == "owner"

    # fetching the project detail also reports the role
    detail = client.get(f"/api/projects/{p['id']}", headers=auth(token)).json()
    assert detail["my_role"] == "owner"


def test_non_member_cannot_access(client):
    owner = register(client, email="owner@test.app")
    p = make_project(client, owner)
    intruder = register(client, email="intruder@test.app")
    r = client.get(f"/api/projects/{p['id']}", headers=auth(intruder))
    assert r.status_code == 403


def test_add_member_and_role(client):
    owner = register(client, email="o2@test.app")
    p = make_project(client, owner)
    register(client, email="client@test.app", role="client")
    r = client.post(
        f"/api/projects/{p['id']}/members",
        json={"email": "client@test.app", "role": "contributor"},
        headers=auth(owner),
    )
    assert r.status_code == 200
    assert r.json()["role"] == "contributor"


def test_contributor_cannot_add_elements(client):
    owner = register(client, email="o3@test.app")
    p = make_project(client, owner)
    contributor = register(client, email="c3@test.app", role="client")
    client.post(
        f"/api/projects/{p['id']}/members",
        json={"email": "c3@test.app", "role": "contributor"},
        headers=auth(owner),
    )
    floor = client.get(f"/api/projects/{p['id']}/floors", headers=auth(owner)).json()[0]
    r = client.post(
        f"/api/projects/{p['id']}/floors/{floor['id']}/elements",
        json={"kind": "item", "layer": "furniture", "name": "Chair"},
        headers=auth(contributor),
    )
    assert r.status_code == 403
