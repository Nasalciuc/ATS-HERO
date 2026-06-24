"""ATS Hero — Tier 2 AI service.

FastAPI app exposing:
  POST /extract  — DOCX/PDF text extraction (PyMuPDF)
  POST /score    — deterministic + spaCy NLP ATS scoring
  GET  /health   — liveness + which NLP backend is active
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .analyzers.nlp_engine import get_engine
from .config import settings
from .routers import analyze, parse

app = FastAPI(title="ATS Hero AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse.router, tags=["parse"])
app.include_router(analyze.router, tags=["score"])


@app.get("/health")
def health() -> dict:
    engine = get_engine()
    return {
        "status": "ok",
        "nlp_model": engine.label,
        "model_loaded": engine.model_loaded,
    }
