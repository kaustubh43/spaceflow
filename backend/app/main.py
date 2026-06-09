from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
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
):
    app.include_router(module.router, prefix=settings.API_PREFIX)

# public, no-auth router for tokenized share links
app.include_router(share.public_router, prefix=settings.API_PREFIX)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.PROJECT_NAME}
