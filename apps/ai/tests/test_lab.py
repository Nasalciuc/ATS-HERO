"""ATS lab — reference parser + scorer. Pure text in, no files needed (fast, CI-safe)."""
import json
from pathlib import Path

import pytest

from app.lab.parser import DATE_RANGE, heading_key, parse
from app.lab.scorer import _date_key, score

FIXTURES = Path(__file__).resolve().parents[3] / "tools" / "ats-lab" / "fixtures" / "personas.json"
ANA = json.loads(FIXTURES.read_text(encoding="utf-8"))["ana"] if FIXTURES.exists() else None

# The text a well-behaved extractor produces for Ana's Classic CV (single column).
CLEAN = """Ana Popescu
Frontend Engineer
ana.popescu@example.com  +40 721 000 111  Cluj-Napoca, Romania  anapopescu.dev
linkedin.com/in/anapopescu
SUMMARY
Frontend engineer with 4 years building React and TypeScript products for fintech and SaaS.
SKILLS
Hard skills: React · TypeScript · Next.js · GraphQL · Node.js
Tools: Figma · Git · Jest · Playwright
EXPERIENCE
Frontend Engineer                         September 2021 – Present
Fintech Labs SRL                          Cluj-Napoca, Romania
• Led migration of a 120k-line React app to TypeScript and Next.js.
EDUCATION
BSc Computer Science                      October 2016 – July 2020
Technical University of Cluj-Napoca       Cluj-Napoca, Romania
"""

needs_fixture = pytest.mark.skipif(ANA is None, reason="tools/ats-lab/fixtures/personas.json not found")


@pytest.mark.parametrize("line,key", [
    ("EXPERIENCE", "experience"), ("Work Experience", "experience"), ("SKILLS", "skills"),
    ("Education:", "education"), ("RELEVANT ACTIVITIES", "activities"), ("Experiență profesională", "experience"),
    ("Frontend Engineer", None), ("SKILLS   Built Power BI dashboards", None),  # merged two-column line
])
def test_heading_detection(line, key):
    assert heading_key(line) == key


@pytest.mark.parametrize("text,ok", [
    ("September 2021 – Present", True), ("Sep 2021 - Mar 2023", True), ("09/2021 – 03/2023", True),
    ("2016 – 2020", True), ("October 2016 to July 2020", True),
    ("Oct '21 – now", False),  # free-text formats the builder must normalise (see spec §F)
])
def test_date_ranges(text, ok):
    assert bool(DATE_RANGE.search(text)) is ok


@needs_fixture
def test_clean_single_column_passes():
    s = score(parse(CLEAN), ANA)
    assert s.verdict == "PASS", s.problems
    assert s.checks["experience"] == 1.0 and s.checks["skills_text"] == 1.0


@needs_fixture
def test_wrapped_email_is_lost():
    # What the Modern sidebar produced when e-mails were allowed to wrap.
    broken = CLEAN.replace("ana.popescu@example.com", "ana.popescu@example\n.com")
    s = score(parse(broken), ANA)
    assert s.checks["email"] == 0.0 and s.verdict == "FAIL"


@needs_fixture
def test_dates_separated_from_their_job_are_caught():
    # pdfminer on split-row layouts: right-column dates dumped after every other section.
    moved = CLEAN.replace("                         September 2021 – Present", "") + "\nSeptember 2021 – Present\n"
    s = score(parse(moved), ANA)
    assert s.checks.get("experience", 0) < 1.0


@needs_fixture
def test_diacritics_must_survive_exactly():
    mihai = json.loads(FIXTURES.read_text(encoding="utf-8"))["mihai"]
    text = CLEAN.replace("Ana Popescu", "Mihai Stefanescu")  # ș/ă flattened by a bad font mapping
    s = score(parse(text), mihai)
    assert s.checks["unicode"] < 1.0
    assert any("diacritics" in p for p in s.problems)


