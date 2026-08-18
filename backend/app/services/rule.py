import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rule import Rule
from app.repositories.rule import RuleRepository
from app.repositories.site import SiteRepository
from app.schemas.rule import RuleCreate, RuleUpdate


class RuleService:
    @staticmethod
    async def create_rule(db: AsyncSession, rule_in: RuleCreate) -> Rule:
        # Validate that if site_id is provided, it belongs to the tenant
        if rule_in.site_id:
            site_repo = SiteRepository(db)
            site = await site_repo.get_by_id(rule_in.site_id)
            if not site or site.tenant_id != rule_in.tenant_id:
                raise ValueError("Site does not belong to the given tenant.")
                
        repo = RuleRepository(db)
        return await repo.create(obj_in=rule_in)

    @staticmethod
    async def get_tenant_rules(
        db: AsyncSession, tenant_id: uuid.UUID, site_id: Optional[uuid.UUID] = None, skip: int = 0, limit: int = 100
    ) -> list[Rule]:
        repo = RuleRepository(db)
        return await repo.get_multi_by_tenant(tenant_id=tenant_id, site_id=site_id, skip=skip, limit=limit)

    @staticmethod
    async def update_rule(db: AsyncSession, rule_id: uuid.UUID, rule_in: RuleUpdate) -> Optional[Rule]:
        repo = RuleRepository(db)
        rule = await repo.get_by_id(rule_id)
        if not rule:
            return None
            
        return await repo.update(rule, rule_in)
