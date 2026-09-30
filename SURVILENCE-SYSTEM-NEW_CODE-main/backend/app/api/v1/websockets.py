import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.websockets.manager import ws_manager
from app.models.membership import Role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["WebSockets"])


@router.websocket("")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
    tenant_id: Optional[uuid.UUID] = Query(None, description="Target Tenant ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket endpoint for real-time alerts and health monitoring.
    Requires authentication via token query parameter.
    """
    # 1. Authenticate the token
    try:
        user = await get_current_user(session=db, token=token)
    except Exception as e:
        logger.warning(f"WebSocket auth failed: {e}")
        await websocket.close(code=1008, reason="Unauthorized")
        return

    # 2. Authorize Tenant Scope
    authorized_tenant_id = None
    
    # Platform admins can access any tenant requested
    is_platform_admin = any(m.role == Role.PLATFORM_ADMIN for m in user.memberships)
    
    if is_platform_admin and tenant_id:
        authorized_tenant_id = tenant_id
    elif tenant_id:
        # Check if user belongs to the requested tenant
        has_access = any(m.tenant_id == tenant_id for m in user.memberships)
        if has_access:
            authorized_tenant_id = tenant_id
    else:
        # If no tenant requested, check if they belong to exactly one tenant (fallback convenience)
        tenant_memberships = [m for m in user.memberships if m.tenant_id is not None]
        if len(tenant_memberships) == 1:
            authorized_tenant_id = tenant_memberships[0].tenant_id

    if not authorized_tenant_id:
        logger.warning(f"WebSocket auth failed: No valid tenant context for user {user.id}")
        await websocket.close(code=1003, reason="Tenant context required or unauthorized")
        return

    # 3. Connect to Manager
    conn = await ws_manager.connect(websocket, user, authorized_tenant_id)

    # 4. Listen Loop
    try:
        while True:
            data = await websocket.receive_json()
            await ws_manager.handle_client_message(conn, data)
            
    except WebSocketDisconnect:
        await ws_manager.disconnect(conn)
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        await ws_manager.disconnect(conn)
        await websocket.close(code=1011, reason="Internal error")
