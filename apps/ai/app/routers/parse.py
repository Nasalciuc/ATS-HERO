"""POST /extract — pull plain text out of an uploaded DOCX or PDF."""
import asyncio
from typing import Optional, Tuple

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..config import settings
from ..models.responses import ExtractResponse
from ..parsers.docx_parser import extract_docx
from ..parsers.guards import assert_docx_magic, assert_pdf_magic, assert_safe_docx_zip
from ..parsers.pdf_parser import extract_pdf
from ..parsers.text_cleaner import clean_text

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

_DOCX = "docx"
_PDF = "pdf"
_PARSE_TIMEOUT_S = 20.0


def _detect_format(filename: str, content_type: Optional[str]) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    ct = (content_type or "").lower()
    if ext == _DOCX or "word" in ct or "officedocument.wordprocessing" in ct:
        return _DOCX
    if ext == _PDF or ct == "application/pdf":
        return _PDF
    return ""


def _parse_bytes(data: bytes, fmt: str) -> Tuple[str, int]:
    if fmt == _DOCX:
        return extract_docx(data)
    return extract_pdf(data)


def _http_for_guard(exc: ValueError) -> HTTPException:
    msg = str(exc)
    lower = msg.lower()
    if "magic" in lower or "not a valid zip" in lower or "does not look like" in lower:
        return HTTPException(status_code=415, detail=msg)
    if "too many entries" in lower or "decompresses too large" in lower or "page limit" in lower:
        return HTTPException(status_code=413, detail=msg)
    return HTTPException(status_code=422, detail=msg)


@router.post("/extract", response_model=ExtractResponse)
@limiter.limit("10/minute")
async def extract(request: Request, file: UploadFile = File(...)) -> ExtractResponse:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File too large")

    name = file.filename or "upload"
    fmt = _detect_format(name, file.content_type)
    if not fmt:
        raise HTTPException(status_code=415, detail="Unsupported file type — use DOCX or PDF")

    try:
        if fmt == _PDF:
            assert_pdf_magic(data)
        else:
            assert_docx_magic(data)
            assert_safe_docx_zip(data)
    except ValueError as exc:
        raise _http_for_guard(exc) from exc

    try:
        text, pages = await asyncio.wait_for(
            asyncio.to_thread(_parse_bytes, data, fmt),
            timeout=_PARSE_TIMEOUT_S,
        )
    except asyncio.TimeoutError as exc:
        raise HTTPException(status_code=408, detail="Parse timed out after 20s") from exc
    except ValueError as exc:
        raise _http_for_guard(exc) from exc

    text = clean_text(text)
    return ExtractResponse(
        text=text,
        char_count=len(text),
        word_count=len(text.split()),
        page_count=pages,
        format=fmt,
        filename=name,
    )
