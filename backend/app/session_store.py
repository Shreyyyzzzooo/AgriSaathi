"""SQLite-backed session and user persistence store using stdlib sqlite3 and bcrypt.

DB file: backend/sessions.db — resolved relative to this file so it is always placed in
the backend/ directory regardless of the working directory uvicorn is launched from.
"""

from __future__ import annotations

import datetime
import json
import secrets
import sqlite3
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import bcrypt
    _HAS_BCRYPT = True
except ImportError:
    import hashlib
    _HAS_BCRYPT = False

# Resolves to <repo_root>/backend/sessions.db
_DB_PATH: Path = Path(__file__).parent.parent / "sessions.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_DB_PATH))
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn


def _utc_now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def init_db() -> None:
    """Create all required tables and indexes if they do not already exist."""
    with _connect() as conn:
        # Legacy session table
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            )
            """
        )

        # Users table (case-insensitive username)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id                 TEXT PRIMARY KEY,
                username           TEXT UNIQUE COLLATE NOCASE NOT NULL,
                password_hash      TEXT NOT NULL,
                preferred_language TEXT NOT NULL DEFAULT 'en',
                created_at         TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_users_username ON users (lower(username))"
        )

        # User Auth Sessions / Tokens
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_sessions (
                token      TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id)"
        )

        # Farmer Profiles
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS farmer_profiles (
                id              TEXT PRIMARY KEY,
                user_id         TEXT UNIQUE NOT NULL,
                location        TEXT,
                farm_name       TEXT,
                state           TEXT,
                district        TEXT,
                latitude        REAL,
                longitude       REAL,
                area_acres      REAL,
                soil_type       TEXT,
                current_crop    TEXT,
                sowing_date     TEXT,
                irrigation_type TEXT,
                budget_inr      REAL,
                nitrogen        REAL,
                phosphorus      REAL,
                potassium       REAL,
                ph              REAL,
                organic_matter  REAL,
                profile_data    TEXT,
                updated_at      TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        # Ensure location column exists in farmer_profiles
        try:
            profile_cols = [r["name"] for r in conn.execute("PRAGMA table_info(farmer_profiles)").fetchall()]
            if profile_cols and "location" not in profile_cols:
                conn.execute("ALTER TABLE farmer_profiles ADD COLUMN location TEXT")
                conn.commit()
        except Exception:
            pass

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_farmer_profiles_user ON farmer_profiles (user_id)"
        )

        # Chat Conversations
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_conversations (
                id         TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL,
                title      TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations (user_id)"
        )

        # Chat Messages
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id              TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                sender          TEXT NOT NULL,
                text            TEXT NOT NULL,
                created_at      TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages (conversation_id)"
        )

        conn.commit()


# ── Legacy Session Functions ──────────────────────────────────────────────────

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


# ── Password & User Functions ────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt or pbkdf2_hmac fallback."""
    if _HAS_BCRYPT:
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
    import hashlib
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"pbkdf2${salt}${dk.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its bcrypt or pbkdf2 hash."""
    if not hashed_password:
        return False
    if hashed_password.startswith("pbkdf2$"):
        import hashlib
        parts = hashed_password.split("$")
        if len(parts) != 3:
            return False
        salt = parts[1]
        expected_hex = parts[2]
        dk = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return secrets.compare_digest(dk.hex(), expected_hex)
    if _HAS_BCRYPT:
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        except Exception:
            return False
    return False


def create_user(username: str, password: str, preferred_language: str = "en") -> Dict[str, Any]:
    """Create a new user. Raises ValueError if username already exists."""
    clean_username = username.strip()
    if not clean_username:
        raise ValueError("Username cannot be empty")
    if len(password) < 4:
        raise ValueError("Password must be at least 4 characters long")

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(password)
    created_at = _utc_now()

    try:
        with _connect() as conn:
            conn.execute(
                """
                INSERT INTO users (id, username, password_hash, preferred_language, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, clean_username, pw_hash, preferred_language, created_at),
            )
            conn.commit()
    except sqlite3.IntegrityError:
        raise ValueError("Username already exists")

    return {
        "id": user_id,
        "username": clean_username,
        "preferred_language": preferred_language,
        "created_at": created_at,
    }


def get_user_by_username(username: str) -> Dict[str, Any] | None:
    """Case-insensitive lookup of user by username."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, preferred_language, created_at FROM users WHERE lower(username) = lower(?)",
            (username.strip(),),
        ).fetchone()
    if not row:
        return None
    return dict(row)


