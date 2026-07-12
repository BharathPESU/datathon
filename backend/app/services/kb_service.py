import sqlite3
import os
import json
import logging
from app.db import catalyst_db as db

logger = logging.getLogger(__name__)

DB_PATH = "/home/bharath/Desktop/projects/datathon/backend/chat_bot_knowledge_base.sqlite"

def init_local_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_bot_knowledge_base (
            ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
            session_uuid TEXT,
            file_id TEXT,
            filename TEXT,
            extracted_text TEXT
        )
    """)
    conn.commit()
    conn.close()

# Initialize on module import
init_local_db()

def insert_kb_row(session_uuid: str, file_id: str, filename: str, extracted_text: str):
    # Try inserting into Live Catalyst Datastore
    try:
        app = db.get_db_app()
        if app:
            row = db.insert_row("chat_bot_knowledge_base", {
                "session_uuid": session_uuid,
                "file_id": file_id,
                "filename": filename,
                "extracted_text": extracted_text
            })
            logger.info("Successfully inserted OCR text into live datastore chat_bot_knowledge_base")
            return row
    except Exception as e:
        logger.warning(f"Failed to write to live chat_bot_knowledge_base datastore: {e}. Using local SQLite fallback.")
    
    # SQLite fallback
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_bot_knowledge_base (session_uuid, file_id, filename, extracted_text) VALUES (?, ?, ?, ?)",
        (session_uuid, file_id, filename, extracted_text)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {
        "ROWID": new_id,
        "session_uuid": session_uuid,
        "file_id": file_id,
        "filename": filename,
        "extracted_text": extracted_text
    }

def get_kb_rows_by_session(session_uuid: str):
    # Try fetching from Live Catalyst Datastore
    try:
        app = db.get_db_app()
        if app:
            rows = db.query_rows("chat_bot_knowledge_base", {"session_uuid": session_uuid})
            if rows:
                return rows
    except Exception as e:
        logger.warning(f"Failed to query live chat_bot_knowledge_base: {e}. Querying local SQLite fallback.")
        
    # SQLite fallback
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT ROWID, session_uuid, file_id, filename, extracted_text FROM chat_bot_knowledge_base WHERE session_uuid = ?", (session_uuid,))
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        result.append({
            "ROWID": r[0],
            "session_uuid": r[1],
            "file_id": r[2],
            "filename": r[3],
            "extracted_text": r[4]
        })
    return result

def delete_kb_row(session_uuid: str, file_id: str):
    # Try deleting from Live Catalyst Datastore
    try:
        app = db.get_db_app()
        if app:
            rows = db.query_rows("chat_bot_knowledge_base", {"session_uuid": session_uuid, "file_id": file_id})
            for r in rows:
                db.delete_row("chat_bot_knowledge_base", r["ROWID"])
    except Exception as e:
        logger.warning(f"Failed to delete from live datastore: {e}")
        
    # SQLite deletion
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_bot_knowledge_base WHERE session_uuid = ? AND file_id = ?", (session_uuid, file_id))
    conn.commit()
    conn.close()
