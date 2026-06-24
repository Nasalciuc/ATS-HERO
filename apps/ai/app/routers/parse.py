"""POST /extract — pull plain text out of an uploaded DOCX or PDF."""
from fastapi import APIRouter, File, HTTPException, UploadFile

from ..config import settings
from ..models.responses import ExtractResponse
from ..parsers.docx_parser import extract_docx
from ..parsers.pdf_parser import extract_pdf
from ..parsers.text_cleaner import clean_text

router = APIRouter()

_DOCX = "docx"
_PDF = "pdf"


def _detect_format(filename: str, content_type: str | None) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    ct = (content_type or "").lower()
    if ext == _DOCX or "word" in ct or "officedocument.wordprocessing" in ct:
        return _DOCX
    if ext == _PDF or ct == "application/pdf":
        return _PDF
    return ""


@router.post("/extract", response_model=ExtractResponse)
async def extract(file: UploadFile = File(...)) -> ExtractResponse:
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
        text, pages = extract_docx(data) if fmt == _DOCX else extract_pdf(data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    text = clean_text(text)
    return ExtractResponse(
        text=text,
        char_count=len(text),
        word_count=len(text.split()),
        page_count=pages,
        format=fmt,
        filename=name,
    )
