"""Scorer — compares what a parser recovered against the CvData ground truth.

Because ATS Hero GENERATES the CV from structured data, every field has a known true value:
this is a round-trip test (CvData → file → extractor → parser → fields), not a guess.
Weights mirror what recruiters search on: contact (they must reach you), job segmentation
(titles/companies/dates feed the profile and the ranking), skills (keyword search).
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from rapidfuzz import fuzz

from .parser import DATE_RANGE, Parsed

WEIGHTS = {"name": 7, "email": 8, "phone": 6, "linkedin": 4, "experience": 35,
           "education": 10, "skills_text": 12, "skills_list": 8, "headings": 5, "unicode": 5}


@dataclass
class Score:
    checks: dict[str, float] = field(default_factory=dict)   # 0..1 per check (None = not applicable)
    problems: list[str] = field(default_factory=list)
    total: float = 0.0
    verdict: str = "FAIL"                                     # PASS | WARN | FAIL


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", s or "")).strip().casefold()


def _digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def _filled(*vals: str | None) -> bool:
    return any((v or "").strip() for v in vals)


_MONTH_ABBR = ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec")


def _date_key(s: str) -> str:
    """'September 2021' / 'Sep 2021' / '09/2021' / '2021-09-01' → 'sep2021'; a bare year → '2021'.
    Vendors return numeric dates, so numeric months must normalise like month names."""
    s = s.lower().strip()
    year = re.search(r"(19|20)\d{2}", s)
    month = ""
    if m := re.match(r"([a-z]{3})", s):
        month = m.group(1)
    elif m := re.match(r"(0?[1-9]|1[0-2])[/.\-](?:19|20)\d{2}", s):          # 09/2021, 9.2021
        month = _MONTH_ABBR[int(m.group(1)) - 1]
    elif m := re.match(r"(?:19|20)\d{2}-(0[1-9]|1[0-2])", s):                # 2021-09(-01)
        month = _MONTH_ABBR[int(m.group(1)) - 1]
    return f"{month}{year.group(0) if year else ''}"


def _term_in(term: str, text: str) -> bool:
    # ATS search engines tokenise on whitespace, so "System design" wrapped over two lines
    # still matches — any whitespace run stands for the space in a multi-word skill.
    body = r"\s+".join(re.escape(w) for w in term.split())
    pat = rf"(?<![A-Za-z0-9+#.]){body}(?![A-Za-z0-9+#])"
    return re.search(pat, text, re.IGNORECASE) is not None


def _align(blocks, truth_items, fields: tuple[str, str], date_field: str) -> tuple[int, list[str]]:
    """Each truth item must land in its OWN block containing both identity fields + its start date."""
    used: set[int] = set()
    aligned, misses = 0, []
    for item in truth_items:
        a, b = (item.get(fields[0], ""), item.get(fields[1], ""))
        hit = None
        for i, blk in enumerate(blocks):
            if i in used:
                continue
            t = _norm(blk.text)
            ok_a = not a or fuzz.partial_ratio(_norm(a), t) >= 90
            ok_b = not b or fuzz.partial_ratio(_norm(b), t) >= 90
            ok_d = not item.get(date_field) or _date_key(item[date_field]) == _date_key(blk.start)
            if ok_a and ok_b and ok_d:
                hit = i
                break
        if hit is None:
            misses.append(f"{a or b} ({item.get(date_field, '')})")
        else:
            used.add(hit)
            aligned += 1
    return aligned, misses


def score(parsed: Parsed, truth: dict) -> Score:
    s = Score()
    pi = truth["personalInfo"]
    text = parsed.text
    work = [w for w in truth["work"] if _filled(w["role"], w["company"], w["description"])]
    edu = [e for e in truth["education"] if _filled(e["institution"], e["degree"], e["minor"], e["additional"])]
    terms = list(dict.fromkeys(truth["skills"] + truth["instruments"]))

    # ---- contact
    s.checks["name"] = float(parsed.name is not None and _norm(parsed.name) == _norm(pi["name"]))
    if not s.checks["name"]:
        s.problems.append(f"name read as {parsed.name!r}")
    s.checks["email"] = float(pi["email"].lower() in [e.lower() for e in parsed.emails])
    if not s.checks["email"]:
        s.problems.append(f"email lost (found {parsed.emails or 'nothing'})")
    s.checks["phone"] = float(_digits(pi["phone"]) in [_digits(p) for p in parsed.phones])
    if not s.checks["phone"]:
        s.problems.append("phone lost")
    if pi.get("linkedin"):
        slug = re.search(r"linkedin\.com/in/([^/?#]+)", pi["linkedin"], re.IGNORECASE)
        want = slug.group(1).lower() if slug else ""
        s.checks["linkedin"] = float(parsed.linkedin == want)
        if not s.checks["linkedin"]:
            s.problems.append(f"LinkedIn read as {parsed.linkedin!r}")

    # ---- experience / education segmentation
    if work:
        aligned, misses = _align(parsed.experience, work, ("role", "company"), "startDate")
        exact = aligned == len(work) and len(parsed.experience) == len(work)
        s.checks["experience"] = 1.0 if exact else aligned / max(len(work), len(parsed.experience), 1)
        if not exact:
            s.problems.append(f"jobs: {len(parsed.experience)} segmented / {len(work)} real"
                              + (f"; misaligned: {', '.join(misses)}" if misses else ""))
    if edu:
        aligned, misses = _align(parsed.education, edu, ("institution", "degree"), "startDate")
        s.checks["education"] = aligned / len(edu)
        if misses:
            s.problems.append(f"education misaligned: {', '.join(misses)}")

    # ---- skills: survive as searchable text, and come back as a clean list
    if terms:
        found = [t for t in terms if _term_in(t, text)]
        s.checks["skills_text"] = len(found) / len(terms)
        if len(found) < len(terms):
            s.problems.append(f"skills not searchable: {sorted(set(terms) - set(found))}")
        items = {_norm(i) for i in parsed.skills}
        listed = [t for t in terms if _norm(t) in items]
        s.checks["skills_list"] = len(listed) / len(terms)

    # ---- section headings an ATS uses to segment
    expected = {"experience"} if work else set()
    if edu:
        expected.add("education")
    if truth["summary"].get("valueProposition"):
        expected.add("summary")
    if terms or truth["softSkills"] or truth["languages"]:
        expected.add("skills")
    got = {k for k, _ in parsed.sections}
    s.checks["headings"] = len(expected & got) / len(expected) if expected else 1.0
    if expected - got:
        s.problems.append(f"headings not detected: {sorted(expected - got)}")

    # ---- Unicode survives exactly (ATS keyword search on 'Chișinău' must hit)
    uni = [v for v in [pi["name"], pi["cityState"], *[e["institution"] for e in edu], *[w["company"] for w in work]]
           if v and any(ord(c) > 127 for c in v)]
    if uni:
        flat = re.sub(r"\s+", " ", text)  # a name wrapped over two lines is still intact text
        bad = [v for v in uni if re.sub(r"\s+", " ", unicodedata.normalize("NFC", v)) not in flat]
        s.checks["unicode"] = 1 - len(bad) / len(uni)
        if bad:
            s.problems.append(f"diacritics corrupted: {bad}")
    if parsed.ligatures:
        s.problems.append(f"ligature glyphs in text: {parsed.ligatures}")

    # ---- total + verdict
    applicable = {k: v for k, v in s.checks.items() if v is not None}
    wsum = sum(WEIGHTS[k] for k in applicable)
    s.total = round(100 * sum(WEIGHTS[k] * v for k, v in applicable.items()) / wsum, 1)
    contact_ok = all(applicable.get(k, 1.0) == 1.0 for k in ("name", "email", "phone"))
    jobs_ok = applicable.get("experience", 1.0) == 1.0
    skills_ok = applicable.get("skills_text", 1.0) >= 0.95
    uni_ok = applicable.get("unicode", 1.0) == 1.0
    # Structure: section headings recognised and skills recovered as a list. Text that survives
    # but lands in the wrong place (two-column layouts) is a WARN, not a PASS.
    structure_ok = applicable.get("headings", 1.0) == 1.0 and applicable.get("skills_list", 1.0) >= 0.8
    if contact_ok and jobs_ok and skills_ok and uni_ok and structure_ok:
        s.verdict = "PASS"
    elif applicable.get("email", 1.0) == 1.0 and skills_ok and applicable.get("experience", 1.0) > 0:
        s.verdict = "WARN"
    else:
        s.verdict = "FAIL"
    _ = DATE_RANGE  # parser vocabulary shared with scorer (kept for clarity)
    return s
