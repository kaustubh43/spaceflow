from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbDep, require_project_role
from app.models import Comment, Floor, MembershipRole, Project
from app.schemas.misc import CommentCreate, CommentOut, CommentUpdate

router = APIRouter(
    prefix="/projects/{project_id}/floors/{floor_id}/comments", tags=["comments"]
)


def _check_floor(db: DbDep, project_id: int, floor_id: int) -> Floor:
    floor = db.get(Floor, floor_id)
    if not floor or floor.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Floor not found")
    return floor


@router.get("", response_model=list[CommentOut])
def list_comments(
    project_id: int,
    floor_id: int,
    db: DbDep,
    project: Project = Depends(require_project_role(MembershipRole.viewer)),
) -> list[Comment]:
    _check_floor(db, project_id, floor_id)
    return db.scalars(select(Comment).where(Comment.floor_id == floor_id)).all()


@router.post("", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(
    project_id: int,
    floor_id: int,
    payload: CommentCreate,
    db: DbDep,
    user: CurrentUser,
    project: Project = Depends(require_project_role(MembershipRole.viewer)),
) -> Comment:
    _check_floor(db, project_id, floor_id)
    comment = Comment(floor_id=floor_id, author_id=user.id, **payload.model_dump())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.patch("/{comment_id}", response_model=CommentOut)
def update_comment(
    project_id: int,
    floor_id: int,
    comment_id: int,
    payload: CommentUpdate,
    db: DbDep,
    user: CurrentUser,
    project: Project = Depends(require_project_role(MembershipRole.viewer)),
) -> Comment:
    comment = db.get(Comment, comment_id)
    if not comment or comment.floor_id != floor_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    role = project._membership.role  # type: ignore[attr-defined]
    is_privileged = role in (MembershipRole.editor, MembershipRole.owner)
    # author can edit body; resolving is open to author or editors
    if comment.author_id != user.id and not is_privileged:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot edit this comment")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(comment, field, value)
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    project_id: int,
    floor_id: int,
    comment_id: int,
    db: DbDep,
    user: CurrentUser,
    project: Project = Depends(require_project_role(MembershipRole.viewer)),
) -> None:
    comment = db.get(Comment, comment_id)
    if not comment or comment.floor_id != floor_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    role = project._membership.role  # type: ignore[attr-defined]
    is_privileged = role in (MembershipRole.editor, MembershipRole.owner)
    if comment.author_id != user.id and not is_privileged:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot delete this comment")
    db.delete(comment)
    db.commit()
