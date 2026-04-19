from typing import Any, Dict, Union
from uuid import UUID

from motor.core import AgnosticDatabase

from app.crud.base import CRUDBase
from app.models.member import Member
from app.schemas.member import MemberCreate, MemberUpdate
class CRUDMember(CRUDBase[Member, MemberCreate, MemberUpdate]):
    async def get_by_name(
        self, 
        db: AgnosticDatabase, 
        *, 
        first_name: str, 
        last_name: str
    ) -> Member | None:
        return await self.engine.find_one(
            Member, 
            (Member.first_name == first_name) & (Member.last_name == last_name)
        )

    async def create(
        self, 
        db: AgnosticDatabase, 
        *, 
        obj_in: MemberCreate
    ) -> Member:
        member_data = obj_in.model_dump()
        return await self.engine.save(Member(**member_data))

    async def update(
        self, 
        db: AgnosticDatabase, 
        *, 
        db_obj: Member, 
        obj_in: Union[MemberUpdate, Dict[str, Any]]
    ) -> Member:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        return await super().update(db, db_obj=db_obj, obj_in=update_data)

    async def get_by_id(
        self, 
        db: AgnosticDatabase, 
        *, 
        id: UUID
    ) -> Member | None:
        return await self.engine.find_one(Member, Member.id == id)

    async def remove(
        self,
        db: AgnosticDatabase,
        *,
        id: UUID
    ) -> Member:
        if (obj := await self.get_by_id(db, id=id)):
            await self.engine.delete(obj)
            return obj

    async def get_multi(self, db: AgnosticDatabase, skip: int = 0, limit: int = 100):
        return await self.engine.find(Member, skip=skip, limit=limit)


member = CRUDMember(Member)
