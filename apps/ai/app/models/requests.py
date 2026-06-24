"""Request schemas for the Tier 2 AI service."""
from pydantic import BaseModel, Field


class ScoreRequest(BaseModel):
    """Raw CV text to analyze for ATS readiness."""

    text: str = Field(..., min_length=1, description="Plain CV text to score")
