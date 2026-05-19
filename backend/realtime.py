from __future__ import annotations

from collections import defaultdict
from typing import Any, DefaultDict, Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active: DefaultDict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, table_code: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active[table_code].add(websocket)

    def disconnect(self, table_code: str, websocket: WebSocket) -> None:
        conns = self.active.get(table_code)
        if not conns:
            return
        conns.discard(websocket)
        if not conns:
            self.active.pop(table_code, None)

    async def broadcast_table_summary(self, table_code: str, payload: dict[str, Any]) -> None:
        conns = list(self.active.get(table_code, set()))
        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(table_code, ws)

