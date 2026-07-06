# Pydantic models for Users and Auth
from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    role: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class UserOut(BaseModel):
    user_id: int
    username: str
    role: str
    employee_id: Optional[int] = None

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "investigator"
    employee_id: Optional[int] = None

class AuditLogOut(BaseModel):
    ROWID: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_ids: Optional[str] = None
    timestamp: Optional[str] = None
