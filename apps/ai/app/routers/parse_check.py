"""POST /parse-check — "what does an ATS read from this CV?" (the ATS lab, on one file).

multipart/form-data:
  file   — the PDF or DOCX exactly as the user will upload it
  truth  — optional JSON CvData (CV built in ATS Hero): enables field-by-field scoring
Stateless: the file is parsed in memory and never stored.
"""
import asyncio
import json
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from ..config import settings
from ..lab.check import check
from ..models.responses import ParseCheckResponse
from ..parsers.guards import assert_docx_magic, assert_pdf_magic, assert_safe_docx_zip
from .parse import _detect_format, _http_for_guard, limiter

router = APIRouter()
_TIMEOUT_S = 20.0


@router.post("/parse-check", response_model=ParseCheckResponse)
@limiter.limit("10/minute")
async def parse_check(
    request: Request,
    file: UploadFile = File(...),
    truth: Optional[str] = Form(default=None),
) -> ParseCheckResponse:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File too large")
    fmt = _detect_format(file.filename or "upload", file.content_type)
    if not fmt:
        raise HTTPException(status_code=415, detail="Unsupported file type — use DOCX or PDF")
    try:
        if fmt == "pdf":
            assert_pdf_magic(data)
        else:
            assert_docx_magic(data)
            assert_safe_docx_zip(data)
    except ValueError as exc:
        raise _http_for_guard(exc) from exc

    truth_obj = None
    if truth:
        if len(truth) > 200_000:
            raise HTTPException(status_code=413, detail="truth too large")
        try:
            truth_obj = json.loads(truth)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail="truth must be CvData JSON") from exc
        if not isinstance(truth_obj, dict):
            raise HTTPException(status_code=422, detail="truth must be a JSON object")

    try:
        result = await asyncio.wait_for(asyncio.to_thread(check, data, fmt, truth_obj), timeout=_TIMEOUT_S)
    except asyncio.TimeoutError as exc:
        raise HTTPException(status_code=408, detail="Check timed out after 20s") from exc
    return ParseCheckResponse(**result)
