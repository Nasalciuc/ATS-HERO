"""Section headings in the lab parser; apps/web/tests/ats-parse.test.ts checks the same in the port."""
import pytest

from app.lab.parser import MIXED, heading_key, parse


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
                                  "Education and research at USM"])
def test_not_a_heading(line):
    assert heading_key(line) is None


# Jobs and degrees are read apart: a heading that joins them ends the section before it, and
# nothing under it is read, so a degree's years never count as work.
@pytest.mark.parametrize("line", ["Experience and Education", "Education & Experience", "Опыт работы и образование",
                                  "Experiență și educație"])
def test_mixed_heading(line):
    assert heading_key(line) == MIXED


def test_mixed_heading_ends_the_section_before_it():
    p = parse("Mara Lungu\nmara.lungu@example.com\nExperience and training\nGame Designer, Lumen Games, 2020 – 2022\nExperience and Education\nBSc in Game Design, USM, 2014 – 2018")
    assert [b.start for b in p.experience] == ["2020"]
    assert p.education == []
