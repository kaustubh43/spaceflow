from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import (
    MembershipRole,
    Project,
    ProjectMembership,
    User,
    UserRole,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login-form", auto_error=True)

DbDep = Annotated[Session, Depends(get_db)]

# membership role ranking for permission checks
ROLE_RANK = {
    MembershipRole.viewer: 0,
    MembershipRole.contributor: 1,
    MembershipRole.editor: 2,
    MembershipRole.owner: 3,
}


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: DbDep) -> User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise cred_exc
    user_id = payload.get("sub")
    if user_id is None:
        raise cred_exc
    user = db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise cred_exc
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_membership(db: Session, project_id: int, user: User) -> ProjectMembership | None:
    return db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == user.id,
        )
    )


def require_project_role(min_role: MembershipRole):
    """Dependency factory: ensure current user has at least `min_role` on the project."""

    def _dep(project_id: int, db: DbDep, user: CurrentUser) -> Project:
        project = db.get(Project, project_id)
        if project is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
        membership = get_membership(db, project_id, user)
        if membership is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this project")
        if ROLE_RANK[membership.role] < ROLE_RANK[min_role]:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Insufficient permissions for this action"
            )
        # stash for handlers that want it
        project._membership = membership  # type: ignore[attr-defined]
        return project

    return _dep
