"""AWS Lambda entry point for apps/ai: the same FastAPI app, adapted by Mangum.

API Gateway (HTTP API, payload v2) -> Lambda -> Mangum -> FastAPI. Nothing else changes:
Dockerfile + uvicorn keep working locally and anywhere else a container runs.
"""
from mangum import Mangum

from .analyzers.nlp_engine import get_engine
from .main import app
from .rate_limit import PerUserLimit

# Load spaCy during the init phase (or into the SnapStart snapshot), not on the first request.
get_engine()

# The per-user limit wraps only the Lambda entry point; local uvicorn runs keep slowapi alone.
handler = Mangum(PerUserLimit(app), lifespan="off")
