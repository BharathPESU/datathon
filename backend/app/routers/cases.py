from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone
from app.models.case import (
    CaseListItem, CaseDetail, PaginatedResponse, AccusedOut, VictimOut, ComplainantOut, ArrestOut,
    CaseCreate, CaseUpdate, AccusedCreate, AccusedUpdate, VictimCreate, VictimUpdate,
    ComplainantCreate, ComplainantUpdate, ArrestCreate, ArrestUpdate
)
from app.core.security import get_current_user
from app.core.permissions import can_access
from app.db import catalyst_db as db

router = APIRouter()

def _enrich_case(case: dict) -> dict:
    """Enrich a case row with lookup names."""
    # District
    district = db.get_row("District", case.get("district_id", 0))
    # Police station
    unit = db.get_row("Unit", case.get("police_station_id", 0))
    # Category
    category = db.get_row("CaseCategory", case.get("case_category_id", 0))
    # Gravity
    gravity = db.get_row("GravityOffence", case.get("gravity_offence_id", 0))
    # Crime head
    crime_head = db.get_row("CrimeHead", case.get("crime_head_id", 0))
    # Crime sub head
    crime_sub = db.get_row("CrimeSubHead", case.get("crime_sub_head_id", 0))
    # Status
    status = db.get_row("CaseStatus", case.get("case_status_id", 0))

    return {
        **case,
        "district_name": district["district_name"] if district else None,
        "police_station": unit["unit_name"] if unit else None,
        "category_name": category["category_name"] if category else None,
        "gravity": gravity["gravity_name"] if gravity else None,
        "crime_head": crime_head["crime_head_name"] if crime_head else None,
        "crime_sub_head": crime_sub["crime_sub_head_name"] if crime_sub else None,
        "status": status["status_name"] if status else None,
    }

@router.get("", response_model=PaginatedResponse)
async def list_cases(
    crime_no: Optional[str] = None,
    district_id: Optional[int] = None,
    keyword: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """List and search cases with pagination and RBAC filter."""
    if not can_access(current_user["role"], "cases:read"):
        raise HTTPException(status_code=403, detail="Permission denied")
        
    all_cases = db.get_all_rows("CaseMaster")
    filtered = []
    
    for case in all_cases:
        # Filters
        if crime_no and crime_no.lower() not in (case.get("crime_no") or "").lower():
            continue
        if district_id and case.get("district_id") != district_id:
            continue
        if keyword and keyword.lower() not in (case.get("brief_facts") or "").lower() and keyword.lower() not in (case.get("crime_no") or "").lower():
            continue
        filtered.append(_enrich_case(case))
        
    # Sort latest first
    filtered.sort(key=lambda x: x.get("crime_registered_date") or "", reverse=True)
    
    total = len(filtered)
    start = (page - 1) * page_size
    items = filtered[start:start + page_size]
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )

@router.get("/{rowid}", response_model=CaseDetail)
async def get_case(rowid: int, current_user: dict = Depends(get_current_user)):
    """Fetch details of a single case including linked entities."""
    if not can_access(current_user["role"], "cases:read"):
        raise HTTPException(status_code=403, detail="Permission denied")
        
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
        
    enriched = _enrich_case(case_row)
    
    # Linked entities
    all_accused = db.get_all_rows("Accused")
    all_victims = db.get_all_rows("Victim")
    all_complainants = db.get_all_rows("ComplainantDetails")
    all_arrests = db.get_all_rows("ArrestSurrender")
    
    accused_list = [AccusedOut(**r) for r in all_accused if r["case_master_id"] == rowid]
    victim_list = [VictimOut(**r) for r in all_victims if r["case_master_id"] == rowid]
    complainant_list = []
    
    for c in all_complainants:
        if c["case_master_id"] == rowid:
            occ_row = db.get_row("OccupationMaster", c.get("occupation_id", 0))
            complainant_list.append(ComplainantOut(
                ROWID=c["ROWID"],
                case_master_id=c["case_master_id"],
                complainant_name=c["complainant_name"],
                age_year=c.get("age_year"),
                gender=c.get("gender"),
                occupation=occ_row["occupation_name"] if occ_row else None
            ))
            
    arrests = [ArrestOut(**r) for r in all_arrests if r["case_master_id"] == rowid]
    
    return CaseDetail(
        **enriched,
        accused_list=accused_list,
        victim_list=victim_list,
        complainant_list=complainant_list,
        arrests=arrests
    )

