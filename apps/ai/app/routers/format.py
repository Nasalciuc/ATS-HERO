"""POST /format — parseability analysis of an uploaded DOCX/PDF (file structure)."""
from fastapi import APIRouter, File, HTTPException, UploadFile

from ..analyzers.format_analyzer import analyze_format
from ..config import settings
from ..models.responses import FormatResponse

router = APIRouter()


@router.post("/format", response_model=FormatResponse)
async def format_check(file: UploadFile = File(...)) -> FormatResponse:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File too large")
    try:
        return analyze_format(data, file.filename or "upload", file.content_type)
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"Could not analyze file: {exc}") from exc
