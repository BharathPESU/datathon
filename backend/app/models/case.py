# Pydantic models for Cases, Accused, Victims, Complainants
from pydantic import BaseModel
from typing import Optional, Any

# ---- Lookup models ----
class DistrictOut(BaseModel):
    ROWID: int
    district_name: str
    state_id: Optional[int] = None

class UnitOut(BaseModel):
    ROWID: int
    unit_name: str
    district_id: Optional[int] = None

class CrimeCategoryOut(BaseModel):
    ROWID: int
    category_name: str

class CrimeHeadOut(BaseModel):
    ROWID: int
    crime_head_name: str

class CrimeSubHeadOut(BaseModel):
    ROWID: int
    crime_sub_head_name: str
    crime_head_id: Optional[int] = None

# ---- Core entity models ----
class AccusedOut(BaseModel):
    ROWID: int
    case_master_id: int
    accused_name: str
    age_year: Optional[int] = None
    gender: Optional[str] = None
    person_id: Optional[str] = None  # A1, A2, etc.

class VictimOut(BaseModel):
    ROWID: int
    case_master_id: int
    victim_name: str
    age_year: Optional[int] = None
    gender: Optional[str] = None

class ComplainantOut(BaseModel):
    ROWID: int
    case_master_id: int
    complainant_name: str
    age_year: Optional[int] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None

class ArrestOut(BaseModel):
    ROWID: int
    case_master_id: int
    arrest_date: Optional[str] = None
    accused_master_id: Optional[int] = None
    is_accused: Optional[int] = None

# ---- Case models ----
class CaseListItem(BaseModel):
    ROWID: int
    crime_no: str
    case_no: Optional[str] = None
    crime_registered_date: Optional[str] = None
    district_name: Optional[str] = None
    police_station: Optional[str] = None
    category_name: Optional[str] = None
    gravity: Optional[str] = None
    crime_head: Optional[str] = None
    crime_sub_head: Optional[str] = None
    status: Optional[str] = None
    brief_facts: Optional[str] = None

class CaseDetail(CaseListItem):
    incident_from_date: Optional[str] = None
    incident_to_date: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accused_list: list[AccusedOut] = []
    victim_list: list[VictimOut] = []
    complainant_list: list[ComplainantOut] = []
    arrests: list[ArrestOut] = []

class PaginatedResponse(BaseModel):
    items: list[CaseListItem] = []
    total: int = 0
    page: int = 1
    page_size: int = 20