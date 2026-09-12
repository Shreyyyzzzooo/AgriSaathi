"""SQLite-backed session store using stdlib sqlite3 only (no ORM).

DB file: backend/sessions.db — resolved relative to this file so it is always placed in
the backend/ directory regardless of the working directory uvicorn is launched from.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

# Resolves to <repo_root>/backend/sessions.db
_DB_PATH: Path = Path(__file__).parent.parent / "sessions.db"


def _connect() -> sqlite3.Connection:
    return sqlite3.connect(str(_DB_PATH))


def init_db() -> None:
    """Create the sessions table if it does not already exist."""
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            )
            """
        )
        conn.commit()


def save_session(session_id: str, data: dict) -> None:
    """JSON-serialise *data* and upsert into the sessions table."""
    with _connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO sessions (id, data) VALUES (?, ?)",
            (session_id, json.dumps(data)),
        )
        conn.commit()


def get_session(session_id: str) -> dict | None:
    """Return the session dict for *session_id*, or None if not found."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT data FROM sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
    if row is None:
        return None
    return json.loads(row[0])
