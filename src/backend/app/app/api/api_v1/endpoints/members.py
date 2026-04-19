from typing import List
from fastapi import APIRouter, Depends
from motor.core import AgnosticDatabase

from app import crud
from app.api import deps
from app.schemas.member import Member
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[Member])
async def read_members(
    *,
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user: User = Depends(deps.get_carer_or_admin_user),
    skip: int = 0,
    limit: int = 100,
) -> List[Member]:
    """
    Retrieve all residents. Accessible by admin and carer.
    """
    return await crud.member.get_multi(db, skip=skip, limit=limit)