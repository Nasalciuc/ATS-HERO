"""POST /jobs/search — postings from job boards through JobSpy, LinkedIn never (app/jobs/search.py)."""
import asyncio

from fastapi import APIRouter, HTTPException, Request

from ..jobs.search import JobQuery, SearchFailed, SearchTimeout, search_jobs
from ..models.requests import JobSearchRequest
from ..models.responses import JobSearchResponse
from .parse import limiter

router = APIRouter()


@router.post("/jobs/search", response_model=JobSearchResponse)
@limiter.limit("6/minute")  # each search sends several requests to the boards
async def jobs_search(request: Request, req: JobSearchRequest) -> JobSearchResponse:
    query = JobQuery(
        search_term=req.search_term,
        location=req.location,
        sites=tuple(req.sites),
        country=req.country,
        results_wanted=req.results_wanted,
        hours_old=req.hours_old,
        is_remote=req.is_remote,
        job_type=req.job_type,
    )
    try:
        result = await asyncio.to_thread(search_jobs, query)
    except SearchTimeout as e:
        raise HTTPException(status_code=504, detail=str(e)) from None
    except SearchFailed as e:  # JobSpy broke, or the search's process died
        raise HTTPException(status_code=502, detail=str(e)) from None
    except ValueError as e:  # JobSpy refused an argument, e.g. an unknown country
        raise HTTPException(status_code=422, detail=str(e)) from None
    return JobSearchResponse(**result)
