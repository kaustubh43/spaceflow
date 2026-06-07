from tests.conftest import auth, register


def test_settings_default_and_update(client):
    token = register(client)  # designer
    s = client.get("/api/settings", headers=auth(token))
    assert s.status_code == 200
    assert s.json()["currency_code"] == "INR"

    upd = client.put(
        "/api/settings",
        json={"currency_code": "USD", "currency_symbol": "$", "currency_locale": "en-US"},
        headers=auth(token),
    )
    assert upd.status_code == 200
    assert upd.json()["currency_code"] == "USD"


def test_client_cannot_change_settings(client):
    ctoken = register(client, email="cl@test.app", role="client")
    r = client.put("/api/settings", json={"app_name": "Nope"}, headers=auth(ctoken))
    assert r.status_code == 403
