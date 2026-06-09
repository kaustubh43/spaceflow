import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbDep, require_project_role
from app.core.config import settings
from app.models import Asset, MembershipRole, Project
from app.schemas.asset import AssetOut

router = APIRouter(prefix="/projects/{project_id}/assets", tags=["assets"])

# allowed image types -> file extension
ALLOWED = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB


@router.get("", response_model=list[AssetOut])
def list_assets(
    project_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.viewer)),
) -> list[Asset]:
    return db.scalars(
        select(Asset)
        .where(Asset.project_id == project_id)
        .order_by(Asset.created_at.desc())
    ).all()


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def upload_asset(
    project_id: int,
    db: DbDep,
    user: CurrentUser,
    file: UploadFile = File(...),
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> Asset:
    ext = ALLOWED.get(file.content_type or "")
    if not ext:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only image uploads are allowed")
    data = file.file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File too large (max 10 MB)")

    dest_dir = Path(settings.UPLOAD_DIR) / str(project_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{uuid.uuid4().hex}.{ext}"
    (dest_dir / fname).write_bytes(data)

    asset = Asset(
        project_id=project_id,
        filename=fname,
        original_name=file.filename or "",
        content_type=file.content_type or "",
        size=len(data),
        uploaded_by=user.id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    project_id: int,
    asset_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> None:
    asset = db.get(Asset, asset_id)
    if asset and asset.project_id == project_id:
        try:
            (Path(settings.UPLOAD_DIR) / str(project_id) / asset.filename).unlink(missing_ok=True)
        except OSError:
            pass
        db.delete(asset)
        db.commit()
