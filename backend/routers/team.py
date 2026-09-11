from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime
import secrets

from core.database import get_db
from core.security import get_password_hash
from models.user import User
from models.organization import Organization
from routers.deps import get_current_user
from services.email_service import send_email, render_team_invite_email

router = APIRouter()

class TeamMemberInvite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    role: Literal["admin", "analyst", "member"] = "member"

class TeamMemberUpdateRole(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["admin", "analyst", "member"]

class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    role: str
    created_at: datetime
    is_current_user: bool = False

class InviteSuccessResponse(BaseModel):
    member: TeamMemberResponse
    temporary_password: Optional[str] = None
    message: str

@router.get("/members", response_model=List[TeamMemberResponse])
async def list_team_members(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists all users belonging to the authenticated user's organization.
    """
    result = await db.execute(
        select(User)
        .where(User.org_id == current_user.org_id)
        .order_by(User.id.asc())
    )
    users = result.scalars().all()

    members = []
    for u in users:
        resp = TeamMemberResponse.model_validate(u)
        resp.is_current_user = (u.id == current_user.id)
        members.append(resp)
    return members

@router.post("/members", response_model=InviteSuccessResponse)
async def invite_team_member(
    invite_in: TeamMemberInvite,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Invites and provisions a new coworker to the organization.
    Restricted to organization administrators.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization administrators can invite new team members."
        )

    clean_email = invite_in.email.lower().strip()

    # Check if user already exists
    existing = await db.execute(select(User).where(User.email == clean_email))
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{clean_email}' already exists in BreachGuard."
        )

    # Generate temporary password for immediate access
    temp_password = f"BG-{secrets.token_urlsafe(9)}"

    new_user = User(
        email=clean_email,
        hashed_password=get_password_hash(temp_password),
        org_id=current_user.org_id,
        role=invite_in.role
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Fetch organization details for invitation email
    org_res = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_res.scalars().first()
    org_name = org.name if org else "Security Team"

    # Dispatch invite email
    try:
        html_body = render_team_invite_email(
            inviter_email=current_user.email,
            org_name=org_name,
            role=invite_in.role,
            temp_password=temp_password
        )
        await send_email(
            to_email=clean_email,
            subject=f"You've been invited to join {org_name} on BreachGuard",
            html_body=html_body,
            text_body=f"You've been invited to join {org_name} on BreachGuard. Temporary password: {temp_password}"
        )
    except Exception as e:
        import logging
        logging.getLogger("breachguard.team").warning(f"Invite email could not be dispatched: {e}")

    resp_member = TeamMemberResponse.model_validate(new_user)
    resp_member.is_current_user = False

    return InviteSuccessResponse(
        member=resp_member,
        temporary_password=temp_password,
        message=f"Team member '{clean_email}' has been successfully invited."
    )

@router.patch("/members/{user_id}/role", response_model=TeamMemberResponse)
async def update_member_role(
    user_id: int,
    role_in: TeamMemberUpdateRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates the role of a team member within the organization.
    Restricted to organization administrators.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization administrators can modify member roles."
        )

    res = await db.execute(select(User).where(User.id == user_id, User.org_id == current_user.org_id))
    target_user = res.scalars().first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Team member not found.")

    # Guard: prevent removing the last admin
    if target_user.id == current_user.id and role_in.role != "admin":
        admin_count_res = await db.execute(
            select(func.count(User.id)).where(User.org_id == current_user.org_id, User.role == "admin")
        )
        if (admin_count_res.scalar() or 0) <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot demote the only remaining administrator in the organization."
            )

    target_user.role = role_in.role
    await db.commit()
    await db.refresh(target_user)

    resp = TeamMemberResponse.model_validate(target_user)
    resp.is_current_user = (target_user.id == current_user.id)
    return resp

@router.delete("/members/{user_id}")
async def remove_team_member(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Removes a member's access from the organization.
    Restricted to organization administrators.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization administrators can remove team members."
        )

    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot remove yourself from the organization. Contact another administrator."
        )

    res = await db.execute(select(User).where(User.id == user_id, User.org_id == current_user.org_id))
    target_user = res.scalars().first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Team member not found.")

    await db.delete(target_user)
    await db.commit()

    return {"status": "success", "message": f"User '{target_user.email}' removed from organization."}
