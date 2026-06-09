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

# serve uploaded assets (unguessable uuid filenames) at /uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.PROJECT_NAME}
