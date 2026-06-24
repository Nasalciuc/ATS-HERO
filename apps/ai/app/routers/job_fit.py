"""POST /job-fit — keyword overlap between a CV and a job description."""
from fastapi import APIRouter

from ..analyzers.job_matcher import match_job
from ..models.requests import JobFitRequest
from ..models.responses import JobFitResponse

router = APIRouter()


@router.post("/job-fit", response_model=JobFitResponse)
async def job_fit(req: JobFitRequest) -> JobFitResponse:
    return match_job(req.cv_text, req.job_text)
