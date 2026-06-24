"""Scoring + skill-extraction tests."""
from app.analyzers.ats_scorer import score_text
from app.analyzers.keyword_extractor import extract_skills
from app.analyzers.nlp_engine import get_engine

from .sample_data import STRONG_CV, WEAK_CV


def test_strong_beats_weak():
    eng = get_engine()
    strong = score_text(STRONG_CV, eng)
    weak = score_text(WEAK_CV, eng)
    assert strong.overall_score > weak.overall_score
    assert strong.overall_score >= 60


def test_short_tech_skills_detected():
    skills = extract_skills("Skills: Go, C#, C++, ML, AI, R, AWS, Python")
    for expected in ("Go", "C#", "C++", "ML", "AI", "R", "AWS", "Python"):
        assert expected in skills, f"{expected} missing from {skills}"


def test_single_letter_skill_needs_list_context():
    # "R" inside prose should NOT be picked up as a skill.
    assert "R" not in extract_skills("I am a star performer who delivers results")
    # In a delimited list it should.
    assert "R" in extract_skills("Languages: Python, R, Java")


def test_detected_contact():
    r = score_text(STRONG_CV, get_engine())
    assert any("@" in e for e in r.detected.emails)
    assert r.detected.phones
    assert r.detected.links


def test_five_signals_and_weights():
    r = score_text(STRONG_CV, get_engine())
    assert len(r.signals) == 6
    assert abs(sum(s.weight for s in r.signals) - 1.0) < 1e-9
    for s in r.signals:
        assert 0.0 <= s.score <= 100.0


def test_deterministic():
    eng = get_engine()
    assert score_text(STRONG_CV, eng).overall_score == score_text(STRONG_CV, eng).overall_score


def test_weak_cv_gets_suggestions():
    r = score_text(WEAK_CV, get_engine())
    assert len(r.suggestions) >= 3
