from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from motor.core import AgnosticDatabase

from app import crud
from app.api import deps
from app.schemas.member import Member, MemberCreate, MemberUpdate
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=Member)
async def create_member(
    *,
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),  # Changed this line
    member_in: MemberCreate,
) -> Member:
    """
    Create new member. Only superusers can create members.
    """
    member = await crud.member.get_by_name(
        db, first_name=member_in.first_name, last_name=member_in.last_name
    )
    if member:
        raise HTTPException(
            status_code=400,
            detail="Member with this name already exists.",
        )
    return await crud.member.create(db, obj_in=member_in)

@router.get("/{member_id}", response_model=Member)
async def read_member(
    *,
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),  # Added this line
    member_id: UUID,
) -> Member:
    """
    Get member by ID. Regular users can only access if they're an admin or superuser.
    """
    member = await crud.member.get_by_id(db, id=member_id)
    if not member:
        raise HTTPException(
            status_code=404,
            detail="Member not found",
        )
    if not current_user.is_superuser and not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="You don't have enough privileges",
        )
    return member

@router.put("/{member_id}", response_model=Member)
async def update_member(
    *,
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),  # Changed this line
    member_id: UUID,
    member_in: MemberUpdate,
) -> Member:
    """
    Update a member. Only superusers can update members.
    """
    member = await crud.member.get_by_id(db, id=member_id)
    if not member:
        raise HTTPException(
            status_code=404,
            detail="Member not found",
        )
    return await crud.member.update(db, db_obj=member, obj_in=member_in)

@router.delete("/{member_id}", response_model=Member)
async def delete_member(
    *,
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser),  # Changed this line
    member_id: UUID,
) -> Member:
    """
    Delete a member. Only superusers can delete members.
    """
    member = await crud.member.get_by_id(db, id=member_id)
    if not member:
        raise HTTPException(
            status_code=404,
            detail="Member not found",
        )
    return await crud.member.remove(db, id=member_id)
