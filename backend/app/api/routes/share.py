import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbDep, require_project_role
from app.models import Element, Floor, MembershipRole, Project, ShareLink
from app.schemas.element import ElementOut
from app.schemas.share import ShareLinkCreate, ShareLinkOut, SharedProjectOut

# ---- authed management: /projects/{id}/share ----
router = APIRouter(prefix="/projects/{project_id}/share", tags=["share"])


@router.get("", response_model=list[ShareLinkOut])
def list_share_links(
    project_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> list[ShareLink]:
    return db.scalars(
        select(ShareLink)
        .where(ShareLink.project_id == project_id, ShareLink.revoked == False)  # noqa: E712
        .order_by(ShareLink.created_at.desc())
    ).all()


@router.post("", response_model=ShareLinkOut, status_code=status.HTTP_201_CREATED)
def create_share_link(
    project_id: int,
    payload: ShareLinkCreate,
    db: DbDep,
    user: CurrentUser,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> ShareLink:
    link = ShareLink(
        project_id=project_id,
        token=secrets.token_urlsafe(16),
        created_by=user.id,
        label=payload.label or "",
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_share_link(
    project_id: int,
    link_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> None:
    link = db.get(ShareLink, link_id)
    if link and link.project_id == project_id:
        db.delete(link)
        db.commit()


# ---- public, no auth: /shared/{token} ----
public_router = APIRouter(prefix="/shared", tags=["share-public"])


def _project_for_token(db: DbDep, token: str) -> Project:
    link = db.scalar(
        select(ShareLink).where(
            ShareLink.token == token, ShareLink.revoked == False  # noqa: E712
        )
    )
    if link is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid or expired link")
    project = db.get(Project, link.project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


@public_router.get("/{token}", response_model=SharedProjectOut)
def shared_project(token: str, db: DbDep) -> SharedProjectOut:
    project = _project_for_token(db, token)
    floors = db.scalars(
        select(Floor).where(Floor.project_id == project.id).order_by(Floor.level)
    ).all()
    return SharedProjectOut(
        name=project.name,
        client_name=project.client_name,
        units=project.units,
        floors=floors,
    )


@public_router.get("/{token}/floors/{floor_id}/elements", response_model=list[ElementOut])
def shared_floor_elements(token: str, floor_id: int, db: DbDep) -> list[Element]:
    project = _project_for_token(db, token)
    floor = db.get(Floor, floor_id)
    if floor is None or floor.project_id != project.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Floor not found")
    return db.scalars(
        select(Element).where(Element.floor_id == floor_id).order_by(Element.z_index)
    ).all()
