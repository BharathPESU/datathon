from fastapi import APIRouter, HTTPException, Depends, Query, Request
from app.models.user import AuditLogOut, UserOut, UserCreate
from app.core.security import get_current_user, hash_password
from app.core.permissions import can_access
from app.db import catalyst_db as db
from app.services.cloud_seeder import run_cloud_migration

router = APIRouter()

@router.get("/audit-log")
async def get_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Retrieve compliance and access logs (Supervisor and Admin only)."""
    if not can_access(current_user["role"], "admin:audit"):
        raise HTTPException(status_code=403, detail="Permission denied")
        
    logs = db.get_all_rows("AuditLog")
    # Enrich with usernames
    enriched = []
    for l in logs:
        u = db.get_row("AppUser", l.get("user_id", 0))
        enriched.append({
            **l,
            "username": u["username"] if u else f"User #{l.get('user_id')}"
        })
        
    # Sort latest first
    enriched.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    
    total = len(enriched)
    start = (page - 1) * page_size
    items = enriched[start:start + page_size]
    
    return {"items": items, "total": total}

@router.get("/users")
async def list_users(current_user: dict = Depends(get_current_user)):
    """List system users (Admin only)."""
    if not can_access(current_user["role"], "admin:write"):
        # We check "admin:write" or check if role is admin
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Permission denied")
            
    users = db.get_all_rows("AppUser")
    out = [
        UserOut(
            user_id=u["ROWID"],
            username=u["username"],
            role=u["role"],
            employee_id=u.get("employee_id")
        )
        for u in users
    ]
    return {"users": out}

@router.post("/users", response_model=UserOut)
async def create_user(req: UserCreate, current_user: dict = Depends(get_current_user)):
    """Create a new system account (Admin only)."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")
        
    # Check if user already exists
    existing = db.query_rows("AppUser", {"username": req.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
        
    user_row = db.insert_row("AppUser", {
        "username": req.username,
        "hashed_password": hash_password(req.password),
        "role": req.role,
        "employee_id": req.employee_id
    })
    
    return UserOut(
        user_id=user_row["ROWID"],
        username=user_row["username"],
        role=user_row["role"],
        employee_id=user_row.get("employee_id")
    )


import logging
logger = logging.getLogger(__name__)

ROLE_IDS = {
    "admin": "55341000000057003",
    "investigator": "55341000000057006",
    "supervisor": "55341000000070002",
    "analyst": "55341000000070004"
}


@router.get("/pending-users")
async def list_pending_users(current_user: dict = Depends(get_current_user)):
    """List pending registration approval requests (Admin only)."""
    if current_user["role"].lower() != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")

    users = db.get_all_rows("AppUser")
    pending = []
    for u in users:
        is_active = u.get("is_active")
        # Check if is_active is False
        if is_active is False or str(is_active).lower() == "false":
            pending.append(
                UserOut(
                    user_id=u["ROWID"],
                    username=u["username"],
                    role=u["role"],
                    employee_id=u.get("employee_id"),
                    is_active=False
                )
            )
    return {"users": pending}


@router.post("/users/{user_id}/approve")
async def approve_user(user_id: int, current_user: dict = Depends(get_current_user)):
    """Approve a pending user registration request, activating it and registering in Catalyst (Admin only)."""
    if current_user["role"].lower() != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")

    user_row = db.get_row("AppUser", user_id)
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    user_row["is_active"] = True
    db.update_row("AppUser", user_row)

    role_key = str(user_row.get("role", "investigator")).lower()
    role_id = ROLE_IDS.get(role_key, ROLE_IDS["investigator"])

    app = db.get_db_app()
    if app:
        try:
            signup_config = {
                "platform_type": "web",
                "redirect_url": "http://localhost:3000/login",
                "template_details": {
                    "senders_mail": "verified_email@yourdomain.com", # Update with verified sender email
                    "subject": "Account Approved - KSP Crime Analytics",
                    "message": "<p>Hello,</p><p>Your request has been approved! You can now log in: <a href='%LINK%'>Login</a></p>"
                }
            }
            user_details = {
                "first_name": user_row["username"].split("@")[0],
                "email_id": user_row["username"],
                "role_id": role_id
            }
            app.authentication().register_user(signup_config, user_details)
        except Exception as e:
            logger.error(f"Catalyst signup invitation failed: {e}")

    return {"status": "success", "message": f"User {user_row['username']} approved and activated."}


@router.post("/users/{user_id}/reject")
async def reject_user(user_id: int, current_user: dict = Depends(get_current_user)):
    """Reject a pending registration request (Admin only)."""
    if current_user["role"].lower() != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")

    user_row = db.get_row("AppUser", user_id)
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete_row("AppUser", user_id)
    return {"status": "success", "message": f"Registration request for {user_row['username']} rejected."}


@router.post("/seed-cloud")
async def seed_cloud_database(request: Request, current_user: dict = Depends(get_current_user)):
    """Migrates and seeds the active Zoho Catalyst Cloud Data Store (Admin only)."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")
        
    try:
        # Run cloud migration for 200 cases
        result = run_cloud_migration(request=request, num_cases=200)
        return result
    except Exception as e:
        schema_debug = {}
        try:
            from app.services.cloud_seeder import get_catalyst_app
            app = get_catalyst_app(request)
            datastore = app.datastore()
            for tbl in ["State", "District", "Unit", "CrimeHead", "Employee"]:
                try:
                    cols = datastore.table(tbl).get_all_columns()
                    schema_debug[tbl] = [c.get("column_name") for c in cols]
                except Exception as ex_tbl:
                    schema_debug[tbl] = f"Error: {ex_tbl}"
        except Exception as ex_sdk:
            schema_debug["sdk_error"] = str(ex_sdk)
            
        raise HTTPException(
            status_code=500,
            detail=f"Migration failed: {e}. Live schemas: {schema_debug}"
        )

@router.get("/stats")
async def get_system_stats(current_user: dict = Depends(get_current_user)):
    """Retrieve row counts for all Catalyst tables (Admin/Supervisor only)."""
    if current_user["role"] not in ["admin", "supervisor"]:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    stats = db.get_table_stats()
    total_records = sum(stats.values())
    
    return {
        "tables": stats,
        "total_records": total_records
    }