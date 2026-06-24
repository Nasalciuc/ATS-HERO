"""Skill / keyword extraction.

The dictionary now lives in packages/shared/data/skills.json (single source of truth,
shared with the TS client). Short, symbol-bearing terms (Go, C#, C++, ML, gRPC) are
recognized; single-letter skills (R, C) require list context; multi-word phrases come
from noun chunks when the trained model is loaded.
"""
import re

from ..data_loader import load

_DATA = load("skills")
_TECH_SKILLS: set[str] = {s.lower() for s in _DATA["tech_skills"]}
_SINGLE_LETTER_SKILLS: set[str] = {s.lower() for s in _DATA.get("single_letter", [])}
_PHRASES: list[str] = [p.lower() for p in _DATA.get("phrases", [])]
_DISPLAY: dict[str, str] = _DATA.get("display", {})

_TOKEN_RE = re.compile(r"[^\s]+")
_STRIP_RE = re.compile(r"^[^\w#+]+|[^\w#+]+$")


def _norm(token: str) -> str:
    return _STRIP_RE.sub("", token).lower()


def _display(skill: str) -> str:
    return _DISPLAY.get(skill, skill.capitalize() if skill.isalpha() else skill)


def extract_skills(text: str, doc=None) -> list[str]:
    """Return distinct, display-cased skills found in `text`."""
    found: set[str] = set()

    for raw in _TOKEN_RE.findall(text):
        norm = _norm(raw)
        if norm in _TECH_SKILLS:
            found.add(norm)

    lowered = text.lower()

    # Curated multi-word phrases.
    for phrase in _PHRASES:
        if phrase in lowered:
            found.add(phrase)

    # Single letters only in a clear list context.
    for letter in _SINGLE_LETTER_SKILLS:
        if re.search(rf"(?:^|[,;|/\u2022\n]|\band\s)\s*{re.escape(letter)}\s*(?:[,;|/\u2022\n]|$|\band\b)", lowered):
            found.add(letter)

    skills = {_display(s) for s in found}

    # Multi-word phrases from noun chunks (only meaningful with the trained model).
    if doc is not None and getattr(doc, "has_annotation", None) and doc.has_annotation("DEP"):
        for chunk in doc.noun_chunks:
            phrase = chunk.text.strip()
            if 1 < len(phrase.split()) <= 3 and any(c.isalpha() for c in phrase):
                low = phrase.lower()
                if any(t in _TECH_SKILLS for t in low.split()):
                    skills.add(phrase)

    return sorted(skills)


def skill_set() -> set[str]:
    """Canonical lowercase skill set (used by the job matcher)."""
    return set(_TECH_SKILLS)
