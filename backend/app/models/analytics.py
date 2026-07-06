# Pydantic models for Analytics, Network, Risk, Forecast
from pydantic import BaseModel
from typing import Optional

# ---- Analytics ----
class TrendPoint(BaseModel):
    period: str  # "2025-01", "2025-02", etc.
    count: int
    category: Optional[str] = None
    district: Optional[str] = None

class TrendResponse(BaseModel):
    data: list[TrendPoint] = []
    group_by: str = "month"

class HotspotPoint(BaseModel):
    latitude: float
    longitude: float
    count: int
    district: Optional[str] = None
    category: Optional[str] = None

class DemographicStat(BaseModel):
    group: str
    count: int
    percentage: float

class DemographicResponse(BaseModel):
    dimension: str  # "age_group", "gender", "occupation"
    data: list[DemographicStat] = []
    suppressed_groups: int = 0  # Count of groups below threshold

class CategoryDistribution(BaseModel):
    category: str
    count: int
    percentage: float

class KPIMetrics(BaseModel):
    total_cases: int = 0
    active_investigations: int = 0
    conviction_rate: float = 0.0
    avg_resolution_days: float = 0.0
    total_accused: int = 0
    total_victims: int = 0
    repeat_offenders: int = 0
    cases_this_month: int = 0

# ---- Network ----
class NetworkNode(BaseModel):
    id: str
    label: str
    type: str  # "accused" | "victim" | "case"
    size: Optional[float] = None
    color: Optional[str] = None
    metadata: Optional[dict] = None

class NetworkEdge(BaseModel):
    source: str
    target: str
    relationship: str  # "co_accused" | "victim_in" | "complainant_in"
    shared_case_ids: list[int] = []
    weight: float = 1.0

class NetworkGraph(BaseModel):
    nodes: list[NetworkNode] = []
    edges: list[NetworkEdge] = []
    clusters: list[dict] = []

class ClusterInfo(BaseModel):
    cluster_id: int
    member_ids: list[str]
    size: int
    district: Optional[str] = None

# ---- Risk ----
class ContributingFactor(BaseModel):
    factor: str
    value: str
    points: int
    description: str

class RiskScoreOut(BaseModel):
    accused_master_id: int
    accused_name: str
    score: int
    risk_level: str  # "low" | "medium" | "high" | "critical"
    case_count: int
    contributing_factors: list[ContributingFactor] = []

class OffenderCaseInfo(BaseModel):
    case_master_id: int
    crime_no: str
    date: str
    crime_type: str

class RepeatOffender(BaseModel):
    accused_master_id: int
    accused_name: str
    case_count: int
    cases: list[OffenderCaseInfo] = []
    risk_score: int

class RepeatOffendersResponse(BaseModel):
    offenders: list[RepeatOffender] = []

# ---- Forecast ----
class ForecastPoint(BaseModel):
    period: str
    predicted_count: float
    confidence_lower: float
    confidence_upper: float

class ForecastResponse(BaseModel):
    data: list[ForecastPoint] = []
    model_type: str = "regression"