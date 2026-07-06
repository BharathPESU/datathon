from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from app.models.case import CaseListItem, CaseDetail, PaginatedResponse, AccusedOut, VictimOut, ComplainantOut, ArrestOut
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