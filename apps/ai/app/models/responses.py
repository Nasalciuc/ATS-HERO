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


class ParseCheckRecommendation(BaseModel):
    code: str                   # contact | jobs | columns | unicode | skills | linkedin | ligatures
    severity: str               # high | medium | low
    message: str


class ParseCheckResponse(BaseModel):
    """What ATS-style readers recovered from one CV file (the ATS lab, single file)."""

    format: str                 # pdf | docx
    summary: dict               # verdict, scores or reader disagreements
    readers: list[dict]         # per extraction engine: fields read (+ verdict/score/problems with truth)
    recommendations: list[ParseCheckRecommendation] = []


class JobPosting(BaseModel):
    """One posting as JobSpy returns it (its column names), without the e-mails it collects."""

    site: str | None = None
    title: str | None = None
    company: str | None = None
    location: str | None = None
    date_posted: str | None = None  # ISO date
    job_type: str | None = None
    is_remote: bool | None = None
    interval: str | None = None  # yearly, monthly, weekly, daily, hourly
    min_amount: float | None = None
    max_amount: float | None = None
    currency: str | None = None
    salary_source: str | None = None
    job_url: str | None = None
    job_url_direct: str | None = None
    description: str | None = None  # markdown from a third party: show it as text, never as HTML
    company_url: str | None = None
    company_logo: str | None = None
    company_industry: str | None = None
    job_level: str | None = None


class JobSearchResponse(BaseModel):
    count: int
    by_site: dict[str, int]          # postings per board searched (0 when a board found none or failed)
    errors: dict[str, str] = {}      # board → why it failed (blocked, changed, a location it doesn't know)
    jobs: list[JobPosting]

