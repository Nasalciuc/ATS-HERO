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
