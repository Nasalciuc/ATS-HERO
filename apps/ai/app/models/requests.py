"""Request schemas for the Tier 2 AI service."""
from pydantic import BaseModel, Field


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
