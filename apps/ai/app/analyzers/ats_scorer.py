"""Deterministic + NLP ATS scoring over raw CV text.

Six weighted signals plus a list of per-item `findings` (the actionable WEAK->STRONG
material the Tier 3 rewriter consumes). Weak phrases, clichés and section patterns come
from packages/shared/data (single source of truth, shared with the TS client). Action-verb
detection uses spaCy POS+lemma when the trained model is loaded, with a rule-based fallback.
"""
import re

from ..data_loader import load
from ..models.responses import Detected, Finding, ScoreMeta, ScoreResponse, Signal
from .keyword_extractor import extract_skills
from .nlp_engine import NlpEngine

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
URL_RE = re.compile(r"https?://[^\s]+|(?:www\.)[^\s]+", re.I)
PROFILE_RE = re.compile(r"(?:linkedin\.com|github\.com|gitlab\.com|behance\.net)/[^\s]+", re.I)
PHONE_RE = re.compile(r"\+?\d[\d\s().\-]{6,}\d")
METRIC_RE = re.compile(
    r"\d+(?:\.\d+)?\s*%"
    r"|[$€£]\s*\d"
    r"|\d+(?:\.\d+)?\s*(?:x|×)\b"
    r"|\bby\s+\d"
    r"|\d+(?:\.\d+)?\s*(?:k|m|bn|million|billion)\b"
    r"|\d+(?:\.\d+)?\s*(?:ms|sec|secs|seconds|min|mins|minutes|hr|hrs|hours)\b"
    r"|\d+(?:\.\d+)?\s*(?:req|reqs|rps|qps|fps|tps)\b"
    r"|\bp\d{2,}\b"
    r"|\d+(?:\.\d+)?\s*(?:gb|tb|mb|kb)\b",
    re.I,
)

_SECTIONS = load("sections")["sections"]
_NONSTANDARD = [h.lower() for h in load("sections").get("nonstandard_heading_hints", [])]
SECTION_PATTERNS = {
    name: re.compile(r"\b(?:" + "|".join(re.escape(k) for k in kws) + r")\b", re.I)
    for name, kws in _SECTIONS.items()
}

_WEAK_PHRASES = load("weak-phrases")["weak_phrases"]
_CLICHES = load("cliches")["cliches"]

_ACTION_LEMMAS = {
    "lead", "build", "design", "develop", "analyze", "manage", "create", "improve",
    "increase", "reduce", "launch", "deliver", "optimize", "implement", "coordinate",
    "achieve", "drive", "own", "ship", "scale", "automate", "architect", "mentor",
    "spearhead", "streamline", "negotiate", "execute", "oversee", "establish",
    "generate", "accelerate", "transform", "migrate", "refactor", "deploy",
}
_IRREGULAR = {
    "lead": ["led"], "build": ["built"], "drive": ["drove", "driven"],
    "oversee": ["oversaw", "overseen"], "ship": ["shipped"], "run": ["ran"],
}


def _inflections(lemma: str) -> set[str]:
    forms = {lemma, lemma + "s"}
    if lemma.endswith("e"):
        forms |= {lemma + "d", lemma[:-1] + "ing"}
    else:
        forms |= {lemma + "ed", lemma + "ing"}
    forms |= set(_IRREGULAR.get(lemma, []))
    return forms


_ACTION_FORMS = set().union(*(_inflections(l) for l in _ACTION_LEMMAS))


def _clamp(n: float) -> float:
    return round(max(0.0, min(100.0, n)), 1)


def _line_of(lines: list[str], needle: str) -> int | None:
    low = needle.lower()
    for i, ln in enumerate(lines, start=1):
        if low in ln.lower():
            return i
    return None


def _scan_findings(text: str) -> list[Finding]:
    findings: list[Finding] = []
    lines = text.split("\n")
    lower = text.lower()

    for entry in _WEAK_PHRASES:
        ph = entry["phrase"]
        if re.search(rf"(?<!\w){re.escape(ph)}(?!\w)", lower):
            findings.append(Finding(
                type="weak_phrase", severity="high", text=entry["phrase"],
                why=entry["why"], suggestion=entry["rewrite_hint"],
                line=_line_of(lines, ph),
            ))

    for entry in _CLICHES:
        ph = entry["phrase"]
        if re.search(rf"(?<!\w){re.escape(ph)}(?!\w)", lower):
            findings.append(Finding(
                type="cliche", severity="medium", text=entry["phrase"],
                why=entry["why"], suggestion="Replace with a specific, quantified achievement.",
                line=_line_of(lines, ph),
            ))

    for hint in _NONSTANDARD:
        if re.search(rf"(?<!\w){re.escape(hint)}(?!\w)", lower):
            findings.append(Finding(
                type="nonstandard_heading", severity="medium", text=hint,
                why="Non-standard section headings confuse ATS parsers.",
                suggestion="Use a standard heading (Summary, Experience, Education, Skills).",
                line=_line_of(lines, hint),
            ))

    return findings


