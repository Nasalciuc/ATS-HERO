"""ATS Hero — Tier 2 AI service.

FastAPI app exposing the deterministic-NLP analysis layer:
  POST /extract  — DOCX/PDF text extraction (PyMuPDF)
  POST /score    — ATS scoring of CV text (signals + per-item findings)
  POST /job-fit  — CV vs job-description keyword overlap ("mirror the JD")
  POST /format   — parseability analysis from the file structure
  POST /region   — region-fit against a target country's norms (global)
  GET  /health   — liveness + which NLP backend is active

Tier 3 (AI WEAK->STRONG rewriting) lives in the Next.js app via the Vercel AI SDK.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .analyzers.nlp_engine import get_engine
from .config import settings
from .routers import analyze, format as format_router, job_fit, parse, region

app = FastAPI(title="ATS Hero AI", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse.router, tags=["parse"])
app.include_router(analyze.router, tags=["score"])
app.include_router(job_fit.router, tags=["job-fit"])
app.include_router(format_router.router, tags=["format"])
app.include_router(region.router, tags=["region"])


@app.get("/health")
def health() -> dict:
    engine = get_engine()
    return {"status": "ok", "nlp_model": engine.label, "model_loaded": engine.model_loaded}
