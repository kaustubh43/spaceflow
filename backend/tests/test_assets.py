import base64

from tests.conftest import auth, make_project, register

# a minimal valid 1x1 PNG
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def test_asset_upload_list_serve_delete(client):
    token = register(client)
    p = make_project(client, token)
    base = f"/api/projects/{p['id']}/assets"

    # upload an image
    r = client.post(
        base,
        files={"file": ("moodboard.png", PNG, "image/png")},
        headers=auth(token),
    )
    assert r.status_code == 201
    asset = r.json()
    assert asset["original_name"] == "moodboard.png"
    assert asset["url"].startswith(f"/uploads/{p['id']}/")
    assert asset["url"].endswith(".png")

    # it lists
    items = client.get(base, headers=auth(token)).json()
    assert any(a["id"] == asset["id"] for a in items)

    # the static mount serves the file
    served = client.get(asset["url"])
    assert served.status_code == 200
    assert served.content == PNG

    # non-image is rejected
    bad = client.post(
        base,
        files={"file": ("notes.txt", b"hello", "text/plain")},
        headers=auth(token),
    )
    assert bad.status_code == 400

    # delete removes it
    assert client.delete(f"{base}/{asset['id']}", headers=auth(token)).status_code == 204
    assert all(a["id"] != asset["id"] for a in client.get(base, headers=auth(token)).json())
