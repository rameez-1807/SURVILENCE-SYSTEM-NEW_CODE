import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rule import Rule
from app.schemas.rule import RuleCreate, RuleUpdate
from app.services.rule import RuleService
from tests.conftest import TestSessionLocal
from tests.test_events import create_test_tenant, create_test_site

@pytest.fixture
async def rule_hierarchy():
    tenant = await create_test_tenant()
    site = await create_test_site(tenant_id=tenant.id)
    return tenant, site

@pytest.mark.asyncio
async def test_create_rule_success(rule_hierarchy):
    tenant, site = rule_hierarchy
    
    rule_in = RuleCreate(
        tenant_id=tenant.id,
        site_id=site.id,
        name="Front Door Person Detection",
        detection_class="person",
        confidence_threshold=0.6,
        severity="high"
    )
    
    async with TestSessionLocal() as db_session:
        rule = await RuleService.create_rule(db_session, rule_in)
        
        assert rule.id is not None
        assert rule.name == "Front Door Person Detection"
        assert rule.tenant_id == tenant.id
        assert rule.site_id == site.id
        assert rule.enabled is True
        assert rule.version == 1

@pytest.mark.asyncio
async def test_create_rule_global_success(rule_hierarchy):
    tenant, _ = rule_hierarchy
    
    rule_in = RuleCreate(
        tenant_id=tenant.id,
        name="Global Tenant Rule",
        detection_class="vehicle"
    )
    
    async with TestSessionLocal() as db_session:
        rule = await RuleService.create_rule(db_session, rule_in)
        assert rule.site_id is None
        assert rule.tenant_id == tenant.id

@pytest.mark.asyncio
async def test_create_rule_site_mismatch(rule_hierarchy):
    tenant, _ = rule_hierarchy
    other_tenant = await create_test_tenant(name="Other Tenant")
    other_site = await create_test_site(tenant_id=other_tenant.id, name="Other Site")
    
    rule_in = RuleCreate(
        tenant_id=tenant.id,
        site_id=other_site.id, # Site belongs to another tenant!
        name="Invalid Rule",
        detection_class="person"
    )
    
    async with TestSessionLocal() as db_session:
        with pytest.raises(ValueError, match="Site does not belong to the given tenant."):
            await RuleService.create_rule(db_session, rule_in)

@pytest.mark.asyncio
async def test_update_rule_version_bump(rule_hierarchy):
    tenant, site = rule_hierarchy
    
    rule_in = RuleCreate(
        tenant_id=tenant.id,
        site_id=site.id,
        name="Initial Rule",
        detection_class="person"
    )
    
    async with TestSessionLocal() as db_session:
        rule = await RuleService.create_rule(db_session, rule_in)
        assert rule.version == 1
        
        update_in = RuleUpdate(name="Updated Rule", confidence_threshold=0.8)
        updated_rule = await RuleService.update_rule(db_session, rule.id, update_in)
        
        assert updated_rule.name == "Updated Rule"
        assert updated_rule.confidence_threshold == 0.8
        assert updated_rule.version == 2 # Auto bumped
