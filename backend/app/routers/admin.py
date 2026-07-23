from fastapi import APIRouter, HTTPException, Depends, Query, Request
from app.models.user import AuditLogOut, UserOut, UserCreate
from app.core.security import get_current_user, hash_password
from app.core.permissions import can_access
from app.db import catalyst_db as db
from app.db import user_roles
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


@router.get("/users")
async def list_users(current_user: dict = Depends(get_current_user)):
    """List all user roles & pre-approved emails (Admin only)."""
    if current_user["role"].lower() != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")
    users = user_roles.list_all_user_roles()
    return {"users": users}

@router.post("/users")
async def add_user_by_admin(req: dict, current_user: dict = Depends(get_current_user)):
    """Add a user email directly with assigned role (Admin only). User can then log in via Google."""
    if current_user["role"].lower() != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    email = req.get("email")
    role = req.get("role", "investigator")
    employee_id = req.get("employee_id")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
        
    row = user_roles.add_approved_user(email=email, role=role, employee_id=employee_id)
    return {"status": "success", "message": f"User {email} added with role {role}. They can now sign in with Google.", "user": row}

@router.get("/pending-users")
async def list_pending_users(current_user: dict = Depends(get_current_user)):
    """List pending role request approvals (Admin only)."""
    if current_user["role"].lower() != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")

    pending = user_roles.list_pending_role_requests()
    return {"users": pending}

@router.post("/users/approve")
async def approve_user_email(req: dict, current_user: dict = Depends(get_current_user)):
    """Approve a pending role request (Admin only)."""
    if current_user["role"].lower() != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")

    email = req.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    row = user_roles.approve_user_request(email)
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")

    return {"status": "success", "message": f"Access request for {email} approved. User can now sign in with Google."}

@router.post("/users/reject")
async def reject_user_email(req: dict, current_user: dict = Depends(get_current_user)):
    """Reject a pending role request (Admin only)."""
    if current_user["role"].lower() != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")

    email = req.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    row = user_roles.reject_user_request(email)
    return {"status": "success", "message": f"Access request for {email} rejected."}


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