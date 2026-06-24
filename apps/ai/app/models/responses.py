"""Response schemas for the Tier 2 AI service."""
from pydantic import BaseModel


class Signal(BaseModel):
    key: str
    label: str
    score: float        # 0-100
    weight: float       # weights sum to 1.0
    detail: str


class Finding(BaseModel):
    """One actionable, per-item issue (the WEAK->STRONG material for Tier 3)."""

    type: str           # weak_phrase | cliche | nonstandard_heading | missing_section | ...
    severity: str       # high | medium | low
    text: str           # the offending phrase / item
    why: str
    suggestion: str
    line: int | None = None


class Detected(BaseModel):
    emails: list[str] = []
    phones: list[str] = []
    links: list[str] = []
    skills: list[str] = []
    action_verbs: list[str] = []
    organizations: list[str] = []
    dates: list[str] = []


class ScoreMeta(BaseModel):
    word_count: int
    sentence_count: int
    nlp_model: str
    model_loaded: bool


class ScoreResponse(BaseModel):
    overall_score: float
    signals: list[Signal]
    detected: Detected
    findings: list[Finding] = []
    suggestions: list[str]
    meta: ScoreMeta


class ExtractResponse(BaseModel):
    text: str
    char_count: int
    word_count: int
    page_count: int
    format: str
    filename: str


class JobFitResponse(BaseModel):
    """'Mirror the JD' — keyword overlap between a CV and a job description."""

    match_score: float          # 0-100, share of required keywords matched
    matched: list[str] = []
    missing: list[str] = []
    suggestions: list[str] = []


class FormatResponse(BaseModel):
    """Parseability analysis from the file structure (not the extracted text)."""

    format: str                 # docx | pdf
    ats_safe: bool
    page_count: int
    warnings: list[Finding] = []
    details: dict = {}


class RegionDeviation(BaseModel):
    field: str                  # photo | personal_data | length | gdpr_clause | ...
    severity: str               # high | medium | low
    message: str


class RegionResponse(BaseModel):
    """Region-fit: deviations of a CV from a TARGET country's norms (global)."""

    target: str                 # country code, e.g. "US"
    profile_label: str
    deviations: list[RegionDeviation] = []
