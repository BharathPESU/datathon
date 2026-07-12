from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File
from datetime import datetime, timezone
import uuid
from app.models.chat import ChatSessionCreate, ChatSessionOut, ChatMessageIn, ChatMessageOut
from app.services.quickml_service import QuickMLService
from app.services.filestore_service import FilestoreService
from app.core.security import get_current_user
from app.core.permissions import can_access
from app.db import catalyst_db as db
import json

router = APIRouter()


@router.post("/session", response_model=ChatSessionOut)
async def create_chat_session(
    req: ChatSessionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new chat session."""
    if not can_access(current_user["role"], "chat:use"):
        raise HTTPException(status_code=403, detail="Permission denied")

    session_id = str(uuid.uuid4())
    session_row = db.insert_row("ChatSession", {
        "session_uuid": session_id,
        "user_id": current_user["user_id"],
        "language": req.language,
        "started_at": datetime.now(timezone.utc).isoformat()
    })

    return ChatSessionOut(
        session_id=session_id,
        user_id=current_user["user_id"],
        language=req.language,
        started_at=session_row.get("started_at") if isinstance(session_row, dict) else None
    )


@router.post("/session/{session_uuid}/message", response_model=ChatMessageOut)
async def send_message(
    session_uuid: str,
    msg_in: ChatMessageIn,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Post a user message, route to the correct query mode, and return AI response.

    Modes:
      - "database"        : Intent Detection → ZCQL → Catalyst Datastore → QuickML GLM
      - "knowledge_base"  : Catalyst QuickML RAG endpoint (uploaded KB documents)
    """
    if not can_access(current_user["role"], "chat:use"):
        raise HTTPException(status_code=403, detail="Permission denied")

    sessions = db.query_rows("ChatSession", {"session_uuid": session_uuid})
    if not sessions:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # ── Save user message ────────────────────────────────────────────────────
    msg_uuid = str(uuid.uuid4())
    db.insert_row("ChatMessage", {
        "message_uuid": msg_uuid,
        "session_id": session_uuid,
        "role": "user",
        "content": msg_in.content,
        "retrieved_refs": "[]",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # ── Route to the correct AI mode ─────────────────────────────────────────
    mode = msg_in.mode or "database"

    if mode == "knowledge_base":
        ans_data = QuickMLService.query_knowledge_base(msg_in.content, request)
    else:
        # Default: full database pipeline
        ans_data = QuickMLService.query_database(msg_in.content, request)

    intent = ans_data.get("intent", mode)
    content = ans_data.get("content", "")
    retrieved_refs = ans_data.get("retrieved_refs", [])

    # ── Save assistant message ───────────────────────────────────────────────
    assistant_msg_uuid = str(uuid.uuid4())
    db.insert_row("ChatMessage", {
        "message_uuid": assistant_msg_uuid,
        "session_id": session_uuid,
        "role": "assistant",
        "content": content,
        "retrieved_refs": json.dumps(retrieved_refs),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # ── Audit log ────────────────────────────────────────────────────────────
    db.insert_row("AuditLog", {
        "user_id": current_user["user_id"],
        "action": "AI_QUERY",
        "resource_type": f"chat:{mode}",
        "resource_ids": assistant_msg_uuid,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    return ChatMessageOut(
        message_id=assistant_msg_uuid,
        session_id=session_uuid,
        role="assistant",
        content=content,
        retrieved_doc_refs=retrieved_refs,
        intent=intent,
        created_at=datetime.now(timezone.utc).isoformat()
    )


@router.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a document to Catalyst File Store / local fallback."""
    if not can_access(current_user["role"], "chat:use"):
        raise HTTPException(status_code=403, detail="Permission denied")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file upload")

    res = FilestoreService.upload_document(file.filename, content)
    return res


@router.get("/documents")
async def list_documents(
    current_user: dict = Depends(get_current_user)
):
    """List all uploaded documents."""
    if not can_access(current_user["role"], "chat:use"):
        raise HTTPException(status_code=403, detail="Permission denied")

    return FilestoreService.list_documents()


@router.delete("/documents/{file_id}")
async def delete_document(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an uploaded document."""
    if not can_access(current_user["role"], "chat:use"):
        raise HTTPException(status_code=403, detail="Permission denied")

    success = FilestoreService.delete_document(file_id)
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "success", "message": "File deleted successfully"}