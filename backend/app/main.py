import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    assets,
    auth,
    catalog,
    comments,
    elements,
    floors,
    projects,
    reports,
    settings as settings_routes,
    share,
)
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (
    auth,
    projects,
    floors,
    elements,
    catalog,
    comments,
    reports,
    settings_routes,
    share,
    assets,
):
    app.include_router(module.router, prefix=settings.API_PREFIX)

# public, no-auth router for tokenized share links
app.include_router(share.public_router, prefix=settings.API_PREFIX)

# serve uploaded assets (unguessable uuid filenames) at /uploads.
# Best-effort dir creation: don't crash at import if the path isn't writable
# (e.g. CI, where UPLOAD_DIR defaults to /app/uploads but /app isn't writable);
# check_dir=False lets the mount succeed even if the dir doesn't exist yet.
try:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
except OSError:
    pass
app.mount(
    "/uploads",
    StaticFiles(directory=settings.UPLOAD_DIR, check_dir=False),
    name="uploads",
)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.PROJECT_NAME}