def get_user_by_id(user_id: str) -> Dict[str, Any] | None:
    """Lookup user by id."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, username, preferred_language, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    if not row:
        return None
    return dict(row)


def update_user_language(user_id: str, language: str) -> bool:
    """Update preferred language for a user."""
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE users SET preferred_language = ? WHERE id = ?",
            (language, user_id),
        )
        conn.commit()
        return cur.rowcount > 0


# ── Auth Session / Token Functions ───────────────────────────────────────────

def create_user_session(user_id: str) -> str:
    """Create a persistent session token for an authenticated user."""
    token = secrets.token_urlsafe(32)
    created_at = _utc_now()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO user_sessions (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, user_id, created_at),
        )
        conn.commit()
    return token


def get_user_by_token(token: str) -> Dict[str, Any] | None:
    """Retrieve user object associated with an active session token."""
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.username, u.preferred_language, u.created_at
            FROM users u
            JOIN user_sessions s ON u.id = s.user_id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()
    if not row:
        return None
    return dict(row)


def delete_user_session(token: str) -> None:
    """Invalidate a session token."""
    with _connect() as conn:
        conn.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
        conn.commit()


# ── Farmer Profile Functions ──────────────────────────────────────────────────

def upsert_farmer_profile(user_id: str, profile_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Create or replace a farmer profile for the specified user."""
    now = _utc_now()
    serialized_backup = json.dumps(profile_dict)

    # Extract well-known fields safely
    location = profile_dict.get("location")
    farm_name = profile_dict.get("farm_name") or profile_dict.get("name")
    state = profile_dict.get("state")
    district = profile_dict.get("district")

    if location:
        parts = [p.strip() for p in location.split(",") if p.strip()]
        if len(parts) >= 1:
            district = parts[0]
        if len(parts) >= 2:
            state = parts[1]
    elif district:
        location = f"{district}{', ' + state if state else ''}"

    profile_dict["location"] = location
    if district:
        profile_dict["district"] = district
    if state:
        profile_dict["state"] = state
    serialized_backup = json.dumps(profile_dict)

    latitude = profile_dict.get("latitude")
    longitude = profile_dict.get("longitude")
    
    # Area could be area_acres or plot_size_ha * 2.471
    area_acres = profile_dict.get("area_acres")
    if area_acres is None and "plot_size_ha" in profile_dict:
        try:
            area_acres = float(profile_dict["plot_size_ha"]) * 2.47105
        except (ValueError, TypeError):
            pass

    soil_type = profile_dict.get("soil_type")
    current_crop = profile_dict.get("current_crop") or profile_dict.get("crop")
    sowing_date = profile_dict.get("sowing_date")
    irrigation_type = profile_dict.get("irrigation_type") or profile_dict.get("water_availability")
    budget_inr = profile_dict.get("budget_inr")
    nitrogen = profile_dict.get("nitrogen") or profile_dict.get("n")
    phosphorus = profile_dict.get("phosphorus") or profile_dict.get("p")
    potassium = profile_dict.get("potassium") or profile_dict.get("k")
    ph = profile_dict.get("ph")
    organic_matter = profile_dict.get("organic_matter") or profile_dict.get("om")

    with _connect() as conn:
        existing = conn.execute(
            "SELECT id FROM farmer_profiles WHERE user_id = ?",
            (user_id,),
        ).fetchone()

        if existing:
            profile_id = existing["id"]
            conn.execute(
                """
                UPDATE farmer_profiles SET
                    location = ?, farm_name = ?, state = ?, district = ?, latitude = ?, longitude = ?,
                    area_acres = ?, soil_type = ?, current_crop = ?, sowing_date = ?,
                    irrigation_type = ?, budget_inr = ?, nitrogen = ?, phosphorus = ?,
                    potassium = ?, ph = ?, organic_matter = ?, profile_data = ?, updated_at = ?
                WHERE user_id = ?
                """,
                (
                    location, farm_name, state, district, latitude, longitude,
                    area_acres, soil_type, current_crop, sowing_date,
                    irrigation_type, budget_inr, nitrogen, phosphorus,
                    potassium, ph, organic_matter, serialized_backup, now,
                    user_id,
                ),
            )
        else:
            profile_id = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO farmer_profiles (
                    id, user_id, location, farm_name, state, district, latitude, longitude,
                    area_acres, soil_type, current_crop, sowing_date, irrigation_type,
                    budget_inr, nitrogen, phosphorus, potassium, ph, organic_matter,
                    profile_data, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    profile_id, user_id, location, farm_name, state, district, latitude, longitude,
                    area_acres, soil_type, current_crop, sowing_date, irrigation_type,
                    budget_inr, nitrogen, phosphorus, potassium, ph, organic_matter,
                    serialized_backup, now,
                ),
            )
        conn.commit()

    return get_farmer_profile(user_id)  # type: ignore