def test_skill_label_on_its_own_line_still_lists_skills():
    # Label and values in separate boxes (PyMuPDF block order): the label line reads as a
    # second 'skills' heading; its values must still be listed.
    text = "SKILLS & AWARDS\nTechnical Skills:\nReact, TypeScript, Next.js,\nGraphQL\nLanguages:\nEnglish (C1)\n"
    assert parse(text).skills == ["React", "TypeScript", "Next.js", "GraphQL", "English"]


def test_blocks_learn_header_depth_from_first_entry():
    text = """EXPERIENCE
Senior Engineer
Acme
March 2021 – Present
• Did things
Engineer
Beta
June 2018 – February 2021
• Did other things
"""
    p = parse(text)
    assert len(p.experience) == 2
    assert "Acme" in p.experience[0].text and "Beta" in p.experience[1].text
    assert "Beta" not in p.experience[0].text


@pytest.mark.parametrize("raw,key", [
    ("March 2021", "mar2021"), ("Mar 2021", "mar2021"), ("03/2021", "mar2021"),
    ("3.2021", "mar2021"), ("2021-03-01", "mar2021"), ("2021", "2021"),
])
def test_date_key_normalises_vendor_formats(raw, key):
    # Commercial parsers return numeric dates; they must align with "Month YYYY" truth.
    assert _date_key(raw) == key


@needs_fixture
def test_uppercased_name_keeps_diacritics():
    # Templates that uppercase the name in CSS emit 'MIHAI ȘTEFĂNESCU' — intact for ATS search.
    mihai = json.loads(FIXTURES.read_text(encoding="utf-8"))["mihai"]
    text = CLEAN.replace("Ana Popescu", "MIHAI ȘTEFĂNESCU")
    s = score(parse(text), mihai)
    assert "Mihai Ștefănescu" not in " ".join(s.problems)
    flattened = score(parse(CLEAN.replace("Ana Popescu", "MIHAI STEFANESCU")), mihai)
    assert any("Mihai Ștefănescu" in p for p in flattened.problems if p.startswith("diacritics"))


@needs_fixture
def test_wrapped_diacritic_name_is_not_corruption():
    mihai = json.loads(FIXTURES.read_text(encoding="utf-8"))["mihai"]
    text = CLEAN.replace("Ana Popescu", "Mihai Ștefănescu").replace(
        "Technical University of Cluj-Napoca", "Universitatea Tehnică a\nMoldovei")
    s = score(parse(text), mihai)
    reported = " ".join(p for p in s.problems if p.startswith("diacritics"))
    assert "Universitatea Tehnică a Moldovei" not in reported   # wrapped over two lines, still intact
    assert "Ștefănescu" not in reported


def test_single_year_degree_is_one_entry():
    # "BSc …, 2026" with no range: a graduation year (seen on a real Google Docs CV).
    p = parse("EDUCATION\nBSc in Software Engineering, Technical University of Moldova Chisinau, 2026\nSKILLS\nGo")
    assert [(b.start, b.end) for b in p.education] == [("2026", "2026")]
    assert "Technical University of Moldova" in p.education[0].text


def test_single_dates_only_when_a_section_has_no_range():
    p = parse("EDUCATION\nBSc Computer Science, 2014 – 2018\nCourse, 2019\n")
    assert [(b.start, b.end) for b in p.education] == [("2014", "2018")]


def test_range_cut_after_its_dash_is_rejoined():
    # PyMuPDF re-wraps long .docx lines: "BSc …, 2014 –" / "2018".
    p = parse("EXPERIENCE\nData Analyst, Moldcell, June 2018 –\nFebruary 2021\n• Built dashboards")
    assert [(b.start, b.end) for b in p.experience] == [("June 2018", "February 2021")]


def test_linkedin_cut_after_in_is_rejoined_but_a_slug_cut_in_its_middle_is_not():
    assert parse("Ana Popescu\nlinkedin.com/in/\nanapopescu").linkedin == "anapopescu"
    assert parse("Ana Popescu\nlinkedin.com/in/ana-popescu-senior-\nfrontend").linkedin == "ana-popescu-senior-"
