# Pydantic models for Chat
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ChatSessionCreate(BaseModel):
    language: str = "en"

class ChatSessionOut(BaseModel):
    session_id: str
    user_id: Optional[int] = None
    language: str = "en"
    started_at: Optional[str] = None

class ChatMessageIn(BaseModel):
    content: str

class DocRef(BaseModel):
    case_master_id: int
    crime_no: Optional[str] = None
    snippet: Optional[str] = None

class ChatMessageOut(BaseModel):
    message_id: str
    session_id: str
    role: str  # "user" | "assistant"
    content: str
    retrieved_doc_refs: list[DocRef] = []
    intent: Optional[str] = None
    created_at: Optional[str] = None
