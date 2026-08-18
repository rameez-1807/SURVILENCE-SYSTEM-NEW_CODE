import uuid
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rule import Rule
from app.schemas.rule import RuleCreate, RuleUpdate


class RuleRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, rule_id: uuid.UUID) -> Optional[Rule]:
        stmt = select(Rule).where(Rule.id == rule_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_multi_by_tenant(
        self, tenant_id: uuid.UUID, site_id: Optional[uuid.UUID] = None, skip: int = 0, limit: int = 100
    ) -> list[Rule]:
        stmt = select(Rule).where(Rule.tenant_id == tenant_id)
        if site_id:
            stmt = stmt.where(Rule.site_id == site_id)
        stmt = stmt.order_by(Rule.created_at.desc()).offset(skip).limit(limit)
        
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj_in: RuleCreate) -> Rule:
        db_obj = Rule(**obj_in.model_dump())
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def update(self, db_obj: Rule, obj_in: RuleUpdate) -> Rule:
        update_data = obj_in.model_dump(exclude_unset=True)
        if update_data:
            # Auto bump version
            update_data["version"] = db_obj.version + 1
            stmt = (
                update(Rule)
                .where(Rule.id == db_obj.id)
                .values(**update_data)
            )
            await self.db.execute(stmt)
            await self.db.refresh(db_obj)
        return db_obj
