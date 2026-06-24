"""POST /region — region-fit check against a target country's norms (global)."""
from fastapi import APIRouter

from ..analyzers.region_checker import check_region
from ..models.requests import RegionRequest
from ..models.responses import RegionResponse

router = APIRouter()


@router.post("/region", response_model=RegionResponse)
async def region(req: RegionRequest) -> RegionResponse:
    return check_region(req.target, req.signals, req.cv_text)
