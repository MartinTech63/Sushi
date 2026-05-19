from __future__ import annotations

import asyncio
import json
import os
import re
import secrets
import sqlite3
from pathlib import Path
import time
from collections import defaultdict, deque
from typing import Any, Dict, List, Optional

import aiosqlite
from fastapi import FastAPI, Header, HTTPException, Request, WebSocket
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .db import (
    DEFAULT_DATABASE_URL,
    create_table,
    generate_table_code,
    get_database_url,
    get_table_summary,
    init_db,
    join_table,
    cleanup_expired_tables,
    upsert_order,
    utc_now_iso,
)
from .realtime import ConnectionManager
from .schemas import (
    ClientSummary,
    AggregatedItem,
    CreateTableResponse,
    CreateTableRequest,
    JoinTableRequest,
    JoinTableResponse,
    OrderItem,
    SubmitOrderRequest,
    TableSummaryResponse,
)


app = FastAPI()
manager = ConnectionManager()

FRONTEND_DIR = Path(__file__).resolve().parents[1]  # /app when containerized

INDEX_FILE = FRONTEND_DIR / "index.html"
STYLES_CSS = FRONTEND_DIR / "styles.css"
STYLES_HALLOWEEN_CSS = FRONTEND_DIR / "styles-halloween.css"
STYLES_PETALS_CSS = FRONTEND_DIR / "styles-petals.css"
SCRIPTS_DIR = FRONTEND_DIR / "SCRIPTS"
SOURCES_DIR = FRONTEND_DIR / "SOURCES"

# ---- Basic anti-abuse constraints ----
MAX_ITEMS_PER_ORDER = int(os.getenv("MAX_ITEMS_PER_ORDER", "50"))
MAX_ITEMS_JSON_BYTES = int(os.getenv("MAX_ITEMS_JSON_BYTES", "20000"))
MAX_NICKNAME_BYTES = int(os.getenv("MAX_NICKNAME_BYTES", "1024"))

TABLE_CODE_RE = re.compile(r"^[A-Z0-9]{4,16}$")


class SlidingWindowRateLimiter:
    """
    Simple in-memory sliding-window rate limiter per key.
    Not for multi-instance deployments, but good enough for a small project.
    """

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        now = time.monotonic()
        async with self._lock:
            q = self._hits[key]
            while q and (now - q[0]) > window_seconds:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True


http_rl = SlidingWindowRateLimiter()
ws_rl = SlidingWindowRateLimiter()


def get_client_ip(request: Request) -> str:
    # In most setups, `request.client.host` is the best available option.
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def get_client_ip_ws(websocket: WebSocket) -> str:
    if websocket.client and websocket.client.host:
        return websocket.client.host
    return "unknown"


def normalize_table_code(table_code: str) -> str:
    return table_code.strip().upper()


def validate_table_code_or_400(table_code: str) -> str:
    table_code = normalize_table_code(table_code)
    if not TABLE_CODE_RE.match(table_code):
        raise HTTPException(status_code=400, detail="invalid_table_code")
    return table_code


def parse_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    authorization = authorization.strip()
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()
    async def reaper() -> None:
        # Nettoyage périodique (tables expirées <= 3h)
        while True:
            try:
                db_url = get_database_url()
                async with aiosqlite.connect(db_url) as conn:
                    await conn.execute("PRAGMA foreign_keys=ON;")
                    await cleanup_expired_tables(conn)
                    await conn.commit()
            except Exception:
                # Évite que le reaper stoppe si la DB a un souci ponctuel.
                pass
            await asyncio.sleep(300)  # 5 min

    app.state.cleanup_task = asyncio.create_task(reaper())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    task = getattr(app.state, "cleanup_task", None)
    if task:
        task.cancel()


@app.post("/api/tables", response_model=CreateTableResponse)
async def api_create_table(req: CreateTableRequest, request: Request) -> CreateTableResponse:
    ip = get_client_ip(request)
    if not await http_rl.allow(f"http:api_create_table:{ip}", limit=10, window_seconds=60):
        raise HTTPException(status_code=429, detail="rate_limited")

    db_url = get_database_url()
    async with aiosqlite.connect(db_url) as conn:
        await conn.execute("PRAGMA foreign_keys=ON;")

        requested_code = (req.code or '').strip().upper() if req.code else None
        if requested_code:
            if not TABLE_CODE_RE.match(requested_code):
                raise HTTPException(status_code=400, detail="invalid_table_code")
            # Pour permettre la réutilisation immédiate d'un code expiré.
            await conn.execute(
                "DELETE FROM tables WHERE code = ? AND expires_at IS NOT NULL AND expires_at <= ?;",
                (requested_code, utc_now_iso()),
            )
            try:
                await create_table(conn, requested_code)
                await conn.commit()
                return CreateTableResponse(code=requested_code)
            except sqlite3.IntegrityError:
                raise HTTPException(status_code=409, detail="code_collision")

        # Code auto-généré (retry car collision possible).
        for _ in range(10):
            code = generate_table_code(6)
            try:
                await create_table(conn, code)
                await conn.commit()
                return CreateTableResponse(code=code)
            except sqlite3.IntegrityError:
                continue

        raise HTTPException(status_code=500, detail="could_not_create_table")


