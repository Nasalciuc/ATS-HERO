# ATS Hero — AI service (Tier 2)

FastAPI + spaCy + PyMuPDF. The deterministic-NLP layer of ATS Hero. Lives at `apps/ai`
in the monorepo.

## Endpoints

| Method | Path       | Purpose |
|--------|------------|---------|
| `POST` | `/score`   | ATS scoring of CV text — 5 weighted signals + detected facts + suggestions |
| `POST` | `/extract` | DOCX/PDF → plain text (PyMuPDF) |
| `GET`  | `/health`  | Liveness + which NLP backend is active |

### `POST /score`
Request: `{ "text": "<plain CV text>" }`
Response (abridged):
```json
{
  "overall_score": 99.2,
  "signals": [
    {"key": "contactability", "label": "Contactability", "score": 100.0, "weight": 0.2, "detail": "..."},
    {"key": "action_verbs", "...": "..."},
    {"key": "quantified_impact", "...": "..."},
    {"key": "skills", "...": "..."},
    {"key": "structure", "...": "..."}
  ],
  "detected": {
    "emails": ["..."], "phones": ["..."], "links": ["..."],
    "skills": ["Go", "C#", "ML", "..."], "action_verbs": ["Led", "..."],
    "organizations": [], "dates": []
  },
  "suggestions": ["..."],
  "meta": {"word_count": 0, "sentence_count": 0, "nlp_model": "en_core_web_sm", "model_loaded": true}
}
```
The five signals are equally weighted (0.20 each). `contactability`, `quantified_impact`,
`skills` and `structure` are deterministic (regex + spaCy lexical attributes).
`action_verbs` uses spaCy POS+lemma when the trained model is loaded, and a rule-based
inflected-form match otherwise.

### `POST /extract`
`multipart/form-data` with a `file` field (DOCX or PDF). Returns extracted text plus
`char_count`, `word_count`, `page_count`, `format`, `filename`.
Errors: `400` empty, `413` too large (>5 MB), `415` unsupported type, `422` parse failure.

## Run locally
```bash
cd apps/ai
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python -m spacy download en_core_web_sm   # see note below
uvicorn app.main:app --reload --port 8000
```
Docs at `http://localhost:8000/docs`.

## The spaCy model (important)
The trained model `en_core_web_sm` is **not on PyPI** — it ships as a GitHub release wheel.
Install it one of two ways:
```bash
python -m spacy download en_core_web_sm
# or pin it in requirements via its wheel URL:
#   en-core-web-sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl
```
**The service runs without it** — `NlpEngine` falls back to a blank English pipeline with
a rule-based sentencizer and heuristic action-verb matching (`/health` reports
`model_loaded: false`). Scores stay stable across both modes; the model adds
POS-accurate action verbs, NER (organizations/dates) and noun-chunk skill phrases.

> The bundled test suite runs in fallback mode (no network for the model download).
> Install the model in any environment where you want the full NLP path exercised.

## Tests
```bash
cd apps/ai
pip install -r requirements-dev.txt
pytest            # 18 tests; fixtures generate DOCX/PDF at runtime
```

## Deployment (DigitalOcean)
Target: DigitalOcean App Platform (Student Pack credit).

The project architecture is "no Docker". On App Platform's Python buildpack, set the
**build command** to install deps *and* fetch the model:
```bash
pip install -r apps/ai/requirements.txt && python -m spacy download en_core_web_sm
```
**Run command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

> ⚠️ Revisit decision: spaCy models are noticeably simpler to pin and cache in a Docker
> image than on a buildpack (no per-deploy download, reproducible). If buildpack model
> fetching proves flaky, this one service is a reasonable exception to the no-Docker rule.
> Flagged, not decided.

Configure via env (Doppler), all `ATS_AI_`-prefixed — see `.env.example`. Set
`ATS_AI_CORS_ORIGINS` to the deployed Next.js origin.

## How it integrates
This service has **no consumer yet**. Once the Convex foundation runs, Convex actions
call `/extract` (DOCX upload → text) and `/score` (text → ATS report); results are
persisted in the `scans` table. Until then it runs standalone — the contract above is
the integration surface.

## Layout
```
apps/ai/
  app/
    main.py                 # FastAPI app, CORS, /health
    config.py               # settings (pydantic-settings, ATS_AI_ prefix)
    models/                 # request/response schemas
    analyzers/
      nlp_engine.py         # spaCy load-or-fallback singleton
      ats_scorer.py         # 5-signal deterministic + NLP scorer
      keyword_extractor.py  # tech-skill dictionary (handles Go/C#/ML/R)
    parsers/
      docx_parser.py        # PyMuPDF DOCX → text
      pdf_parser.py         # PyMuPDF PDF → text
      text_cleaner.py       # whitespace normalization
    routers/
      parse.py              # POST /extract
      analyze.py            # POST /score
  tests/                    # 18 tests (extract / scoring / api)
  requirements.txt, requirements-dev.txt, pyproject.toml, .env.example
```
