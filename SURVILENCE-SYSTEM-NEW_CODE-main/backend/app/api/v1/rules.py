"""
AI Surveillance System - Rules API Router
"""

import uuid
from typing import Annotated, Optional, List

from fastapi import APIRouter, Depends, Header, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, RoleChecker, get_db
from app.models.membership import Role
from app.schemas.rule import RuleCreate, RuleUpdate, RuleResponse
from app.services.rule import RuleService
from app.repositories.rule import RuleRepository

router = APIRouter(prefix="/rules", tags=["Rules"])

# Require at least one of these roles to manage rules
WriteRoles = Depends(RoleChecker([Role.OPERATOR, Role.SUPERVISOR, Role.INSTALLER, Role.OEM_ADMIN]))
ReadRoles = Depends(RoleChecker([Role.OPERATOR, Role.SUPERVISOR, Role.INSTALLER, Role.OEM_ADMIN, Role.PLATFORM_ADMIN]))

TenantHeader = Annotated[uuid.UUID | None, Header(alias="X-Tenant-ID")]

def get_tenant_id_context(current_user: CurrentUser, x_tenant_id: TenantHeader = None) -> uuid.UUID | None:
    for membership in current_user.memberships:
        if membership.role == Role.PLATFORM_ADMIN:
            return None
    return x_tenant_id


@router.post("", response_model=RuleResponse, status_code=status.HTTP_201_CREATED, dependencies=[WriteRoles])
async def create_rule(
    rule_in: RuleCreate,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> RuleResponse:
    """Create a new detection rule."""
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    if user_tenant_id and rule_in.tenant_id != user_tenant_id:
        raise HTTPException(status_code=403, detail="Cannot create rules for other tenants.")
        
    try:
        rule = await RuleService.create_rule(db, rule_in)
        return rule
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[RuleResponse], dependencies=[ReadRoles])
async def list_rules(
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    site_id: Optional[uuid.UUID] = Query(None, description="Filter by site ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> List[RuleResponse]:
    """List rules for the tenant."""
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    if not user_tenant_id:
        raise HTTPException(status_code=400, detail="Tenant context required")
        
    rules = await RuleService.get_tenant_rules(
        db, tenant_id=user_tenant_id, site_id=site_id, skip=skip, limit=limit
    )
    return rules


@router.get("/{rule_id}", response_model=RuleResponse, dependencies=[ReadRoles])
async def get_rule(
    rule_id: uuid.UUID,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> RuleResponse:
    """Get a specific rule by ID."""
    repo = RuleRepository(db)
    rule = await repo.get_by_id(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    if user_tenant_id and rule.tenant_id != user_tenant_id:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    return rule


@router.patch("/{rule_id}", response_model=RuleResponse, dependencies=[WriteRoles])
async def update_rule(
    rule_id: uuid.UUID,
    rule_in: RuleUpdate,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> RuleResponse:
    """Update a rule."""
    repo = RuleRepository(db)
    rule = await repo.get_by_id(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    if user_tenant_id and rule.tenant_id != user_tenant_id:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    updated = await RuleService.update_rule(db, rule_id, rule_in)
    if not updated:
        raise HTTPException(status_code=404, detail="Rule could not be updated")
    return updated


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[WriteRoles])
async def delete_rule(
    rule_id: uuid.UUID,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a rule."""
    repo = RuleRepository(db)
    rule = await repo.get_by_id(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    if user_tenant_id and rule.tenant_id != user_tenant_id:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    await repo.delete(rule_id)
