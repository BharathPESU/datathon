import logging
import os
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.db import catalyst_db as db

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parents[2] / "chat_bot_knowledge_base.sqlite"
KB_TABLE = "chat_bot_knowledge_base"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_local_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_bot_knowledge_base (
                ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
                session_uuid TEXT NOT NULL,
                file_id TEXT NOT NULL,
                file_name TEXT,
                chunk_index INTEGER DEFAULT 0,
                chunk_text TEXT,
                created_at TEXT
            )
            """
        )
        existing = {row["name"] for row in conn.execute("PRAGMA table_info(chat_bot_knowledge_base)")}
        migrations = {
            "file_name": "ALTER TABLE chat_bot_knowledge_base ADD COLUMN file_name TEXT",
            "chunk_index": "ALTER TABLE chat_bot_knowledge_base ADD COLUMN chunk_index INTEGER DEFAULT 0",
            "chunk_text": "ALTER TABLE chat_bot_knowledge_base ADD COLUMN chunk_text TEXT",
            "created_at": "ALTER TABLE chat_bot_knowledge_base ADD COLUMN created_at TEXT",
        }
        for column, ddl in migrations.items():
            if column not in existing:
                conn.execute(ddl)
        conn.commit()


init_local_db()


def chunk_text(text: str, chunk_size: int = 800) -> list[str]:
    cleaned = (text or "").strip()
    if not cleaned:
        return []

    paragraphs = [p.strip() for p in re.split(r"
\s*
", cleaned) if p.strip()]
    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs or [cleaned]:
        if len(paragraph) > chunk_size:
            for i in range(0, len(paragraph), chunk_size):
                part = paragraph[i:i + chunk_size].strip()
                if part:
                    chunks.append(part)
            continue

        if len(current) + len(paragraph) + 2 <= chunk_size:
            current = f"{current}

{paragraph}".strip()
        else:
            if current:
                chunks.append(current)
            current = paragraph

    if current:
        chunks.append(current)
    return chunks


def _normalize_kb_row(row: dict[str, Any]) -> dict[str, Any]:
    file_name = row.get("file_name") or row.get("filename") or row.get("file") or "uploaded_document"
    chunk_text_value = row.get("chunk_text") or row.get("extracted_text") or row.get("text") or ""
    try:
        chunk_index = int(row.get("chunk_index") or 0)
    except (TypeError, ValueError):
        chunk_index = 0

    return {
        "ROWID": row.get("ROWID"),
        "session_uuid": row.get("session_uuid"),
        "file_id": str(row.get("file_id") or file_name),
        "file_name": file_name,
        "filename": file_name,
        "chunk_index": chunk_index,
        "chunk_text": chunk_text_value,
        "extracted_text": chunk_text_value,
        "created_at": row.get("created_at") or row.get("CREATEDTIME"),
    }


def _insert_local_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    inserted: list[dict[str, Any]] = []
    with _connect() as conn:
        for row in rows:
            cursor = conn.execute(
                """
                INSERT INTO chat_bot_knowledge_base
                    (session_uuid, file_id, file_name, chunk_index, chunk_text, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    row["session_uuid"],
                    row["file_id"],
                    row["file_name"],
                    row["chunk_index"],
                    row["chunk_text"],
                    row["created_at"],
                ),
            )
            inserted.append({"ROWID": cursor.lastrowid, **row})
        conn.commit()
    return inserted


def insert_kb_row(session_uuid: str, file_id: str, filename: str, extracted_text: str) -> list[dict[str, Any]]:
    """Split extracted text into session-scoped KB chunks and store them."""
    chunks = chunk_text(extracted_text)
    now = datetime.now(timezone.utc).isoformat()
    rows = [
        {
            "session_uuid": session_uuid,
            "file_id": str(file_id),
            "file_name": filename,
            "chunk_index": idx,
            "chunk_text": chunk,
            "created_at": now,
        }
        for idx, chunk in enumerate(chunks)
    ]

    if not rows:
        return []

    try:
        if db.get_db_app():
            inserted = db.insert_rows(KB_TABLE, rows)
            logger.info("Inserted %s KB chunk(s) into live Catalyst Data Store", len(inserted))
            return [_normalize_kb_row(r) for r in inserted]
    except Exception as exc:
        logger.warning("Live KB insert failed; using local SQLite fallback: %s", exc)

    return [_normalize_kb_row(r) for r in _insert_local_rows(rows)]


def get_kb_rows_by_session(session_uuid: str, limit: int = 500) -> list[dict[str, Any]]:
    live_rows: list[dict[str, Any]] = []
    try:
        if db.get_db_app():
            live_rows = db.query_rows(
                KB_TABLE,
                {"session_uuid": session_uuid},
                order_by="chunk_index asc",
                limit=limit,
            )
    except Exception as exc:
        logger.warning("Live KB query failed; using local SQLite fallback: %s", exc)

    if live_rows:
        return sorted((_normalize_kb_row(r) for r in live_rows), key=lambda r: (r["file_name"], r["chunk_index"]))

    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT ROWID, session_uuid, file_id, file_name, chunk_index, chunk_text, created_at
            FROM chat_bot_knowledge_base
            WHERE session_uuid = ?
            ORDER BY file_name ASC, chunk_index ASC
            LIMIT ?
            """,
            (session_uuid, limit),
        ).fetchall()
    return [_normalize_kb_row(dict(row)) for row in rows]


def _words(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", (text or "").lower()))


def top_matching_chunks(session_uuid: str, question: str, top_k: int = 5) -> list[dict[str, Any]]:
    rows = get_kb_rows_by_session(session_uuid)
    q_words = _words(question)
    if not rows or not q_words:
        return []

    scored: list[tuple[int, dict[str, Any]]] = []
    for row in rows:
        chunk_words = _words(row.get("chunk_text", ""))
        overlap = len(q_words & chunk_words)
        if overlap > 0:
            scored.append((overlap, row))

    scored.sort(key=lambda item: (item[0], -item[1].get("chunk_index", 0)), reverse=True)
    return [row for _, row in scored[:top_k]]


def list_kb_documents_by_session(session_uuid: str) -> list[dict[str, Any]]:
    docs: dict[str, dict[str, Any]] = {}
    for row in get_kb_rows_by_session(session_uuid):
        key = row["file_id"]
        entry = docs.setdefault(
            key,
            {
                "file_id": key,
                "filename": row["file_name"],
                "file_name": row["file_name"],
                "session_uuid": session_uuid,
                "chunk_count": 0,
                "size_bytes": 0,
                "created_at": row.get("created_at"),
            },
        )
        entry["chunk_count"] += 1
        entry["size_bytes"] += len(row.get("chunk_text") or "")
    return sorted(docs.values(), key=lambda d: d.get("created_at") or "", reverse=True)


def delete_kb_row(session_uuid: str, file_id: str) -> None:
    try:
        if db.get_db_app():
            rows = db.query_rows(KB_TABLE, {"session_uuid": session_uuid, "file_id": file_id}, limit=500)
            for row in rows:
                rowid = row.get("ROWID")
                if rowid is not None:
                    db.delete_row(KB_TABLE, int(rowid))
    except Exception as exc:
        logger.warning("Live KB delete failed: %s", exc)

    with _connect() as conn:
        conn.execute(
            "DELETE FROM chat_bot_knowledge_base WHERE session_uuid = ? AND file_id = ?",
            (session_uuid, str(file_id)),
        )
        conn.commit()
