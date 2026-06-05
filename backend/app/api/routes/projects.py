from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import (
    CurrentUser,
    DbDep,
    get_membership,
    require_project_role,
)
from app.models import (
    Floor,
    MembershipRole,
    Project,
    ProjectMembership,
    User,
)
from app.schemas.project import (
    AddMemberRequest,
    MembershipOut,
    ProjectCreate,
    ProjectDetailOut,
    ProjectOut,
    ProjectUpdate,
    UpdateMemberRequest,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_out(project: Project, role: MembershipRole | None) -> ProjectOut:
    out = ProjectOut.model_validate(project)
    out.my_role = role
    return out


@router.get("", response_model=list[ProjectOut])
def list_projects(db: DbDep, user: CurrentUser) -> list[ProjectOut]:
    rows = db.scalars(
        select(ProjectMembership).where(ProjectMembership.user_id == user.id)
    ).all()
    return [_to_out(m.project, m.role) for m in rows]


@router.post("", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: DbDep, user: CurrentUser) -> Project:
    project = Project(owner_id=user.id, **payload.model_dump())
    project.memberships.append(
        ProjectMembership(user=user, role=MembershipRole.owner)
    )
    # every house starts with a ground floor
    project.floors.append(Floor(name="Ground Floor", level=0))
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectDetailOut)
def get_project(
    project_id: int,
    db: DbDep,
    user: CurrentUser,
    project: Project = Depends(require_project_role(MembershipRole.viewer)),
) -> ProjectDetailOut:
    membership = get_membership(db, project_id, user)
    out = ProjectDetailOut.model_validate(project)
    out.my_role = membership.role if membership else None
    out.memberships = [MembershipOut.model_validate(m) for m in project.memberships]
    return out


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.editor)),
) -> ProjectOut:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return _to_out(project, getattr(project, "_membership").role)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.owner)),
) -> None:
    db.delete(project)
    db.commit()


# ---- membership management (owner only) ----


@router.post("/{project_id}/members", response_model=MembershipOut)
def add_member(
    project_id: int,
    payload: AddMemberRequest,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.owner)),
) -> ProjectMembership:
    target = db.scalar(select(User).where(User.email == payload.email))
    if not target:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "No user with that email (ask them to register)"
        )
    existing = get_membership(db, project_id, target)
    if existing:
        existing.role = payload.role
        db.commit()
        db.refresh(existing)
        return existing
    membership = ProjectMembership(
        project_id=project_id, user_id=target.id, role=payload.role
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return membership


@router.patch("/{project_id}/members/{membership_id}", response_model=MembershipOut)
def update_member(
    project_id: int,
    membership_id: int,
    payload: UpdateMemberRequest,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.owner)),
) -> ProjectMembership:
    membership = db.get(ProjectMembership, membership_id)
    if not membership or membership.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership not found")
    if membership.user_id == project.owner_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot change the owner's role")
    membership.role = payload.role
    db.commit()
    db.refresh(membership)
    return membership


@router.delete(
    "/{project_id}/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_member(
    project_id: int,
    membership_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.owner)),
) -> None:
    membership = db.get(ProjectMembership, membership_id)
    if not membership or membership.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership not found")
    if membership.user_id == project.owner_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot remove the owner")
    db.delete(membership)
    db.commit()
