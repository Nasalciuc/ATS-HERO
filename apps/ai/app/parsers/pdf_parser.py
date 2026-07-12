"""PDF → text via PyMuPDF."""
import fitz  # PyMuPDF

from .guards import assert_pdf_page_cap


def extract_pdf(data: bytes) -> tuple[str, int]:
    """Return (text, page_count) from PDF bytes. Raises ValueError on bad input."""
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Could not open PDF: {exc}") from exc
    try:
        assert_pdf_page_cap(doc.page_count)
        text = "\n".join(page.get_text() for page in doc)
        return text, doc.page_count
    finally:
        doc.close()
