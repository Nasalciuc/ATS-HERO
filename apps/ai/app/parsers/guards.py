"""Upload safety checks for /extract (magic bytes, zip-bomb, page cap)."""
from __future__ import annotations

import io
import zipfile

PDF_MAGIC = b"%PDF-"
DOCX_MAGIC = b"PK\x03\x04"
MAX_DOCX_ENTRIES = 500
MAX_DOCX_UNCOMPRESSED = 50 * 1024 * 1024  # 50 MB
MAX_PDF_PAGES = 100


def assert_pdf_magic(data: bytes) -> None:
    if not data.startswith(PDF_MAGIC):
        raise ValueError("File does not look like a PDF (bad magic bytes)")


def assert_docx_magic(data: bytes) -> None:
    if not data.startswith(DOCX_MAGIC):
        raise ValueError("File does not look like a DOCX (bad magic bytes)")


def assert_safe_docx_zip(data: bytes) -> None:
    """Reject zip bombs / pathological DOCX archives before parsing."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            infos = zf.infolist()
            if len(infos) > MAX_DOCX_ENTRIES:
                raise ValueError(
                    f"DOCX has too many entries ({len(infos)} > {MAX_DOCX_ENTRIES})"
                )
            total = sum(info.file_size for info in infos)
            if total > MAX_DOCX_UNCOMPRESSED:
                raise ValueError(
                    f"DOCX decompresses too large ({total} > {MAX_DOCX_UNCOMPRESSED} bytes)"
                )
    except zipfile.BadZipFile as exc:
        raise ValueError("Invalid DOCX (not a valid ZIP archive)") from exc


def assert_pdf_page_cap(page_count: int) -> None:
    if page_count > MAX_PDF_PAGES:
        raise ValueError(f"PDF exceeds {MAX_PDF_PAGES} page limit ({page_count} pages)")
