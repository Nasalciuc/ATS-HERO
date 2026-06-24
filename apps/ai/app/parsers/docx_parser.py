"""DOCX → text via PyMuPDF (MuPDF document handling)."""
import fitz  # PyMuPDF


def extract_docx(data: bytes) -> tuple[str, int]:
    """Return (text, page_count) from DOCX bytes. Raises ValueError on bad input."""
    try:
        doc = fitz.open(stream=data, filetype="docx")
    except Exception as exc:  # noqa: BLE001 - surface as a clean 4xx upstream
        raise ValueError(f"Could not open DOCX: {exc}") from exc
    try:
        text = "\n".join(page.get_text() for page in doc)
        return text, doc.page_count
    finally:
        doc.close()
