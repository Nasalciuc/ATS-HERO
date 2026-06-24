"""Response schemas for the Tier 2 AI service."""
from pydantic import BaseModel


class Signal(BaseModel):
    """One weighted scoring dimension."""

    key: str
    label: str
    score: float        # 0-100
    weight: float       # contribution to the overall score (weights sum to 1.0)
    detail: str


class Detected(BaseModel):
    """Structured facts pulled out of the CV text."""

    emails: list[str] = []
    phones: list[str] = []
    links: list[str] = []
    skills: list[str] = []
    action_verbs: list[str] = []
    organizations: list[str] = []   # NER — populated only when the trained model is loaded
    dates: list[str] = []           # NER — populated only when the trained model is loaded


class ScoreMeta(BaseModel):
    word_count: int
    sentence_count: int
    nlp_model: str          # "en_core_web_sm" or "blank(en)+heuristics"
    model_loaded: bool


class ScoreResponse(BaseModel):
    overall_score: float            # 0-100
    signals: list[Signal]
    detected: Detected
    suggestions: list[str]
    meta: ScoreMeta


class ExtractResponse(BaseModel):
    text: str
    char_count: int
    word_count: int
    page_count: int
    format: str                     # "docx" | "pdf"
    filename: str
