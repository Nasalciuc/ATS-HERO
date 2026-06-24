"""POST /score — deterministic + NLP ATS scoring of CV text."""
from fastapi import APIRouter

from ..analyzers.ats_scorer import score_text
from ..analyzers.nlp_engine import get_engine
from ..models.requests import ScoreRequest
from ..models.responses import ScoreResponse

router = APIRouter()


@router.post("/score", response_model=ScoreResponse)
async def score(req: ScoreRequest) -> ScoreResponse:
    return score_text(req.text, get_engine())