@app.post("/api/tables/join", response_model=JoinTableResponse)
async def api_join_table(req: JoinTableRequest, request: Request) -> JoinTableResponse:
    ip = get_client_ip(request)
    if not await http_rl.allow(f"http:api_join_table:{ip}", limit=20, window_seconds=60):
        raise HTTPException(status_code=429, detail="rate_limited")

    db_url = get_database_url()
    client_token = secrets.token_urlsafe(32)
    table_code = validate_table_code_or_400(req.code)

    async with aiosqlite.connect(db_url) as conn:
        await conn.execute("PRAGMA foreign_keys=ON;")
        try:
            if req.nickname and len(req.nickname.encode("utf-8")) > MAX_NICKNAME_BYTES:
                raise HTTPException(status_code=413, detail="nickname_too_large")

            await join_table(conn, table_code, client_token, req.nickname)
            await conn.commit()
        except LookupError:
            raise HTTPException(status_code=404, detail="table_not_found")
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="token_collision")
        except PermissionError as e:
            # Example: table_full
            raise HTTPException(status_code=403, detail=str(e) or "not_allowed")

    return JoinTableResponse(
        tableCode=table_code, clientToken=client_token, nickname=req.nickname
    )


@app.post("/api/tables/{table_code}/orders")
async def api_submit_order(
    table_code: str,
    req: SubmitOrderRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    request_ip = get_client_ip(request)

    if not await http_rl.allow(f"http:api_submit_order:{request_ip}", limit=30, window_seconds=60):
        raise HTTPException(status_code=429, detail="rate_limited")

    table_code = validate_table_code_or_400(table_code)

    client_token = parse_bearer_token(authorization)
    if not client_token:
        raise HTTPException(status_code=401, detail="missing_or_invalid_token")

    if len(req.items) > MAX_ITEMS_PER_ORDER:
        raise HTTPException(status_code=413, detail="too_many_items")

    # Filter out empty / non-positive quantities early to limit DB growth.
    filtered_items: list[dict[str, Any]] = []
    for it in req.items:
        name = (it.name or "").strip()
        qty = int(it.quantity)
        if not name or qty <= 0:
            continue
        filtered_items.append({"name": name, "quantity": qty})

    if not filtered_items:
        raise HTTPException(status_code=400, detail="empty_order")

    # Approx size guard (cheap) before DB write.
    items_json_preview = json.dumps(filtered_items, ensure_ascii=False, separators=(",", ":"))
    if len(items_json_preview.encode("utf-8")) > MAX_ITEMS_JSON_BYTES:
        raise HTTPException(status_code=413, detail="items_payload_too_large")

    db_url = get_database_url()
    async with aiosqlite.connect(db_url) as conn:
        await conn.execute("PRAGMA foreign_keys=ON;")
        try:
            await upsert_order(conn, table_code, client_token, filtered_items)
            await conn.commit()
        except LookupError:
            raise HTTPException(status_code=404, detail="table_not_found")
        except PermissionError:
            raise HTTPException(status_code=403, detail="client_not_allowed")
        except ValueError as e:
            raise HTTPException(status_code=413, detail=str(e) or "invalid_items")

        summary = await get_table_summary(conn, table_code)

    payload = TableSummaryResponse(
        tableCode=table_code,
        items=[AggregatedItem(**it) for it in summary["items"]],
        clients=[ClientSummary(**c) for c in summary["clients"]],
    ).model_dump()
    await manager.broadcast_table_summary(table_code, payload)
    return {"ok": True}


@app.websocket("/ws/{table_code}")
async def ws_table(table_code: str, websocket: WebSocket) -> None:
    ip = get_client_ip_ws(websocket)
    if not await ws_rl.allow(f"ws:connect:{ip}", limit=10, window_seconds=300):
        await websocket.close(code=4408)
        return

    try:
        table_code = validate_table_code_or_400(table_code)
    except HTTPException:
        await websocket.close(code=4400)
        return

    db_url = get_database_url()
    await manager.connect(table_code, websocket)
    try:
        async with aiosqlite.connect(db_url) as conn:
            await conn.execute("PRAGMA foreign_keys=ON;")
            try:
                summary = await get_table_summary(conn, table_code)
            except LookupError:
                await websocket.send_json({"type": "error", "detail": "table_not_found"})
                await websocket.close(code=4404)
                return

        payload = TableSummaryResponse(
            tableCode=table_code,
            items=[AggregatedItem(**it) for it in summary["items"]],
            clients=[ClientSummary(**c) for c in summary["clients"]],
        )
        await websocket.send_json(payload.model_dump())

        # Avoid WS flooding: the backend expects only light keep-alives.
        msg_times: deque[float] = deque()
        WS_MAX_MESSAGES_PER_MIN = int(os.getenv("WS_MAX_MESSAGES_PER_MIN", "30"))
        WS_WINDOW_SECONDS = 60

        # Keep the socket alive; clients send periodic keep-alives.
        while True:
            await websocket.receive_text()
            now = time.monotonic()
            while msg_times and (now - msg_times[0]) > WS_WINDOW_SECONDS:
                msg_times.popleft()
            if len(msg_times) >= WS_MAX_MESSAGES_PER_MIN:
                await websocket.close(code=4408)
                return
            msg_times.append(now)
    except Exception:
        # WebSocketDisconnect will also be caught here; cleanup below.
        pass
    finally:
        manager.disconnect(table_code, websocket)

#
# Static files: expose only frontend assets, do not serve `backend/`.
#
app.mount("/SCRIPTS", StaticFiles(directory=str(SCRIPTS_DIR), html=False), name="scripts")
app.mount("/SOURCES", StaticFiles(directory=str(SOURCES_DIR), html=False), name="sources")


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(str(INDEX_FILE))


@app.get("/styles.css", include_in_schema=False)
async def styles_css() -> FileResponse:
    return FileResponse(str(STYLES_CSS))


@app.get("/styles-halloween.css", include_in_schema=False)
async def styles_halloween_css() -> FileResponse:
    return FileResponse(str(STYLES_HALLOWEEN_CSS))


@app.get("/styles-petals.css", include_in_schema=False)
async def styles_petals_css() -> FileResponse:
    return FileResponse(str(STYLES_PETALS_CSS))

