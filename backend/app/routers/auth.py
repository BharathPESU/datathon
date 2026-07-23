from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.user import LoginRequest, TokenResponse, RefreshRequest, UserOut
from app.core.security import (
    verify_password, create_access_token, create_refresh_token,
    decode_token, get_current_user
)
from app.db import catalyst_db as db
from app.db import user_roles

router = APIRouter()

class RoleRequestInput(BaseModel):
    email: EmailStr
    role: str = "investigator"
    employee_id: Optional[int] = None

class GoogleAuthVerifyInput(BaseModel):
    email: EmailStr

@router.post("/request-role", status_code=status.HTTP_201_CREATED)
async def request_role(req: RoleRequestInput):
    """Submit a access request for an email address with a requested role (No password needed)."""
    # Check if role request already approved or pending
    existing = user_roles.get_user_role_by_email(req.email)
    if existing:
        if existing["status"] == "approved":
            return {
                "status": "approved",
                "message": "This email has already been approved by Admin! You can sign in using Google."
            }
        elif existing["status"] == "pending":
            return {
                "status": "pending",
                "message": "Access request is already submitted and pending Admin approval."
            }

    row = user_roles.request_user_role(email=req.email, role=req.role, employee_id=req.employee_id)
    return {
        "status": "success",
        "message": f"Access request submitted for {req.email}. You will be able to log in with Google once the Admin approves your request."
    }

@router.post("/google-verify", response_model=TokenResponse)
async def google_verify(req: GoogleAuthVerifyInput):
    """Verify if the Google OAuth user is approved by Admin and generate application JWT token."""
    user_record = user_roles.get_user_role_by_email(req.email)
    
    if not user_record:
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Your email has not been added or approved by an Admin. Please submit a role request first."
        )

    if user_record["status"] == "pending":
        raise HTTPException(
            status_code=403,
            detail="Access Pending: Your access request is currently pending Admin approval."
        )

    if user_record["status"] == "rejected":
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Your access request was rejected by the Admin."
        )

    # Approved user -> Generate access token
    role = user_record["role"]
    token_data = {
        "sub": req.email,
        "username": req.email,
        "role": role,
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=role,
    )

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    """Authenticate Admin/User with username and password."""
    # Special direct check for admin or AppUser
    users = db.query_rows("AppUser", {"username": req.username})
    if not users:
        # Fallback check for admin default
        if (req.username == "bharath" and req.password == "bharath@123") or (req.username == "admin" and req.password == "admin"):
            token_data = {"sub": "1", "username": req.username, "role": "admin"}
            return TokenResponse(
                access_token=create_access_token(token_data),
                refresh_token=create_refresh_token(token_data),
                role="admin"
            )
        raise HTTPException(status_code=401, detail="Invalid username or password")

    user = users[0]
    if not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token_data = {
        "sub": str(user["ROWID"]),
        "username": user["username"],
        "role": user["role"],
    }
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
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
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=payload.get("role"),
    )

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current logged in user details."""
    email = current_user.get("username", "")
    role_info = user_roles.get_user_role_by_email(email)
    return {
        "username": email,
        "role": current_user.get("role"),
        "status": role_info["status"] if role_info else "approved"
    }