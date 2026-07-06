from fastapi import APIRouter, HTTPException, Depends, Query
from app.models.analytics import NetworkGraph
from app.services.network_service import NetworkService
from app.core.security import get_current_user
from app.core.permissions import can_access

router = APIRouter()

@router.get("/accused/{accused_id}", response_model=NetworkGraph)
async def get_accused_network(
    accused_id: int,
    degrees: int = Query(2, ge=1, le=3),
    current_user: dict = Depends(get_current_user)
):
    """Retrieve co-accused connection network for a given accused ID."""
    if not can_access(current_user["role"], "network:read"):
        raise HTTPException(status_code=403, detail="Permission denied")
        
    return NetworkService.get_accused_network(accused_id, degrees)

@router.get("/clusters")
async def get_clusters(
    min_cluster_size: int = Query(3, ge=2),
    current_user: dict = Depends(get_current_user)
):
    """Retrieve community clusters of repeat offenders."""
    if not can_access(current_user["role"], "network:read"):
        raise HTTPException(status_code=403, detail="Permission denied")
        
    return NetworkService.get_clusters(min_cluster_size)