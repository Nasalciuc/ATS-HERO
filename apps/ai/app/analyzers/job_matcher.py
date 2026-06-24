"""Job-fit matching — 'mirror the JD'.

Extracts the skills/keywords a job description asks for, then checks how many appear in
the CV. Acronym-aware: a JD asking for 'ML' is satisfied by a CV that says 'machine
learning' (and vice versa), which is exactly where naive exact-match ATS filters fail.
"""
import re

from ..models.responses import JobFitResponse
from .keyword_extractor import extract_skills

# Acronym <-> expansion pairs (both directions are checked).
_ACRONYMS = {
    "seo": "search engine optimization",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "nlp": "natural language processing",
    "k8s": "kubernetes",
    "ci": "continuous integration",
    "cd": "continuous delivery",
    "ci/cd": "continuous integration",
    "ux": "user experience",
    "ui": "user interface",
    "qa": "quality assurance",
    "bi": "business intelligence",
    "api": "application programming interface",
    "sql": "structured query language",
    "aws": "amazon web services",
    "gcp": "google cloud platform",
    "crm": "customer relationship management",
    "erp": "enterprise resource planning",
    "kpi": "key performance indicator",
    "sla": "service level agreement",
    "roi": "return on investment",
    "sop": "standard operating procedure",
    "sdlc": "software development life cycle",
    "hr": "human resources",
}


def _boundary(term: str) -> str:
    return rf"(?<![\w#+]){re.escape(term)}(?![\w#+])"


def _present(skill_lower: str, cv_lower: str) -> bool:
    if re.search(_boundary(skill_lower), cv_lower):
        return True
    expansion = _ACRONYMS.get(skill_lower)
    if expansion and expansion in cv_lower:
        return True
    for acr, exp in _ACRONYMS.items():
        if exp == skill_lower and re.search(_boundary(acr), cv_lower):
            return True
    return False


def match_job(cv_text: str, job_text: str) -> JobFitResponse:
    job_skills = extract_skills(job_text)            # display-cased, distinct
    cv_skills_lower = {s.lower() for s in extract_skills(cv_text)}
    cv_lower = cv_text.lower()

    matched, missing = [], []
    for skill in job_skills:
        s = skill.lower()
        if s in cv_skills_lower or _present(s, cv_lower):
            matched.append(skill)
        else:
            missing.append(skill)

    total = len(job_skills)
    score = round(len(matched) / total * 100, 1) if total else 0.0

    suggestions: list[str] = []
    if missing:
        shown = ", ".join(sorted(missing)[:12])
        suggestions.append(
            f"Mirror these keywords the job asks for (only where you genuinely have the experience): {shown}."
        )
    if total and score < 80:
        suggestions.append("Aim to match at least ~80% of the must-have keywords the ATS scans for.")
    if not suggestions:
        suggestions.append("Strong keyword overlap — your CV mirrors this job description well.")

    return JobFitResponse(
        match_score=score,
        matched=sorted(matched),
        missing=sorted(missing),
        suggestions=suggestions,
    )
