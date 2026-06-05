from pydantic import BaseModel, EmailStr

from app.models.enums import MembershipRole
from app.schemas.auth import UserOut


class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    address: str | None = None
    client_name: str | None = None
    units: str = "cm"


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    address: str | None = None
    client_name: str | None = None
    units: str | None = None


class MembershipOut(BaseModel):
    id: int
    user: UserOut
    role: MembershipRole

    model_config = {"from_attributes": True}


class ProjectOut(ProjectBase):
    id: int
    owner_id: int
    thumbnail_path: str | None = None
    # the requesting user's role on this project
    my_role: MembershipRole | None = None

    model_config = {"from_attributes": True}


class ProjectDetailOut(ProjectOut):
    memberships: list[MembershipOut] = []


class AddMemberRequest(BaseModel):
    email: EmailStr
    role: MembershipRole = MembershipRole.viewer


class UpdateMemberRequest(BaseModel):
    role: MembershipRole
