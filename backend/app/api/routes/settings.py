from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbDep
from app.models import AppSettings, UserRole
from app.schemas.settings import AppSettingsOut, AppSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create(db) -> AppSettings:
    settings = db.get(AppSettings, 1)
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("", response_model=AppSettingsOut)
def get_settings(db: DbDep, user: CurrentUser) -> AppSettings:
    return _get_or_create(db)


@router.put("", response_model=AppSettingsOut)
def update_settings(
    payload: AppSettingsUpdate, db: DbDep, user: CurrentUser
) -> AppSettings:
    # only designers act as application admins
    if user.role != UserRole.designer:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only designers can change application settings"
        )
    settings = _get_or_create(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings
