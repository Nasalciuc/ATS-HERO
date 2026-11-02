"""Section headings in the lab parser; apps/web/tests/ats-parse.test.ts checks the same in the port."""
import pytest

from app.lab.parser import heading_key


@pytest.mark.parametrize("line,key", [
    ("Education and languages", "education"),
    ("EDUCATION & LANGUAGES", "education"),
    ("Education & Training", "education"),
    ("Образование и языки", "education"),
    ("Educație și limbi", "education"),
    ("Projects / Achievements", "activities"),
    ("Core skills", "skills"),
    ("Key Skills", "skills"),
    ("Core competencies", "skills"),
    ("Ключевые компетенции", "skills"),
    ("Competențe cheie", "skills"),
])
def test_heading(line, key):
    assert heading_key(line) == key


@pytest.mark.parametrize("line", ["Python and SQL", "Experience and passion", "Data Analyst & Developer",
                                  "Education and research at USM",
                                  # jobs and degrees are read apart: their years must not mix
                                  "Experience and Education", "Education & Experience", "Опыт работы и образование",
                                  "Experiență și educație"])
def test_not_a_heading(line):
    assert heading_key(line) is None
