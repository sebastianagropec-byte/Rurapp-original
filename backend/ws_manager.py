"""WebSocket connection manager for real-time chat."""
from typing import Dict, Set
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # user_id -> set of websockets
        self.active: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(user_id, set()).add(ws)
        logger.info("WS connected: user=%s total_conns=%d", user_id, len(self.active[user_id]))

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.active:
            self.active[user_id].discard(ws)
            if not self.active[user_id]:
                self.active.pop(user_id, None)

    def is_online(self, user_id: str) -> bool:
        return user_id in self.active and len(self.active[user_id]) > 0

    async def send_to_user(self, user_id: str, payload: dict):
        if user_id not in self.active:
            return False
        dead = []
        for ws in list(self.active[user_id]):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active[user_id].discard(ws)
        return True


manager = ConnectionManager()
