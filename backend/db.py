from __future__ import annotations

import json
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import aiosqlite

DEFAULT_DATABASE_URL = "data/sushi.db"
TABLE_TTL_SECONDS = 3 * 60 * 60  # 3h
MAX_CLIENTS_PER_TABLE = int(os.getenv("MAX_CLIENTS_PER_TABLE", "20"))
MAX_ITEMS_PER_ORDER = int(os.getenv("MAX_ITEMS_PER_ORDER", "50"))
MAX_ITEMS_JSON_BYTES = int(os.getenv("MAX_ITEMS_JSON_BYTES", "20000"))


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_plus_seconds_iso(seconds: int) -> str:
    return datetime.fromtimestamp(
        datetime.now(timezone.utc).timestamp() + seconds, tz=timezone.utc
    ).isoformat()


def get_database_url() -> str:
    return os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)


async def init_db() -> None:
    db_path = Path(get_database_url())
    db_path.parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(str(db_path)) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute("PRAGMA foreign_keys=ON;")
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS tables (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                expires_at TEXT
            );
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
                token TEXT NOT NULL UNIQUE,
                nickname TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
                items_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )

        # Migration légère si la colonne expires_at n'existe pas encore.
        cursor = await db.execute("PRAGMA table_info(tables);")
        cols = await cursor.fetchall()
        has_expires_at = any(c[1] == "expires_at" for c in cols) if cols else False

        if not has_expires_at:
            await db.execute("ALTER TABLE tables ADD COLUMN expires_at TEXT;")

        # Met à jour les expires_at manquants avec created_at + 3h.
        cursor = await db.execute(
            """
            SELECT id, created_at
            FROM tables
            WHERE expires_at IS NULL;
            """
        )
        rows = await cursor.fetchall()
        for (table_id, created_at) in rows:
            try:
                dt = datetime.fromisoformat(str(created_at))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                dt_ts = dt.timestamp()
                expires_at = datetime.fromtimestamp(
                    dt_ts + TABLE_TTL_SECONDS, tz=timezone.utc
                ).isoformat()
            except Exception:
                expires_at = utc_plus_seconds_iso(TABLE_TTL_SECONDS)

            await db.execute(
                "UPDATE tables SET expires_at = ? WHERE id = ?;",
                (expires_at, table_id),
            )

        await db.commit()


async def cleanup_expired_tables(conn: aiosqlite.Connection) -> None:
    now = utc_now_iso()
    await conn.execute("DELETE FROM tables WHERE expires_at IS NOT NULL AND expires_at <= ?;", (now,))


def generate_table_code(length: int = 6) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def create_table(conn: aiosqlite.Connection, code: str) -> None:
    await conn.execute(
        """
        INSERT INTO tables(code, created_at, expires_at)
        VALUES (?, ?, ?);
        """,
        (code, utc_now_iso(), utc_plus_seconds_iso(TABLE_TTL_SECONDS)),
    )


async def resolve_table_id(conn: aiosqlite.Connection, code: str) -> Optional[int]:
    now = utc_now_iso()
    cursor = await conn.execute(
        "SELECT id FROM tables WHERE code = ? AND expires_at IS NOT NULL AND expires_at > ?;",
        (code, now),
    )
    row = await cursor.fetchone()
    if not row:
        return None
    return int(row[0])


async def join_table(
    conn: aiosqlite.Connection,
    table_code: str,
    client_token: str,
    nickname: str,
) -> None:
    table_id = await resolve_table_id(conn, table_code)
    if table_id is None:
        raise LookupError("table_not_found")

    # Hard limit per table to reduce DB growth / abuse.
    cursor = await conn.execute(
        "SELECT COUNT(*) FROM clients WHERE table_id = ?;",
        (table_id,),
    )
    row = await cursor.fetchone()
    if row and int(row[0]) >= MAX_CLIENTS_PER_TABLE:
        raise PermissionError("table_full")

    await conn.execute(
        """
        INSERT INTO clients(table_id, token, nickname, created_at)
        VALUES (?, ?, ?, ?);
        """,
        (table_id, client_token, nickname, utc_now_iso()),
    )


async def resolve_client_row(
    conn: aiosqlite.Connection, client_token: str
) -> Optional[Tuple[int, str]]:
    now = utc_now_iso()
    cursor = await conn.execute(
        """
        SELECT c.id as client_id, t.code as table_code
        FROM clients c
        JOIN tables t ON t.id = c.table_id
        WHERE c.token = ?
          AND t.expires_at IS NOT NULL
          AND t.expires_at > ?;
        """,
        (client_token, now),
    )
    row = await cursor.fetchone()
    if not row:
        return None
    return int(row[0]), str(row[1])


async def upsert_order(
    conn: aiosqlite.Connection,
    table_code: str,
    client_token: str,
    items: List[Dict[str, Any]],
) -> None:
    client_row = await resolve_client_row(conn, client_token)
    if client_row is None:
        raise PermissionError("client_not_found")

    if len(items) > MAX_ITEMS_PER_ORDER:
        raise ValueError("order_items_too_many")

    client_id, resolved_table_code = client_row
    if resolved_table_code != table_code:
        raise PermissionError("client_table_mismatch")

    items_json = json.dumps(items, ensure_ascii=False)
    if len(items_json.encode("utf-8")) > MAX_ITEMS_JSON_BYTES:
        raise ValueError("order_payload_too_large")
    await conn.execute(
        """
        INSERT INTO orders(client_id, items_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(client_id) DO UPDATE SET
            items_json = excluded.items_json,
            updated_at = excluded.updated_at;
        """,
        (client_id, items_json, utc_now_iso()),
    )


async def get_table_summary(
    conn: aiosqlite.Connection, table_code: str
) -> Dict[str, Any]:
    table_id = await resolve_table_id(conn, table_code)
    if table_id is None:
        raise LookupError("table_not_found")

    # Load all submitted client orders, keep their nickname and items.
    cursor = await conn.execute(
        """
        SELECT c.nickname, o.items_json
        FROM orders o
        JOIN clients c ON c.id = o.client_id
        WHERE c.table_id = ?;
        """,
        (table_id,),
    )
    rows = await cursor.fetchall()

    aggregated: Dict[str, int] = {}
    clients: List[Dict[str, Any]] = []

    for nickname, items_json in rows:
        try:
            items_list = json.loads(items_json)
        except Exception:
            continue

        if not isinstance(items_list, list):
            continue

        # Per-client aggregation (if duplicates exist in items_json).
        client_aggregated: Dict[str, int] = {}
        for it in items_list:
            if not isinstance(it, dict):
                continue
            name = str(it.get("name", "")).strip()
            qty = int(it.get("quantity", 0) or 0)
            if not name or qty <= 0:
                continue
            client_aggregated[name] = client_aggregated.get(name, 0) + qty

        if not client_aggregated:
            continue

        for name, qty in client_aggregated.items():
            aggregated[name] = aggregated.get(name, 0) + qty

        clients.append(
            {
                "nickname": str(nickname),
                "items": [
                    {"name": n, "quantity": q}
                    for n, q in sorted(client_aggregated.items(), key=lambda x: x[0])
                ],
            }
        )

    # Stable ordering for UI.
    items_sorted = [
        {"name": name, "quantity": qty}
        for name, qty in sorted(aggregated.items(), key=lambda x: x[0])
    ]

    return {"items": items_sorted, "clients": clients}