def get_farmer_profile(user_id: str) -> Dict[str, Any] | None:
    """Retrieve farmer profile for a user."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM farmer_profiles WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    if not row:
        return None

    res = dict(row)
    if res.get("profile_data"):
        try:
            extra = json.loads(res["profile_data"])
            # Merge extra fields that are not null in extra
            for k, v in extra.items():
                if k not in res or res[k] is None:
                    res[k] = v
        except Exception:
            pass

    if not res.get("location"):
        if res.get("district"):
            res["location"] = f"{res['district']}{', ' + res['state'] if res.get('state') else ''}"
        elif res.get("farm_name"):
            res["location"] = res["farm_name"]

    return res


# ── Chat History & Conversation Functions ─────────────────────────────────────

def create_conversation(user_id: str, title: str = "New Conversation") -> Dict[str, Any]:
    """Create a new chat conversation for a user."""
    conv_id = str(uuid.uuid4())
    now = _utc_now()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO chat_conversations (id, user_id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (conv_id, user_id, title, now, now),
        )
        conn.commit()

    return {
        "id": conv_id,
        "user_id": user_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
        "message_count": 0,
    }


def get_user_conversations(user_id: str) -> List[Dict[str, Any]]:
    """List all conversations for a user, sorted newest first."""
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT c.id, c.user_id, c.title, c.created_at, c.updated_at, COUNT(m.id) as message_count
            FROM chat_conversations c
            LEFT JOIN chat_messages m ON c.id = m.conversation_id
            WHERE c.user_id = ?
            GROUP BY c.id
            ORDER BY c.updated_at DESC
            """,
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_conversation(user_id: str, conversation_id: str) -> Dict[str, Any] | None:
    """Retrieve a single conversation ensuring user ownership."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, user_id, title, created_at, updated_at FROM chat_conversations WHERE id = ? AND user_id = ?",
            (conversation_id, user_id),
        ).fetchone()
    if not row:
        return None
    return dict(row)


def add_chat_message(conversation_id: str, sender: str, text: str) -> Dict[str, Any]:
    """Add a message to a conversation and update its updated_at timestamp."""
    msg_id = str(uuid.uuid4())
    now = _utc_now()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO chat_messages (id, conversation_id, sender, text, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (msg_id, conversation_id, sender, text, now),
        )
        conn.execute(
            "UPDATE chat_conversations SET updated_at = ? WHERE id = ?",
            (now, conversation_id),
        )
        conn.commit()

    return {
        "id": msg_id,
        "conversation_id": conversation_id,
        "sender": sender,
        "text": text,
        "created_at": now,
    }


def update_conversation_title(conversation_id: str, title: str) -> None:
    """Update title of a conversation."""
    now = _utc_now()
    with _connect() as conn:
        conn.execute(
            "UPDATE chat_conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title, now, conversation_id),
        )
        conn.commit()


def get_conversation_messages(conversation_id: str) -> List[Dict[str, Any]]:
    """Get all messages for a conversation ordered chronologically."""
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, conversation_id, sender, text, created_at
            FROM chat_messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            """,
            (conversation_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_conversation(user_id: str, conversation_id: str) -> bool:
    """Delete a conversation if owned by user. Messages cascade-delete."""
    with _connect() as conn:
        cur = conn.execute(
            "DELETE FROM chat_conversations WHERE id = ? AND user_id = ?",
            (conversation_id, user_id),
        )
        conn.commit()
        return cur.rowcount > 0
