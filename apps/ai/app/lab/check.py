"""In-product ATS read check — the lab, on one file, in ~a few hundred ms.

Runs a FAST in-process panel (four different extraction engines, no external binaries, so it
works on any deploy image), parses each result with the reference parser and — when the CV
was built in ATS Hero and its CvData is sent along — scores every field against the truth.
Without truth (an uploaded CV) it reports what was read and whether the readers AGREE:
disagreement between engines is the signature of reading-order problems.
"""
from __future__ import annotations

import io
from dataclasses import asdict
from typing import Callable

from .parser import Parsed, parse
from .scorer import Score, score

# ------------------------------------------------------------------ fast panels (bytes in)


def _pdf_pymupdf(data: bytes) -> str:
    import pymupdf

    with pymupdf.open(stream=data, filetype="pdf") as doc:
        return "\n".join(page.get_text() for page in doc)


def _pdf_pdfminer(data: bytes) -> str:
    from pdfminer.high_level import extract_text

    return extract_text(io.BytesIO(data))


def _pdf_pypdf(data: bytes) -> str:
    from pypdf import PdfReader

    return "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages)


def _pdf_pdfplumber(data: bytes) -> str:
    # Position-based assembly: the reader that exposes two-column mixing (lab: Modern).
    import pdfplumber

    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return "\n".join((p.extract_text() or "") for p in pdf.pages)


def _docx_python_docx(data: bytes) -> str:
    import docx

    d = docx.Document(io.BytesIO(data))
    return "\n".join([p.text for p in d.paragraphs]
                     + ["\t".join(c.text for c in row.cells) for t in d.tables for row in t.rows])


def _docx_docx2txt(data: bytes) -> str:
    import docx2txt

    return docx2txt.process(io.BytesIO(data))


def _docx_pymupdf(data: bytes) -> str:
    import pymupdf

    with pymupdf.open(stream=data, filetype="docx") as doc:
        return "\n".join(page.get_text() for page in doc)


FAST_PDF: dict[str, Callable[[bytes], str]] = {
    "pymupdf": _pdf_pymupdf, "pdfminer": _pdf_pdfminer, "pypdf": _pdf_pypdf, "pdfplumber": _pdf_pdfplumber,
}
FAST_DOCX: dict[str, Callable[[bytes], str]] = {
    "python-docx": _docx_python_docx, "docx2txt": _docx_docx2txt, "pymupdf": _docx_pymupdf,
}

# ------------------------------------------------------------------------- truth shape


def _with_defaults(truth: dict) -> dict:
    """Accept partial CvData from the client; the scorer needs every key present."""
    pi = {"name": "", "email": "", "phone": "", "linkedin": "", "website": "", "country": "", "cityState": "",
          **(truth.get("personalInfo") or {})}
    out = {"personalInfo": pi, "summary": {"position": "", "valueProposition": "", **(truth.get("summary") or {})}}
    for key in ("work", "education", "skills", "instruments", "softSkills", "languages",
                "awards", "certifications", "publications", "volunteering", "activities"):
        out[key] = list(truth.get(key) or [])
    return out


# ----------------------------------------------------------------------- recommendations

ADVICE = {
    "contact": ("high", "Some ATS readers can't find your contact details in this layout. "
                        "Use Classic or Minimal, or download Word for online portals."),
    "jobs": ("high", "Some ATS readers can't attach dates to each role, so your experience "
                     "timeline is read wrongly. The Word export keeps the dates with every role."),
    "columns": ("high", "Two-column layout: some ATS readers mix the columns (name, section titles, "
                        "skills). Keep this design for emailing a recruiter; use Classic or Word for portals."),
    "unicode": ("medium", "Letters like ș, ț, ă are not extracted correctly, so searches for your name or "
                          "city can miss you. Export from ATS Hero (Unicode font) instead of this file."),
    "skills": ("medium", "Some skills are not readable as plain text, so recruiter keyword search won't "
                         "find them. Write each skill as normal text, not in images or icons."),
    "linkedin": ("low", "Your LinkedIn URL is not read in full. Set a short custom URL on LinkedIn "
                        "(linkedin.com/in/yourname) — it fits every layout."),
    "ligatures": ("low", "The file uses typographic ligatures (ﬁ, ﬂ) that break keyword search "
                         "(\"ﬁnance\" ≠ \"finance\"). Re-export without ligatures."),
}


