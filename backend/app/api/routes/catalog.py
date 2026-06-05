from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUser, DbDep
from app.models import CatalogItem
from app.schemas.misc import CatalogItemOut

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("", response_model=list[CatalogItemOut])
def list_catalog(
    db: DbDep,
    user: CurrentUser,
    category: str | None = None,
) -> list[CatalogItem]:
    stmt = select(CatalogItem).order_by(CatalogItem.category, CatalogItem.name)
    if category:
        stmt = stmt.where(CatalogItem.category == category)
    return db.scalars(stmt).all()
