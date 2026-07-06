from fastapi import APIRouter, HTTPException, Depends, Query
from app.models.analytics import RiskScoreOut, ContributingFactor, RepeatOffendersResponse, RepeatOffender, OffenderCaseInfo
from app.core.security import get_current_user
from app.core.permissions import can_access
from app.db import catalyst_db as db

router = APIRouter()

@router.get("/accused/{accused_id}", response_model=RiskScoreOut)
async def get_accused_risk(accused_id: int, current_user: dict = Depends(get_current_user)):
    """Fetch recidivism risk score and factors for an accused."""
    if not can_access(current_user["role"], "risk:read"):
        raise HTTPException(status_code=403, detail="Permission denied")
        
    accused_row = db.get_row("Accused", accused_id)
    if not accused_row:
        raise HTTPException(status_code=404, detail="Accused not found")
        
    # Simple rule-based scoring
    # Calculate case count for this accused name
    all_accused = db.get_all_rows("Accused")
    cases_count = sum(1 for a in all_accused if a["accused_name"] == accused_row["accused_name"])
    
    score = 10  # base score
    factors = [
        ContributingFactor(
            factor="Base Recidivism",
            value="Standard",
            points=10,
            description="Initial default profiling value"
        )
    ]
    
    if cases_count > 1:
        pts = min(40, (cases_count - 1) * 15)
        score += pts
        factors.append(ContributingFactor(
            factor="Prior Records",
            value=f"{cases_count} cases",
            points=pts,
            description=f"Accused has {cases_count} recorded offences in database"
        ))
        
    # Check if case gravity was Heinous
    linked_cases = [a["case_master_id"] for a in all_accused if a["accused_name"] == accused_row["accused_name"]]
    heinous_count = 0
    for cid in linked_cases:
        case = db.get_row("CaseMaster", cid)
        if case and case.get("gravity_offence_id") == 1: # Heinous
            heinous_count += 1
            
    if heinous_count > 0:
        pts = heinous_count * 20
        score += pts
        factors.append(ContributingFactor(
            factor="Severe Offences",
            value=f"{heinous_count} Heinous",
            points=pts,
            description="Linked to one or more Heinous/Violent crimes"
        ))
        
    score = min(100, score)
    
    risk_level = "low"
    if score > 75:
        risk_level = "critical"
    elif score > 50:
        risk_level = "high"
    elif score > 25:
        risk_level = "medium"
        
    return RiskScoreOut(
        accused_master_id=accused_id,
        accused_name=accused_row["accused_name"],
        score=score,
        risk_level=risk_level,
        case_count=cases_count,
        contributing_factors=factors
    )

@router.get("/repeat-offenders", response_model=RepeatOffendersResponse)
async def list_repeat_offenders(
    min_cases: int = Query(2, ge=2),
    current_user: dict = Depends(get_current_user)
):
    """Retrieve repeat offenders with risk scores and timeline history."""
    if not can_access(current_user["role"], "risk:read"):
        raise HTTPException(status_code=403, detail="Permission denied")
        
    all_accused = db.get_all_rows("Accused")
    all_cases = db.get_all_rows("CaseMaster")
    all_subheads = db.get_all_rows("CrimeSubHead")
    subhead_map = {sh["ROWID"]: sh["crime_sub_head_name"] for sh in all_subheads}
    
    # Group by name
    name_to_records = {}
    for r in all_accused:
        name = r["accused_name"]
        if name not in name_to_records:
            name_to_records[name] = []
        name_to_records[name].append(r)
        
    offenders = []
    for name, records in name_to_records.items():
        if len(records) >= min_cases:
            cases_info = []
            score = 10 + min(40, (len(records) - 1) * 15)
            
            for rec in records:
                cid = rec["case_master_id"]
                case = next((c for c in all_cases if c["ROWID"] == cid), None)
                if case:
                    cases_info.append(OffenderCaseInfo(
                        case_master_id=cid,
                        crime_no=case["crime_no"],
                        date=case.get("crime_registered_date") or "",
                        crime_type=subhead_map.get(case.get("crime_sub_head_id", 0), "Unknown")
                    ))
                    if case.get("gravity_offence_id") == 1:
                        score += 20
                        
            # Sort cases chronologically
            cases_info.sort(key=lambda x: x.date)
            
            offenders.append(RepeatOffender(
                accused_master_id=records[0]["ROWID"],
                accused_name=name,
                case_count=len(records),
                cases=cases_info,
                risk_score=min(100, score)
            ))
            
    # Sort by risk score descending
    offenders.sort(key=lambda x: x.risk_score, reverse=True)
    return RepeatOffendersResponse(offenders=offenders)