def _advice_for(per: dict[str, Score], parsed: dict[str, Parsed]) -> list[dict]:
    codes: list[str] = []

    def want(code: str) -> None:
        if code not in codes:
            codes.append(code)

    for sc in per.values():
        c = sc.checks
        if c.get("email", 1) < 1 or c.get("phone", 1) < 1 or c.get("name", 1) < 1:
            want("contact")
        if c.get("experience", 1) < 1:
            want("jobs")
        if c.get("headings", 1) < 1:
            want("columns")
        if c.get("unicode", 1) < 1:
            want("unicode")
        if c.get("skills_text", 1) < 0.95:
            want("skills")
        if c.get("linkedin", 1) < 1:
            want("linkedin")
    if any(p.ligatures for p in parsed.values()):
        want("ligatures")
    return [{"code": k, "severity": ADVICE[k][0], "message": ADVICE[k][1]} for k in codes]


def _agreement(parsed: dict[str, Parsed]) -> list[str]:
    """Without ground truth: engines disagreeing is the tell-tale of reading-order trouble."""
    issues: list[str] = []
    jobs = {n: len(p.experience) for n, p in parsed.items()}
    if len(set(jobs.values())) > 1:
        issues.append(f"readers disagree on the number of jobs: {jobs}")
    names = {n: p.name for n, p in parsed.items()}
    if len({v for v in names.values()}) > 1:
        issues.append(f"readers disagree on your name: {names}")
    emails = {n: (p.emails[0] if p.emails else None) for n, p in parsed.items()}
    if len(set(emails.values())) > 1:
        issues.append(f"readers disagree on your email: {emails}")
    heads = {n: tuple(k for k, _ in p.sections) for n, p in parsed.items()}
    if len(set(heads.values())) > 1:
        issues.append("readers see different section order")
    return issues


# ---------------------------------------------------------------------------- entry point


def check(data: bytes, fmt: str, truth: dict | None = None) -> dict:
    panel = FAST_PDF if fmt == "pdf" else FAST_DOCX
    texts: dict[str, str] = {}
    errors: dict[str, str] = {}
    for name, fn in panel.items():
        try:
            texts[name] = fn(data)
        except Exception as exc:  # noqa: BLE001 — a reader that crashes is a finding
            errors[name] = f"{type(exc).__name__}: {exc}"[:200]

    parsed = {n: parse(t) for n, t in texts.items()}
    readers = []
    per: dict[str, Score] = {}
    for n, p in parsed.items():
        entry = {
            "reader": n,
            "name": p.name,
            "email": p.emails[0] if p.emails else None,
            "phone": p.phones[0] if p.phones else None,
            "linkedin": p.linkedin,
            "sections": [k for k, _ in p.sections],
            "jobs": [asdict(b) | {"text": b.text[:240]} for b in p.experience],
            "education": [asdict(b) | {"text": b.text[:240]} for b in p.education],
            "skills": p.skills[:60],
        }
        if truth is not None:
            sc = score(p, _with_defaults(truth))
            per[n] = sc
            entry |= {"verdict": sc.verdict, "score": sc.total, "problems": sc.problems}
        readers.append(entry)
    for n, err in errors.items():
        readers.append({"reader": n, "verdict": "FAIL", "score": 0.0, "problems": [f"reader crashed: {err}"]})

    if truth is not None:
        verdicts = [r.get("verdict", "FAIL") for r in readers]
        overall = "FAIL" if "FAIL" in verdicts else "WARN" if "WARN" in verdicts else "PASS"
        scores = [r.get("score", 0.0) for r in readers]
        summary = {"verdict": overall, "score_min": min(scores), "score_mean": round(sum(scores) / len(scores), 1),
                   "readers_passing": verdicts.count("PASS"), "readers_total": len(verdicts)}
    else:
        disagreements = _agreement(parsed)
        summary = {"verdict": "WARN" if (disagreements or errors) else "PASS", "disagreements": disagreements,
                   "readers_total": len(readers)}

    return {"format": fmt, "summary": summary, "readers": readers,
            "recommendations": _advice_for(per, parsed) if truth is not None else []}
