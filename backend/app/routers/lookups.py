from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.core.security import get_current_user
from app.db import catalyst_db as db

router = APIRouter()

@router.get("/metadata")
async def get_all_metadata(current_user: dict = Depends(get_current_user)):
    """Fetch all lookups at once to optimize frontend load times."""
    districts = db.get_all_rows("District")
    units = db.get_all_rows("Unit")
    categories = db.get_all_rows("CaseCategory")
    gravities = db.get_all_rows("GravityOffence")
    crime_heads = db.get_all_rows("CrimeHead")
    crime_subheads = db.get_all_rows("CrimeSubHead")
    statuses = db.get_all_rows("CaseStatus")
    occupations = db.get_all_rows("OccupationMaster")
    courts = db.get_all_rows("Court")
    states = db.get_all_rows("State")
    
    # Sort logically
    districts.sort(key=lambda x: x.get("district_name") or "")
    units.sort(key=lambda x: x.get("unit_name") or "")
    categories.sort(key=lambda x: x.get("category_name") or "")
    gravities.sort(key=lambda x: x.get("gravity_name") or "")
    crime_heads.sort(key=lambda x: x.get("crime_head_name") or "")
    crime_subheads.sort(key=lambda x: x.get("crime_sub_head_name") or "")
    statuses.sort(key=lambda x: x.get("status_name") or "")
    occupations.sort(key=lambda x: x.get("occupation_name") or "")
    courts.sort(key=lambda x: x.get("court_name") or "")
    
    return {
        "districts": districts,
        "units": units,
        "categories": categories,
        "gravities": gravities,
        "crime_heads": crime_heads,
        "crime_subheads": crime_subheads,
        "statuses": statuses,
        "occupations": occupations,
        "courts": courts,
        "states": states
    }