# ---- Write & Modify access helper ----
def check_case_write_access(case_row: dict, current_user: dict):
    """
    Raises HTTPException if user is not authorized to modify the case.
    Admin/Supervisor can write to any case.
    Investigator can write only to their own cases (where police_person_id matches user employee_id).
    """
    if current_user["role"] in ["admin", "supervisor"]:
        return
        
    if current_user["role"] == "investigator":
        user_row = db.get_row("AppUser", current_user["user_id"])
        user_emp_id = user_row.get("employee_id") if user_row else None
        case_emp_id = case_row.get("police_person_id")
        if user_emp_id is not None and case_emp_id is not None and int(user_emp_id) == int(case_emp_id):
            return
            
    raise HTTPException(status_code=403, detail="Permission denied. You do not own this case.")

# Create Case (FIR Registration)
@router.post("", response_model=CaseDetail)
async def create_case(req: CaseCreate, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
        
    user_row = db.get_row("AppUser", current_user["user_id"])
    user_emp_id = user_row.get("employee_id") if user_row else None
    
    # Verify uniqueness of crime_no
    existing = [c for c in db.get_all_rows("CaseMaster") if c.get("crime_no") == req.crime_no]
    if existing:
        raise HTTPException(status_code=400, detail="Crime number already exists")
        
    case_data = req.dict()
    case_data["police_person_id"] = user_emp_id
    case_data["CREATEDTIME"] = datetime.now(timezone.utc).isoformat()
    case_data["MODIFIEDTIME"] = datetime.now(timezone.utc).isoformat()
    
    # Save case
    case_row = db.insert_row("CaseMaster", case_data)
    
    # Audit log
    db.insert_row("AuditLog", {
        "user_id": current_user["user_id"],
        "action": "CREATE_CASE",
        "resource_type": "CaseMaster",
        "resource_ids": str(case_row["ROWID"]),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return await get_case(case_row["ROWID"], current_user)

# Update Case Details
@router.put("/{rowid}", response_model=CaseDetail)
async def update_case(rowid: int, req: CaseUpdate, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
        
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
        
    check_case_write_access(case_row, current_user)
    
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    update_data["MODIFIEDTIME"] = datetime.now(timezone.utc).isoformat()
    
    db.update_row("CaseMaster", rowid, update_data)
    
    # Audit log
    db.insert_row("AuditLog", {
        "user_id": current_user["user_id"],
        "action": "UPDATE_CASE",
        "resource_type": "CaseMaster",
        "resource_ids": str(rowid),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return await get_case(rowid, current_user)

# ---- Accused CRUD ----
@router.post("/{rowid}/accused", response_model=AccusedOut)
async def add_accused(rowid: int, req: AccusedCreate, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_write_access(case_row, current_user)
    
    accused_data = req.dict()
    accused_data["case_master_id"] = rowid
    
    row = db.insert_row("Accused", accused_data)
    return AccusedOut(**row)

@router.put("/{rowid}/accused/{accused_rowid}", response_model=AccusedOut)
async def update_accused(rowid: int, accused_rowid: int, req: AccusedUpdate, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_write_access(case_row, current_user)
    
    accused_row = db.get_row("Accused", accused_rowid)
    if not accused_row or accused_row["case_master_id"] != rowid:
        raise HTTPException(status_code=404, detail="Accused record not found for this case")
        
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    row = db.update_row("Accused", accused_rowid, update_data)
    return AccusedOut(**row)

@router.delete("/{rowid}/accused/{accused_rowid}")
async def delete_accused(rowid: int, accused_rowid: int, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_write_access(case_row, current_user)
    
    accused_row = db.get_row("Accused", accused_rowid)
    if not accused_row or accused_row["case_master_id"] != rowid:
        raise HTTPException(status_code=404, detail="Accused record not found for this case")
        
    db.delete_row("Accused", accused_rowid)
    return {"status": "success", "message": "Accused record deleted"}

# ---- Victim CRUD ----
@router.post("/{rowid}/victims", response_model=VictimOut)
async def add_victim(rowid: int, req: VictimCreate, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_write_access(case_row, current_user)
    
    victim_data = req.dict()
    victim_data["case_master_id"] = rowid
    row = db.insert_row("Victim", victim_data)
    return VictimOut(**row)

@router.put("/{rowid}/victims/{victim_rowid}", response_model=VictimOut)
async def update_victim(rowid: int, victim_rowid: int, req: VictimUpdate, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_write_access(case_row, current_user)
    
    victim_row = db.get_row("Victim", victim_rowid)
    if not victim_row or victim_row["case_master_id"] != rowid:
        raise HTTPException(status_code=404, detail="Victim record not found for this case")
        
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    row = db.update_row("Victim", victim_rowid, update_data)
    return VictimOut(**row)

@router.delete("/{rowid}/victims/{victim_rowid}")
async def delete_victim(rowid: int, victim_rowid: int, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_write_access(case_row, current_user)
    
    victim_row = db.get_row("Victim", victim_rowid)
    if not victim_row or victim_row["case_master_id"] != rowid:
        raise HTTPException(status_code=404, detail="Victim record not found for this case")
        
    db.delete_row("Victim", victim_rowid)
    return {"status": "success", "message": "Victim record deleted"}

# ---- Complainant CRUD ----
@router.post("/{rowid}/complainants", response_model=ComplainantOut)
async def add_complainant(rowid: int, req: ComplainantCreate, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_write_access(case_row, current_user)
    
    comp_data = req.dict()
    comp_data["case_master_id"] = rowid
    row = db.insert_row("ComplainantDetails", comp_data)
    
    occ_row = db.get_row("OccupationMaster", row.get("occupation_id", 0))
    return ComplainantOut(
        ROWID=row["ROWID"],
        case_master_id=row["case_master_id"],
        complainant_name=row["complainant_name"],
        age_year=row.get("age_year"),
        gender=row.get("gender"),
        occupation=occ_row["occupation_name"] if occ_row else None
    )

@router.put("/{rowid}/complainants/{complainant_rowid}", response_model=ComplainantOut)
async def update_complainant(rowid: int, complainant_rowid: int, req: ComplainantUpdate, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_write_access(case_row, current_user)
    
    comp_row = db.get_row("ComplainantDetails", complainant_rowid)
    if not comp_row or comp_row["case_master_id"] != rowid:
        raise HTTPException(status_code=404, detail="Complainant record not found for this case")
        
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    row = db.update_row("ComplainantDetails", complainant_rowid, update_data)
    
    occ_row = db.get_row("OccupationMaster", row.get("occupation_id", 0))
    return ComplainantOut(
        ROWID=row["ROWID"],
        case_master_id=row["case_master_id"],
        complainant_name=row["complainant_name"],
        age_year=row.get("age_year"),
        gender=row.get("gender"),
        occupation=occ_row["occupation_name"] if occ_row else None
    )

@router.delete("/{rowid}/complainants/{complainant_rowid}")
async def delete_complainant(rowid: int, complainant_rowid: int, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_write_access(case_row, current_user)
    
    comp_row = db.get_row("ComplainantDetails", complainant_rowid)
    if not comp_row or comp_row["case_master_id"] != rowid:
        raise HTTPException(status_code=404, detail="Complainant record not found for this case")
        
    db.delete_row("ComplainantDetails", complainant_rowid)
    return {"status": "success", "message": "Complainant record deleted"}

# ---- ArrestSurrender CRUD ----
@router.post("/{rowid}/arrests", response_model=ArrestOut)
async def add_arrest(rowid: int, req: ArrestCreate, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_write_access(case_row, current_user)
    
    arrest_data = req.dict()
    arrest_data["case_master_id"] = rowid
    row = db.insert_row("ArrestSurrender", arrest_data)
    return ArrestOut(**row)

@router.put("/{rowid}/arrests/{arrest_rowid}", response_model=ArrestOut)
async def update_arrest(rowid: int, arrest_rowid: int, req: ArrestUpdate, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_write_access(case_row, current_user)
    
    arrest_row = db.get_row("ArrestSurrender", arrest_rowid)
    if not arrest_row or arrest_row["case_master_id"] != rowid:
        raise HTTPException(status_code=404, detail="Arrest record not found for this case")
        
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    row = db.update_row("ArrestSurrender", arrest_rowid, update_data)
    return ArrestOut(**row)

@router.delete("/{rowid}/arrests/{arrest_rowid}")
async def delete_arrest(rowid: int, arrest_rowid: int, current_user: dict = Depends(get_current_user)):
    if not can_access(current_user["role"], "cases:write"):
        raise HTTPException(status_code=403, detail="Permission denied")
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    check_case_write_access(case_row, current_user)
    
    arrest_row = db.get_row("ArrestSurrender", arrest_rowid)
    if not arrest_row or arrest_row["case_master_id"] != rowid:
        raise HTTPException(status_code=404, detail="Arrest record not found for this case")
        
    db.delete_row("ArrestSurrender", arrest_rowid)
    return {"status": "success", "message": "Arrest record deleted"}

@router.get("/{rowid}/similar-suspects")
async def get_similar_suspects(rowid: int, current_user: dict = Depends(get_current_user)):
    case_row = db.get_row("CaseMaster", rowid)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
        
    crime_sub_head_id = case_row.get("crime_sub_head_id")
    district_id = case_row.get("district_id")
    
    # 1. Fetch other cases sharing same crime_sub_head_id and district_id
    all_cases = db.get_all_rows("CaseMaster")
    matching_cases = []
    for c in all_cases:
        if c.get("ROWID") != rowid:
            # Match on same crime sub-head and district
            if c.get("crime_sub_head_id") == crime_sub_head_id and c.get("district_id") == district_id:
                matching_cases.append(c)
                
    # If no cases match both, fallback to matching just crime sub-head
    if not matching_cases:
        for c in all_cases:
            if c.get("ROWID") != rowid:
                if c.get("crime_sub_head_id") == crime_sub_head_id:
                    matching_cases.append(c)
                    
    # Limit to top 15 matching cases to keep payload manageable
    matching_cases = matching_cases[:15]
    matching_case_ids = {c["ROWID"] for c in matching_cases}
    
    # 2. Get accused linked to these cases
    all_accused = db.get_all_rows("Accused")
    related_suspects = []
    
    # Map district names and station names for reference
    districts_map = {d["ROWID"]: d["district_name"] for d in db.get_all_rows("District")}
    stations_map = {u["ROWID"]: u["unit_name"] for u in db.get_all_rows("Unit")}
    crime_subheads_map = {s["ROWID"]: s["crime_sub_head_name"] for s in db.get_all_rows("CrimeSubHead")}
    
    seen_accused_names = set()
    for acc in all_accused:
        case_id = acc.get("case_master_id")
        if case_id in matching_case_ids:
            name = acc.get("accused_name")
            if name and name not in seen_accused_names:
                seen_accused_names.add(name)
                # Find the matched case details
                matched_case = next(c for c in matching_cases if c["ROWID"] == case_id)
                related_suspects.append({
                    "ROWID": acc.get("ROWID"),
                    "accused_name": name,
                    "age_year": acc.get("age_year"),
                    "gender": acc.get("gender"),
                    "person_id": acc.get("person_id"),
                    "matched_case_id": case_id,
                    "crime_no": matched_case.get("crime_no"),
                    "district_name": districts_map.get(matched_case.get("district_id"), "Unknown"),
                    "police_station": stations_map.get(matched_case.get("police_station_id"), "Unknown"),
                    "crime_sub_head": crime_subheads_map.get(matched_case.get("crime_sub_head_id"), "Unknown"),
                    "brief_facts": matched_case.get("brief_facts", "")
                })
                
    return related_suspects


@router.get("/accused/search")
async def search_accused_database(
    district_id: Optional[int] = None,
    police_station_id: Optional[int] = None,
    crime_head_id: Optional[int] = None,
    case_status_id: Optional[int] = None,
    name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Filter and search accused criminals in the database."""
    if not can_access(current_user["role"], "cases:read"):
        raise HTTPException(status_code=403, detail="Permission denied")

    all_cases = db.get_all_rows("CaseMaster")
    all_accused = db.get_all_rows("Accused")
    
    # Map lookups for descriptive response
    districts_map = {d["ROWID"]: d.get("district_name") for d in db.get_all_rows("District")}
    stations_map = {u["ROWID"]: u.get("unit_name") for u in db.get_all_rows("Unit")}
    statuses_map = {s["ROWID"]: s.get("status_name") for s in db.get_all_rows("CaseStatus")}
    crime_heads_map = {h["ROWID"]: h.get("crime_head_name") for h in db.get_all_rows("CrimeHead")}

    case_map = {c["ROWID"]: c for c in all_cases}

    results = []
    for acc in all_accused:
        case_id = acc.get("case_master_id")
        if not case_id or case_id not in case_map:
            continue
            
        case = case_map[case_id]

        if district_id and int(case.get("district_id") or 0) != district_id:
            continue
        if police_station_id and int(case.get("police_station_id") or 0) != police_station_id:
            continue
        if crime_head_id and int(case.get("crime_head_id") or 0) != crime_head_id:
            continue
        if case_status_id and int(case.get("case_status_id") or 0) != case_status_id:
            continue
        if name and name.lower() not in (acc.get("accused_name") or "").lower():
            continue

        results.append({
            "ROWID": acc.get("ROWID"),
            "accused_name": acc.get("accused_name"),
            "age_year": acc.get("age_year"),
            "gender": acc.get("gender"),
            "person_id": acc.get("person_id"),
            "case_master_id": case_id,
            "crime_no": case.get("crime_no"),
            "brief_facts": case.get("brief_facts", ""),
            "district_name": districts_map.get(case.get("district_id"), "Unknown"),
            "police_station": stations_map.get(case.get("police_station_id"), "Unknown"),
            "case_status": statuses_map.get(case.get("case_status_id"), "Open"),
            "crime_head": crime_heads_map.get(case.get("crime_head_id"), "Unknown"),
        })

    return results