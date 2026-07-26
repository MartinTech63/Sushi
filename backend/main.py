from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator, Dict, Optional

from fastapi import FastAPI, Header, HTTPException, Request, WebSocket
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .db import (
    cleanup_expired_tables,
    connect_db,
    create_table,
    generate_table_code,
    get_database_path,
    get_table_summary,
    init_db,
    join_table,
    upsert_order,
    utc_now_iso,
)
from .realtime import ConnectionManager
from .schemas import (
    AggregatedItem,
    ClientSummary,
    CreateTableRequest,
    CreateTableResponse,
    JoinTableRequest,
    JoinTableResponse,
    SubmitOrderRequest,
    TableSummaryResponse,
)

logger = logging.getLogger("sushi")

FRONTEND_DIR = Path(__file__).resolve().parents[1]
JS_DIR = FRONTEND_DIR / "js"
ASSETS_DIR = FRONTEND_DIR / "assets"
CSS_DIR = FRONTEND_DIR / "css"
CONTENT_DIR = FRONTEND_DIR / "content"
INDEX_FILE = FRONTEND_DIR / "index.html"

MAX_ITEMS_PER_ORDER = int(os.getenv("MAX_ITEMS_PER_ORDER", "50"))
MAX_ITEMS_JSON_BYTES = int(os.getenv("MAX_ITEMS_JSON_BYTES", "20000"))
MAX_NICKNAME_BYTES = int(os.getenv("MAX_NICKNAME_BYTES", "1024"))
CLEANUP_INTERVAL_SECONDS = int(os.getenv("CLEANUP_INTERVAL_SECONDS", "300"))

TABLE_CODE_RE = re.compile(r"^[A-Z0-9]{4,16}$")

manager = ConnectionManager()


class SlidingWindowRateLimiter:
    """In-memory sliding-window rate limiter (single-instance only)."""

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


def assert_frontend_assets() -> None:
    missing = [
        str(p)
        for p in (INDEX_FILE, JS_DIR, ASSETS_DIR, CSS_DIR, CONTENT_DIR)
        if not p.exists()
    ]
    menu_json = CONTENT_DIR / "menu.json"
    if not menu_json.is_file():
        missing.append(str(menu_json))
    if missing:
        raise RuntimeError(
            "Frontend assets missing (bad Docker image or cwd): " + ", ".join(missing)
        )


async def expired_tables_reaper() -> None:
    while True:
        try:
            async with connect_db() as conn:
                await cleanup_expired_tables(conn)
                await conn.commit()
        except Exception:
            logger.exception("Expired tables cleanup failed")
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    assert_frontend_assets()
    db_path = get_database_path()
    logger.info("Starting Sushi API (db=%s)", db_path)
    await init_db()
    cleanup_task = asyncio.create_task(expired_tables_reaper())
    app.state.cleanup_task = cleanup_task
    try:
        yield
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Manger des Sushis", lifespan=lifespan)


@app.get("/health", include_in_schema=False)
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/ready", include_in_schema=False)
async def ready() -> Dict[str, str]:
    try:
        async with connect_db() as conn:
            await conn.execute("SELECT 1;")
    except Exception as exc:
        raise HTTPException(status_code=503, detail="db_unavailable") from exc
    return {"status": "ready"}


@app.post("/api/tables", response_model=CreateTableResponse)
async def api_create_table(req: CreateTableRequest, request: Request) -> CreateTableResponse:
    ip = get_client_ip(request)
    if not await http_rl.allow(f"http:api_create_table:{ip}", limit=10, window_seconds=60):
        raise HTTPException(status_code=429, detail="rate_limited")

    async with connect_db() as conn:
        requested_code = (req.code or "").strip().upper() if req.code else None
        if requested_code:
            if not TABLE_CODE_RE.match(requested_code):
                raise HTTPException(status_code=400, detail="invalid_table_code")
            # Allow immediate reuse of an expired code.
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

    client_token = secrets.token_urlsafe(32)
    table_code = validate_table_code_or_400(req.code)

    async with connect_db() as conn:
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

    filtered_items: list[dict[str, Any]] = []
    for it in req.items:
        name = (it.name or "").strip()
        qty = int(it.quantity)
        if not name or qty <= 0:
            continue
        filtered_items.append({"name": name, "quantity": qty})

    if not filtered_items:
        raise HTTPException(status_code=400, detail="empty_order")

    items_json_preview = json.dumps(filtered_items, ensure_ascii=False, separators=(",", ":"))
    if len(items_json_preview.encode("utf-8")) > MAX_ITEMS_JSON_BYTES:
        raise HTTPException(status_code=413, detail="items_payload_too_large")

    async with connect_db() as conn:
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
    """
    Live table summary channel.
    Rate-limit is intentionally generous: phones sleep/wake and tabs switch often.
    """
    ip = get_client_ip_ws(websocket)
    ws_connect_limit = int(os.getenv("WS_CONNECT_LIMIT", "60"))
    ws_connect_window = int(os.getenv("WS_CONNECT_WINDOW_SECONDS", "60"))

    try:
        table_code = validate_table_code_or_400(table_code)
    except HTTPException:
        # Reject handshake cleanly (avoid close-before-accept quirks).
        await websocket.close(code=4400)
        return

    if not await ws_rl.allow(
        f"ws:connect:{ip}",
        limit=ws_connect_limit,
        window_seconds=ws_connect_window,
    ):
        # Accept then close so the browser gets a normal WS close, not a refused handshake.
        await websocket.accept()
        try:
            await websocket.send_json({"type": "error", "detail": "rate_limited"})
        except Exception:
            pass
        await websocket.close(code=1013)
        return

    await manager.connect(table_code, websocket)
    try:
        async with connect_db() as conn:
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

        msg_times: deque[float] = deque()
        # Heartbeat client ~1/25s ; leave headroom for flaky networks.
        ws_max_messages_per_min = int(os.getenv("WS_MAX_MESSAGES_PER_MIN", "120"))
        ws_window_seconds = 60

        while True:
            await websocket.receive_text()
            now = time.monotonic()
            while msg_times and (now - msg_times[0]) > ws_window_seconds:
                msg_times.popleft()
            if len(msg_times) >= ws_max_messages_per_min:
                await websocket.close(code=1013)
                return
            msg_times.append(now)
    except Exception:
        pass
    finally:
        manager.disconnect(table_code, websocket)


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(INDEX_FILE)


# Mounted after API routes so /api and /ws are never shadowed.
app.mount("/js", StaticFiles(directory=str(JS_DIR), html=False), name="js")
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR), html=False), name="assets")
app.mount("/css", StaticFiles(directory=str(CSS_DIR), html=False), name="css")
app.mount("/content", StaticFiles(directory=str(CONTENT_DIR), html=False), name="content")
