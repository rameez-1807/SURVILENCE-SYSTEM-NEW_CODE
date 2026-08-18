import asyncio
import collections
import json
import logging
import time
import uuid
from typing import Dict, List, Any, Optional

from fastapi import WebSocket
from app.models.user import User

logger = logging.getLogger(__name__)

class ConnectionData:
    def __init__(self, ws: WebSocket, user: User, tenant_id: uuid.UUID):
        self.ws = ws
        self.user = user
        self.tenant_id = tenant_id
        self.site_id: Optional[uuid.UUID] = None
        self.camera_id: Optional[uuid.UUID] = None


import threading

class WebSocketManager:
    _instance = None
    _singleton_lock = threading.Lock()

    def __new__(cls):
        with cls._singleton_lock:
            if cls._instance is None:
                cls._instance = super(WebSocketManager, cls).__new__(cls)
                cls._instance._init_state()
        return cls._instance

    def _init_state(self):
        # tenant_id -> list of ConnectionData
        self.active_connections: Dict[uuid.UUID, List[ConnectionData]] = collections.defaultdict(list)
        # Sequence counter
        self._sequence = 0
        # tenant_id -> list of historical messages (ring buffer)
        self._message_buffer: Dict[uuid.UUID, collections.deque] = collections.defaultdict(
            lambda: collections.deque(maxlen=100)
        )
        self._connections_lock = None

    @property
    def lock(self):
        if self._connections_lock is None:
            self._connections_lock = asyncio.Lock()
        return self._connections_lock

    async def connect(self, ws: WebSocket, user: User, tenant_id: uuid.UUID) -> ConnectionData:
        await ws.accept()
        conn = ConnectionData(ws, user, tenant_id)
        async with self.lock:
            self.active_connections[tenant_id].append(conn)
        logger.info(f"WebSocket connected: user={user.id}, tenant={tenant_id}")
        return conn

    async def disconnect(self, conn: ConnectionData):
        async with self.lock:
            if conn.tenant_id in self.active_connections:
                if conn in self.active_connections[conn.tenant_id]:
                    self.active_connections[conn.tenant_id].remove(conn)
                if not self.active_connections[conn.tenant_id]:
                    del self.active_connections[conn.tenant_id]
        logger.info(f"WebSocket disconnected: user={conn.user.id}, tenant={conn.tenant_id}")

    async def _send_json(self, ws: WebSocket, data: dict) -> bool:
        """Helper to send JSON and handle disconnections silently."""
        try:
            await ws.send_json(data)
            return True
        except Exception as e:
            logger.debug(f"Failed to send to websocket: {e}")
            return False

    def _get_next_sequence(self) -> int:
        self._sequence += 1
        return self._sequence

    async def handle_client_message(self, conn: ConnectionData, data: dict):
        """Handle incoming messages like ping, subscribe, and last_seen_sequence."""
        msg_type = data.get("type")
        
        if msg_type == "ping":
            await self._send_json(conn.ws, {"type": "pong", "timestamp": time.time()})
            
        elif msg_type == "subscribe":
            # Update filters
            site_id_str = data.get("site_id")
            camera_id_str = data.get("camera_id")
            
            if site_id_str:
                conn.site_id = uuid.UUID(site_id_str)
            if camera_id_str:
                conn.camera_id = uuid.UUID(camera_id_str)
                
            logger.debug(f"Updated subscription for user={conn.user.id}: site={conn.site_id}, camera={conn.camera_id}")
            await self._send_json(conn.ws, {"type": "subscribed", "status": "success"})
            
            # Replay buffer if requested
            last_seen = data.get("last_seen_sequence")
            if last_seen is not None and isinstance(last_seen, int):
                await self._replay_buffer(conn, last_seen)

    async def _replay_buffer(self, conn: ConnectionData, last_seen: int):
        """Replay messages from the ring buffer that the client missed."""
        async with self.lock:
            buffer = list(self._message_buffer[conn.tenant_id])
            
        # Filter for messages strictly after the last_seen_sequence
        missed = [msg for msg in buffer if msg.get("seq", 0) > last_seen]
        
        # Apply connection filters (site/camera)
        for msg in missed:
            if self._should_send(conn, msg):
                await self._send_json(conn.ws, msg)
                
        if missed:
            logger.info(f"Replayed {len(missed)} messages for user={conn.user.id}")

    def _should_send(self, conn: ConnectionData, message: dict) -> bool:
        """Check if a message should be sent to a connection based on its subscriptions."""
        data = message.get("data", {})
        
        if conn.camera_id:
            # Must match camera
            msg_camera = data.get("camera_id")
            if msg_camera and str(conn.camera_id) != str(msg_camera):
                return False
                
        if conn.site_id:
            # Must match site
            msg_site = data.get("site_id")
            if msg_site and str(conn.site_id) != str(msg_site):
                return False
                
        return True

    async def broadcast(self, tenant_id: uuid.UUID, message_type: str, data: dict):
        """Broadacast a message to all matching connections in a tenant, appending it to the replay buffer."""
        async with self.lock:
            seq = self._get_next_sequence()
            message = {
                "type": message_type,
                "seq": seq,
                "timestamp": time.time(),
                "data": data
            }
            
            # Add to ring buffer
            self._message_buffer[tenant_id].append(message)
            
            connections = list(self.active_connections.get(tenant_id, []))

        # Send to all matching
        for conn in connections:
            if self._should_send(conn, message):
                await self._send_json(conn.ws, message)

    async def broadcast_event(self, tenant_id: uuid.UUID, event_data: dict, action: str = "event.created"):
        """Utility wrapper for broadcasting events."""
        await self.broadcast(tenant_id, action, event_data)

    async def broadcast_health(self, tenant_id: uuid.UUID, camera_id: uuid.UUID, health_data: dict):
        """Utility wrapper for broadcasting camera health."""
        # Inject camera_id for filtering
        health_data["camera_id"] = str(camera_id)
        await self.broadcast(tenant_id, "camera.health", health_data)

# Global singleton
ws_manager = WebSocketManager()