def score_text(text: str, engine: NlpEngine) -> ScoreResponse:
    doc = engine(text)
    sents = [s for s in doc.sents if s.text.strip()]
    n_sents = max(len(sents), 1)
    word_count = len([t for t in doc if t.is_alpha])

    emails = _dedup(EMAIL_RE.findall(text))
    phones = [p.strip() for p in PHONE_RE.findall(text) if sum(c.isdigit() for c in p) >= 7]
    phones = _dedup(phones)
    links = _dedup(PROFILE_RE.findall(text) + URL_RE.findall(text))
    skills = extract_skills(text, doc)

    if engine.model_loaded:
        action_surface = [t.text for t in doc if t.pos_ == "VERB" and t.lemma_.lower() in _ACTION_LEMMAS]
        orgs = _dedup([e.text for e in doc.ents if e.label_ == "ORG"])
        dates = _dedup([e.text for e in doc.ents if e.label_ == "DATE"])
    else:
        action_surface = [t.text for t in doc if t.text.lower() in _ACTION_FORMS]
        orgs, dates = [], []

    detected = Detected(
        emails=emails, phones=phones, links=links, skills=skills,
        action_verbs=_dedup(action_surface), organizations=orgs, dates=dates,
    )

    findings = _scan_findings(text)
    n_weak = sum(1 for f in findings if f.type == "weak_phrase")
    n_cliche = sum(1 for f in findings if f.type == "cliche")

    # --- signals (0-100) ---
    contact = (50 if emails else 0) + (30 if phones else 0) + (20 if links else 0)
    action = _clamp(len(action_surface) / n_sents * 100)

    metric_text = text
    for token in emails + phones:
        metric_text = metric_text.replace(token, " ")
    metrics = METRIC_RE.findall(metric_text)
    impact = _clamp(len(metrics) / n_sents * 120)

    n_skills = len(skills)
    skills_score = 0 if n_skills == 0 else 40 if n_skills < 3 else 70 if n_skills < 6 else 100

    present = sum(1 for pat in SECTION_PATTERNS.values() if pat.search(text))
    present += 1 if (emails or phones) else 0
    structure = _clamp(present / (len(SECTION_PATTERNS) + 1) * 100)

    language = _clamp(100 - n_weak * 15 - n_cliche * 8)

    signals = [
        Signal(key="contactability", label="Contactability", score=_clamp(contact), weight=0.15,
               detail=_contact_detail(emails, phones, links)),
        Signal(key="action_verbs", label="Action verbs", score=action, weight=0.15,
               detail=f"{len(action_surface)} action-verb mentions across {len(sents)} sentences"),
        Signal(key="quantified_impact", label="Quantified impact", score=impact, weight=0.20,
               detail=f"{len(metrics)} measurable results detected"),
        Signal(key="skills", label="Skills", score=float(skills_score), weight=0.15,
               detail=f"{n_skills} distinct skills recognized"),
        Signal(key="structure", label="Structure", score=structure, weight=0.15,
               detail=f"{present}/{len(SECTION_PATTERNS) + 1} expected sections present"),
        Signal(key="language_quality", label="Language quality", score=language, weight=0.20,
               detail=f"{n_weak} weak phrase(s), {n_cliche} cliché(s)"),
    ]

    overall = _clamp(sum(s.score * s.weight for s in signals))

    return ScoreResponse(
        overall_score=overall,
        signals=signals,
        detected=detected,
        findings=findings,
        suggestions=_suggestions(signals, detected, findings),
        meta=ScoreMeta(
            word_count=word_count,
            sentence_count=len(sents),
            nlp_model=engine.label,
            model_loaded=engine.model_loaded,
        ),
    )


def _dedup(items: list[str]) -> list[str]:
    seen: dict[str, None] = {}
    for it in items:
        key = it.strip()
        if key and key.lower() not in {k.lower() for k in seen}:
            seen[key] = None
    return list(seen)


def _contact_detail(emails, phones, links) -> str:
    have = [name for name, ok in (("email", emails), ("phone", phones), ("link", links)) if ok]
    return ("Found: " + ", ".join(have)) if have else "No contact details found"


def _suggestions(signals: list[Signal], detected: Detected, findings: list[Finding]) -> list[str]:
    by = {s.key: s for s in signals}
    out: list[str] = []
    if by["contactability"].score < 100:
        if not detected.emails:
            out.append("Add a professional email address — recruiters and ATS need a contact point.")
        if not detected.phones:
            out.append("Add a phone number.")
        if not detected.links:
            out.append("Add your LinkedIn or portfolio URL.")
    if by["language_quality"].score < 100:
        out.append("Replace weak/passive phrasing and clichés with specific, quantified achievements.")
    if by["action_verbs"].score < 60:
        out.append("Start more bullet points with strong action verbs (led, built, improved).")
    if by["quantified_impact"].score < 60:
        out.append("Quantify your impact with numbers and percentages (e.g. 'reduced costs by 30%').")
    if by["skills"].score < 70:
        out.append("List more relevant skills, including specific tools and technologies.")
    if by["structure"].score < 100:
        out.append("Use clear section headers (Summary, Experience, Education, Skills).")
    if not out:
        out.append("Strong CV — keep tailoring keywords to each job description.")
    return out[:6]
