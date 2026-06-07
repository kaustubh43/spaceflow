from tests.conftest import auth, register


def test_register_login_me(client):
    token = register(client, email="a@test.app")
    me = client.get("/api/auth/me", headers=auth(token))
    assert me.status_code == 200
    assert me.json()["email"] == "a@test.app"
    assert me.json()["role"] == "designer"


def test_duplicate_email_conflicts(client):
    register(client, email="dup@test.app")
    r = client.post(
        "/api/auth/register",
        json={"email": "dup@test.app", "full_name": "X", "password": "pw12345"},
    )
    assert r.status_code == 409


def test_login_and_bad_password(client):
    register(client, email="b@test.app")
    ok = client.post("/api/auth/login", json={"email": "b@test.app", "password": "pw12345"})
    assert ok.status_code == 200 and "access_token" in ok.json()
    bad = client.post("/api/auth/login", json={"email": "b@test.app", "password": "nope"})
    assert bad.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code == 401
