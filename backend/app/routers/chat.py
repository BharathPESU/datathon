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
        ans_data = QuickMLService.query_knowledge_base(msg_in.content, session_uuid=session_uuid, request=request)
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


@router.get("/sessions")
async def get_user_sessions(
    current_user: dict = Depends(get_current_user)
):
    """List all chat sessions for the logged-in user."""
    if not can_access(current_user["role"], "chat:use"):
        raise HTTPException(status_code=403, detail="Permission denied")

    try:
        user_id = current_user["user_id"]
        query = f"SELECT * FROM ChatSession WHERE user_id = {user_id}"
        rows = db.execute_query(query)
        rows.sort(key=lambda x: x.get("started_at") or "", reverse=True)
        return rows
    except Exception as e:
        logger.error(f"Failed to query ChatSession: {e}")
        all_sess = db.get_all_rows("ChatSession")
        filtered = [s for s in all_sess if s.get("user_id") == current_user["user_id"]]
        filtered.sort(key=lambda x: x.get("started_at") or "", reverse=True)
        return filtered


@router.get("/session/{session_uuid}/messages")
async def get_session_messages(
    session_uuid: str,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve chat history messages for a session."""
    if not can_access(current_user["role"], "chat:use"):
        raise HTTPException(status_code=403, detail="Permission denied")

    try:
        query = f"SELECT * FROM ChatMessage WHERE session_id = '{session_uuid}'"
        rows = db.execute_query(query)
        rows.sort(key=lambda x: x.get("created_at") or "")
        return rows
    except Exception as e:
        logger.error(f"Failed to query ChatMessage: {e}")
        all_msg = db.get_all_rows("ChatMessage")
        filtered = [m for m in all_msg if m.get("session_id") == session_uuid]
        filtered.sort(key=lambda x: x.get("created_at") or "")
        return filtered


@router.post("/session/{session_uuid}/documents")
async def upload_session_document(
    session_uuid: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a document to Catalyst File Store, perform Zia OCR if PDF, and link to session."""
    if not can_access(current_user["role"], "chat:use"):
        raise HTTPException(status_code=403, detail="Permission denied")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file upload")

    # 1. Upload to File Store
    res = FilestoreService.upload_document(file.filename, content)
    file_id = res.get("file_id")

    # 2. Extract OCR text if PDF
    extracted_text = ""
    if file.filename.lower().endswith(".pdf"):
        app = db.get_db_app()
        if app:
            try:
                import tempfile
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name
                
                with open(tmp_path, "rb") as f:
                    ocr_data = app.zia().extract_optical_characters(f)
                    extracted_text = ocr_data.get("text", "")
                
                try:
                    os.remove(tmp_path)
                except:
                    pass
            except Exception as ocr_err:
                logger.error(f"Zia OCR extraction failed: {ocr_err}")
                
    # Fallback to general text decoding if no OCR text extracted
    if not extracted_text:
        try:
            extracted_text = content.decode("utf-8", errors="ignore")
        except:
            extracted_text = f"Content of {file.filename}"

    # 3. Store mapping in chat_bot_knowledge_base
    from app.services.kb_service import insert_kb_row
    insert_kb_row(session_uuid, file_id, file.filename, extracted_text)

    return {
        "status": "success",
        "file_id": file_id,
        "filename": file.filename,
        "session_uuid": session_uuid,
        "extracted_chars": len(extracted_text)
    }


@router.get("/session/{session_uuid}/documents")
async def list_session_documents(
    session_uuid: str,
    current_user: dict = Depends(get_current_user)
):
    """List all uploaded documents associated with the active session."""
    if not can_access(current_user["role"], "chat:use"):
        raise HTTPException(status_code=403, detail="Permission denied")

    from app.services.kb_service import get_kb_rows_by_session
    rows = get_kb_rows_by_session(session_uuid)
    
    result = []
    for r in rows:
        result.append({
            "file_id": r["file_id"],
            "filename": r["filename"],
            "session_uuid": r["session_uuid"],
            "size_bytes": len(r.get("extracted_text", ""))
        })
    return result


@router.delete("/session/{session_uuid}/documents/{file_id}")
async def delete_session_document(
    session_uuid: str,
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a document from File Store and remove its session/OCR mapping."""
    if not can_access(current_user["role"], "chat:use"):
        raise HTTPException(status_code=403, detail="Permission denied")

    FilestoreService.delete_document(file_id)

    from app.services.kb_service import delete_kb_row
    delete_kb_row(session_uuid, file_id)

    return {"status": "success", "message": "Session document deleted successfully"}