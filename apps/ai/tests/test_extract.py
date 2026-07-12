"""Extraction tests (PyMuPDF)."""
import pytest

from app.parsers.docx_parser import extract_docx
from app.parsers.pdf_parser import extract_pdf
from app.parsers.text_cleaner import clean_text


def test_extract_docx(sample_docx_bytes):
    text, pages = extract_docx(sample_docx_bytes)
    assert pages >= 1
    assert "Jane Developer" in text
    # Short, symbol-bearing skills survive extraction.
    assert "Go" in text and "C#" in text


def test_extract_pdf(sample_pdf_bytes):
    text, pages = extract_pdf(sample_pdf_bytes)
    assert pages == 1
    assert "AWS" in text


def test_extract_docx_rejects_garbage():
    with pytest.raises(ValueError):
        extract_docx(b"this is not a docx file")


def test_clean_text_collapses_whitespace():
    assert clean_text("a   b\n\n\n\nc  \n   ") == "a b\n\nc"


def test_guards_reject_bad_magic():
    from app.parsers.guards import assert_docx_magic, assert_pdf_magic, assert_safe_docx_zip

    with pytest.raises(ValueError, match="PDF"):
        assert_pdf_magic(b"XXXX")
    with pytest.raises(ValueError, match="DOCX"):
        assert_docx_magic(b"XXXX")
    with pytest.raises(ValueError, match="ZIP"):
        assert_safe_docx_zip(b"PK\x03\x04" + b"not-a-real-zip")
