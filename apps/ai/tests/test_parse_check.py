"""POST /parse-check — the ATS lab on one file, through the API."""
import json
from pathlib import Path

import pymupdf
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
LAB = Path(__file__).resolve().parents[3] / "tools" / "ats-lab"
TRUTH = {
    "personalInfo": {"name": "Ana Popescu", "email": "ana.popescu@example.com", "phone": "+40 721 000 111",
                     "linkedin": "", "cityState": "Cluj-Napoca", "country": "Romania"},
    "summary": {"valueProposition": "Frontend engineer building React products."},
    "work": [{"role": "Frontend Engineer", "company": "Fintech Labs SRL", "description": "Led a migration.",
              "startDate": "September 2021", "endDate": "", "current": True}],
    "education": [], "skills": ["React", "TypeScript"], "instruments": [], "softSkills": [], "languages": [],
}


def _single_column_pdf() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    lines = ["Ana Popescu", "ana.popescu@example.com  +40 721 000 111  Cluj-Napoca, Romania", "SUMMARY",
             "Frontend engineer building React products.", "SKILLS", "Hard skills: React, TypeScript",
             "EXPERIENCE", "Frontend Engineer", "Fintech Labs SRL", "September 2021 - Present", "Led a migration."]
    for i, line in enumerate(lines):
        page.insert_text((50, 60 + 16 * i), line, fontsize=10)
    return doc.tobytes()


def _post(data: bytes, name: str, truth: dict | None = None):
    files = {"file": (name, data, "application/pdf" if name.endswith(".pdf") else
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    form = {"truth": json.dumps(truth)} if truth is not None else {}
    return client.post("/parse-check", files=files, data=form)


def test_clean_single_column_pdf_passes_every_reader():
    r = _post(_single_column_pdf(), "cv.pdf", TRUTH)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["summary"]["verdict"] == "PASS", body
    assert body["summary"]["readers_passing"] == body["summary"]["readers_total"] == 4  # pymupdf, pdfminer, pypdf, pdfplumber
    assert body["recommendations"] == []


def test_without_truth_reports_what_was_read():
    body = _post(_single_column_pdf(), "cv.pdf").json()
    assert body["summary"]["verdict"] == "PASS"
    assert {r["email"] for r in body["readers"]} == {"ana.popescu@example.com"}
    assert all(len(r["jobs"]) == 1 for r in body["readers"])


def test_lost_email_is_reported_with_advice():
    truth = {**TRUTH, "personalInfo": {**TRUTH["personalInfo"], "email": "someone.else@example.com"}}
    body = _post(_single_column_pdf(), "cv.pdf", truth).json()
    assert body["summary"]["verdict"] == "FAIL"
    assert "contact" in [a["code"] for a in body["recommendations"]]


@pytest.mark.parametrize("payload,status", [
    (b"not a pdf at all", 415),
    (b"", 400),
])
def test_rejects_bad_files(payload, status):
    assert _post(payload, "cv.pdf").status_code == status


def test_rejects_bad_truth():
    files = {"file": ("cv.pdf", _single_column_pdf(), "application/pdf")}
    assert client.post("/parse-check", files=files, data={"truth": "{not json"}).status_code == 422
    assert client.post("/parse-check", files=files, data={"truth": "[1,2]"}).status_code == 422


lab_files = pytest.mark.skipif(not (LAB / "out" / "files" / "mihai--modern.pdf").exists(),
                               reason="run apps/web/lab/render.tsx first")


@lab_files
def test_two_column_template_is_flagged_even_without_truth():
    body = _post((LAB / "out" / "files" / "mihai--modern.pdf").read_bytes(), "cv.pdf").json()
    assert body["summary"]["verdict"] == "WARN"
    assert body["summary"]["disagreements"]


@lab_files
def test_word_export_passes_with_truth():
    truth = json.loads((LAB / "fixtures" / "personas.json").read_text(encoding="utf-8"))["mihai"]
    body = _post((LAB / "out" / "files" / "mihai--docx.docx").read_bytes(), "cv.docx", truth).json()
    assert body["summary"]["verdict"] == "PASS", body["readers"]
