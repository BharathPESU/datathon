from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid
from app.models.chat import ChatSessionCreate, ChatSessionOut, ChatMessageIn, ChatMessageOut
from app.services.nl2sql_service import NL2SQLService
from app.services.rag_service import RAGService
from app.core.security import get_current_user
from app.core.permissions import can_access
from app.db import catalyst_db as db

router = APIRouter()

@router.post("/session", response_model=ChatSessionOut)
async def create_chat_session(req: ChatSessionCreate, current_user: dict = Depends(get_current_user)):
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
        started_at=session_row["started_at"]
    )

@router.post("/session/{session_uuid}/message", response_model=ChatMessageOut)
async def send_message(
    session_uuid: str,
    msg_in: ChatMessageIn,
    current_user: dict = Depends(get_current_user)
):
    """Post user message, trigger NL2SQL intent and RAG retrieval, and return response."""
    if not can_access(current_user["role"], "chat:use"):
        raise HTTPException(status_code=403, detail="Permission denied")
        
    sessions = db.query_rows("ChatSession", {"session_uuid": session_uuid})
    if not sessions:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    # Save User message
    msg_uuid = str(uuid.uuid4())
    db.insert_row("ChatMessage", {
        "message_uuid": msg_uuid,
        "session_id": session_uuid,
        "role": "user",
        "content": msg_in.content,
        "retrieved_refs": "[]",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # 1. Intent Classification
    classification = NL2SQLService.classify_query(msg_in.content)
    intent = classification.get("intent", "general_chat")
    params = classification.get("params", {})
    
    # 2. Retrieval (RAG)
    # Search for matching cases based on query/parameters
    search_keyword = params.get("keyword") or msg_in.content
    retrieved_cases = RAGService.retrieve_cases(search_keyword, limit=3)
    
    # 3. Response generation
    ans_data = RAGService.answer_question(msg_in.content, retrieved_cases)
    
    # Save Assistant message
    assistant_msg_uuid = str(uuid.uuid4())
    db.insert_row("ChatMessage", {
        "message_uuid": assistant_msg_uuid,
        "session_id": session_uuid,
        "role": "assistant",
        "content": ans_data["content"],
        "retrieved_refs": json_dumps(ans_data["retrieved_refs"]),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Audit log
    db.insert_row("AuditLog", {
        "user_id": current_user["user_id"],
        "action": "AI_QUERY",
        "resource_type": "chat",
        "resource_ids": assistant_msg_uuid,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return ChatMessageOut(
        message_id=assistant_msg_uuid,
        session_id=session_uuid,
        role="assistant",
        content=ans_data["content"],
        retrieved_doc_refs=ans_data["retrieved_refs"],
        intent=intent,
        created_at=datetime.now(timezone.utc).isoformat()
    )

def json_dumps(obj):
    import json
    return json.dumps(obj)