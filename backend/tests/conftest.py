"""Test harness: spins up an isolated `idesigner_test` database, recreates the
schema from the models, and overrides the app's DB dependency. Tables are
truncated before each test for isolation. Requires a reachable Postgres
(the compose `db` service locally, or the CI `postgres` service)."""
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401  (register models on Base.metadata)
from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app

TEST_DB = "idesigner_test"


def _swap_db(url: str, name: str) -> str:
    return url.rsplit("/", 1)[0] + "/" + name


BASE_URL = os.environ.get("DATABASE_URL", settings.DATABASE_URL)
TEST_URL = _swap_db(BASE_URL, TEST_DB)


@pytest.fixture(scope="session")
def engine():
    # create the test database if it doesn't exist
    admin = create_engine(_swap_db(BASE_URL, "postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        exists = c.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": TEST_DB}
        ).scalar()
        if not exists:
            c.execute(text(f'CREATE DATABASE "{TEST_DB}"'))
    admin.dispose()

    eng = create_engine(TEST_URL)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def client(engine):
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    # isolate tests: truncate every table before each one
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(text(f'TRUNCATE TABLE "{table.name}" RESTART IDENTITY CASCADE'))

    def _get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---- helpers ----
def register(client, email="designer@test.app", role="designer", name="Test User"):
    r = client.post(
        "/api/auth/register",
        json={"email": email, "full_name": name, "password": "pw12345", "role": role},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def make_project(client, token, name="House A"):
    r = client.post("/api/projects", json={"name": name}, headers=auth(token))
    assert r.status_code == 201, r.text
    return r.json()


def first_floor(client, token, project_id):
    r = client.get(f"/api/projects/{project_id}/floors", headers=auth(token))
    assert r.status_code == 200
    return r.json()[0]
