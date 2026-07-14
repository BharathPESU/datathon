from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone
from app.models.user import LoginRequest, TokenResponse, RefreshRequest, UserOut, SignUpRequest
from app.core.security import (
    verify_password, create_access_token, create_refresh_token,
    decode_token, get_current_user
)
from app.db import catalyst_db as db

router = APIRouter()


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(req: SignUpRequest):
    """Submit a registration request for Admin approval."""
    # Check if user already exists
    existing = db.query_rows("AppUser", {"username": req.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Insert pending approval user
    from app.core.security import hash_password
    user_row = db.insert_row("AppUser", {
        "username": req.username,
        "hashed_password": hash_password(req.password),
        "role": req.role,
        "employee_id": req.employee_id,
        "is_active": False
    })

    return {
        "status": "success",
        "message": "Registration request submitted. Access is pending Admin approval."
    }


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    """Authenticate user and return JWT tokens."""
    users = db.query_rows("AppUser", {"username": req.username})
    if not users:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = users[0]
    if not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Enforce approval check
    if user.get("is_active") is False or str(user.get("is_active")).lower() == "false":
        raise HTTPException(
            status_code=403,
            detail="Your registration is pending Admin approval."
        )

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


@router.get("/custom-token")
async def get_custom_token(email: str):
    """Retrieve custom JWT token for Zoho Catalyst Sign-In (if approved)."""
    users = db.query_rows("AppUser", {"username": email})
    if not users:
        raise HTTPException(status_code=404, detail="User email not pre-registered or invited by Admin.")

    user_row = users[0]
    is_active = user_row.get("is_active")
    if is_active is False or str(is_active).lower() == "false":
        raise HTTPException(status_code=403, detail="Your registration request is pending Admin approval.")

    app = db.get_db_app()
    if not app:
        raise HTTPException(status_code=500, detail="Catalyst SDK not initialized.")

    try:
        role_name = user_row["role"]
        role_display = {
            "admin": "Admin",
            "investigator": "investigator",
            "supervisor": "supervisor",
            "analyst": "analyst"
        }.get(role_name.lower(), role_name)

        custom_token = app.authentication().generate_custom_token({
            "type": "web",
            "user_details": {
                "email_id": user_row["username"],
                "first_name": user_row["username"].split("@")[0],
                "last_name": "User",
                "role_name": role_display
            }
        })
        return {
            "client_id": custom_token.get("client_id"),
            "scopes": custom_token.get("scopes"),
            "jwt_token": custom_token.get("jwt_token")
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to generate custom token: {str(e)}")