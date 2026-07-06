from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone
from app.models.user import LoginRequest, TokenResponse, RefreshRequest, UserOut
from app.core.security import (
    verify_password, create_access_token, create_refresh_token,
    decode_token, get_current_user
)
from app.db import catalyst_db as db

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    """Authenticate user and return JWT tokens."""
    users = db.query_rows("AppUser", {"username": req.username})
    if not users:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = users[0]
    if not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token_data = {
        "sub": str(user["ROWID"]),
        "username": user["username"],
        "role": user["role"],
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Audit log
    db.insert_row("AuditLog", {
        "user_id": user["ROWID"],
        "action": "LOGIN",
        "resource_type": "auth",
        "resource_ids": str(user["ROWID"]),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user["role"],
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(req: RefreshRequest):
    """Refresh access token."""
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_data = {
        "sub": payload.get("sub"),
        "username": payload.get("username"),
        "role": payload.get("role"),
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=payload.get("role"),
    )

@router.get("/me", response_model=UserOut)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user details."""
    user_row = db.get_row("AppUser", current_user["user_id"])
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")
        
    return UserOut(
        user_id=user_row["ROWID"],
        username=user_row["username"],
        role=user_row["role"],
        employee_id=user_row.get("employee_id")
    )