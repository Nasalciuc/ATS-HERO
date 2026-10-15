"""Request schemas for the Tier 2 AI service."""
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ScoreRequest(BaseModel):
    """Raw CV text to analyze for ATS readiness."""

    text: str = Field(..., min_length=1, description="Plain CV text to score")


class JobFitRequest(BaseModel):
    """CV text + a job description to compute keyword overlap ('mirror the JD')."""

    cv_text: str = Field(..., min_length=1)
    job_text: str = Field(..., min_length=1)


class RegionSignals(BaseModel):
    """Signals about a CV. Booleans left as None mean 'unknown' (not flagged).

    has_photo / page_count come from the format analyzer; the rest can be derived
    from CV text or supplied explicitly.
    """

    has_photo: bool | None = None
    has_personal_data: bool | None = None   # date of birth / marital status / nationality
    page_count: int | None = None
    has_references: bool | None = None
    has_gdpr_clause: bool | None = None
    languages: list[str] = []


class RegionRequest(BaseModel):
    """Check a CV against a TARGET country's norms (global rules engine)."""

    target: str = Field(..., min_length=2, description="ISO-ish country code, e.g. 'US', 'DE'")
    cv_text: str | None = Field(default=None, description="Optional; text-derivable signals are extracted from it")
    signals: RegionSignals = RegionSignals()


class JobSearchRequest(BaseModel):
    """A job search on the boards JobSpy reaches, LinkedIn excepted (app/jobs/search.py)."""

    search_term: str = Field(..., min_length=2, max_length=100, description="What the job is, e.g. 'data analyst'")
    location: str | None = Field(default=None, max_length=100, description="City or region, e.g. 'Bucharest'")
    sites: list[str] = Field(default=["indeed"], min_length=1, max_length=4,
                             description="indeed, glassdoor, google, zip_recruiter, bayt, naukri, bdjobs, hellowork")
    country: str = Field(default="usa", min_length=2, max_length=40,
                         description="Indeed and Glassdoor country, as JobSpy names it, e.g. 'romania', 'nigeria', 'uk'")
    results_wanted: int = Field(default=20, ge=1, le=50, description="Postings per board")
    hours_old: int | None = Field(default=None, ge=1, le=720, description="Only postings this many hours old or newer")
    is_remote: bool = False
    job_type: Literal["fulltime", "parttime", "contract", "temporary", "internship"] | None = None

    @field_validator("sites")
    @classmethod
    def _known_sites(cls, value: list[str]) -> list[str]:
        from ..jobs.search import check_sites  # LinkedIn and unknown boards are refused there

        return list(check_sites(value))

