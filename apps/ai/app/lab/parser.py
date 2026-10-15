"""Reference parser — a deterministic, transparent stand-in for an ATS resume parser.

It is NOT Textkernel/Affinda/RChilli; it does what every parser fundamentally does with the
text an extractor hands it: find contact tokens, cut the text into sections by heading,
anchor each job / degree on its date range, and split the skills section into items.
If THIS parser can't recover a field from the text layer, a commercial one is guessing too.
Commercial parsers plug into the same scorer through `vendors.py` (adapter interface).
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

# --------------------------------------------------------------------------- vocab
HEADINGS: dict[str, tuple[str, ...]] = {
    "summary": ("summary", "professional summary", "profile", "about me", "objective", "rezumat", "profil"),
    "experience": ("experience", "work experience", "professional experience", "employment",
                   "employment history", "work history", "experiență", "experienta", "experiență profesională"),
    "education": ("education", "educație", "educatie", "studii"),
    "skills": ("skills", "technical skills", "hard skills", "skills & awards", "skills and awards",
               "skills & languages", "competențe", "competente", "abilități"),
    "tools": ("tools", "instruments", "technologies"),
    "soft_skills": ("soft skills",),
    "languages": ("languages", "limbi", "limbi străine"),
    "certifications": ("certifications", "certificates", "training & certifications",
                       "training and certifications", "certificări"),
    "awards": ("awards", "honors", "awards & honors", "premii"),
    "publications": ("publications", "publicații"),
    "volunteering": ("volunteering", "volunteer experience", "voluntariat"),
    "activities": ("activities", "relevant activities", "projects", "activități"),
    "links": ("links", "profiles"),
}
_HEADING_INDEX = {v: k for k, vs in HEADINGS.items() for v in vs}

_MONTHS = (r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|"
           r"sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?")
_DATE = rf"(?:(?:{_MONTHS})\.?\s+(?:19|20)\d{{2}}|(?:0?[1-9]|1[0-2])/(?:19|20)\d{{2}}|(?:19|20)\d{{2}})"
DATE_RANGE = re.compile(
    rf"(?P<start>{_DATE})\s*(?:–|—|-|to|until)\s*(?P<end>{_DATE}|present|current|now|prezent)",
    re.IGNORECASE,
)
EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
PHONE = re.compile(r"(?<![\w/])\+?\d[\d\s().\-]{7,}\d(?![\w/])")
LINKEDIN = re.compile(r"linkedin\.com/in/([A-Za-z0-9\-_%]+)", re.IGNORECASE)
LIGATURES = re.compile("[ﬀ-ﬆ]")
_BULLET = re.compile(r"^[\s•●▪◦‣►▸→➜➔✓■◆\-*·]+")  # glyphs used by common resume builders


def normalize(text: str) -> str:
    """What a careful parser normalises: Unicode NFC, NBSP→space, trailing spaces."""
    text = unicodedata.normalize("NFC", text).replace(" ", " ").replace("﻿", "")
    return "\n".join(line.rstrip() for line in text.splitlines())


def heading_key(line: str) -> str | None:
    s = re.sub(r"[:\s]+$", "", line.strip()).strip()
    if not s or len(s) > 40 or any(ch.isdigit() for ch in s):
        return None
    return _HEADING_INDEX.get(s.lower())


# ------------------------------------------------------------------------- models
@dataclass
class Block:
    """Text anchored on one date range — one job or one degree, as the parser segments it."""
    start: str
    end: str
    text: str


@dataclass
class Parsed:
    text: str
    name: str | None = None
    emails: list[str] = field(default_factory=list)
    phones: list[str] = field(default_factory=list)
    linkedin: str | None = None
    sections: list[tuple[str, int]] = field(default_factory=list)  # (key, line index), in order
    experience: list[Block] = field(default_factory=list)
    education: list[Block] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    ligatures: list[str] = field(default_factory=list)


# ------------------------------------------------------------------------- parse
def parse(raw: str) -> Parsed:
    text = normalize(raw)
    lines = text.splitlines()
    p = Parsed(text=text)

    p.ligatures = sorted({m.group(0) for m in LIGATURES.finditer(raw)})
    p.emails = EMAIL.findall(text)
    p.phones = [m.group(0).strip() for m in PHONE.finditer(text) if not DATE_RANGE.search(m.group(0))]
    li = LINKEDIN.search(text)
    p.linkedin = li.group(1).lower() if li else None
    p.name = _guess_name(lines)

    p.sections = [(k, i) for i, line in enumerate(lines) if (k := heading_key(line))]
    p.experience = _blocks(lines, _section_span(p.sections, lines, "experience"))
    p.education = _blocks(lines, _section_span(p.sections, lines, "education"))
    p.skills = _skill_items(lines, p.sections)
    return p


def _guess_name(lines: list[str]) -> str | None:
    """First short line of 2-4 capitalised words with no digits/@ — the classic heuristic."""
    for line in lines[:12]:
        s = line.strip()
        words = s.split()
        if (2 <= len(words) <= 4 and not heading_key(s) and not re.search(r"[\d@/:]", s)
                and all(w[0].isupper() for w in words if w[0].isalpha())):
            return s
    return None


def _section_span(sections: list[tuple[str, int]], lines: list[str], key: str) -> tuple[int, int] | None:
    for idx, (k, start) in enumerate(sections):
        if k == key:
            end = sections[idx + 1][1] if idx + 1 < len(sections) else len(lines)
            return start + 1, end
    return None


def _header_start(lines: list[str], anchor: int, floor: int, depth: int) -> int:
    """Walk up from a date line over the entry header (title / company / location): at most
    `depth` short, non-bullet, non-date lines; blank lines are transparent."""
    i, taken, first = anchor - 1, 0, anchor
    while i >= floor and taken < depth:
        s = lines[i].strip()
        if not s:
            i -= 1
            continue
        if _BULLET.match(lines[i]) or DATE_RANGE.search(s) or heading_key(s) or len(s) > 80 or s.endswith("."):
            break
        first, taken, i = i, taken + 1, i - 1
    return first


def _blocks(lines: list[str], span: tuple[int, int] | None) -> list[Block]:
    """One block per date range: the header lines above it + everything up to the next
    entry's header. If dates got separated from their entry (a reading-order failure), the
    block will not contain the right title/company — which is exactly what we want to catch."""
    if not span:
        return []
    start, end = span
    anchors = [i for i in range(start, end) if DATE_RANGE.search(lines[i])]
    if not anchors:
        return []
    # Entries in one section share a layout, so learn the header depth from the FIRST entry
    # (non-empty lines between the heading and its date line) and apply it to every entry —
    # how parsers attach 'Title / Company / 2021 – Present' without guessing per entry.
    depth = min(3, sum(1 for i in range(start, anchors[0]) if lines[i].strip()))
    starts: list[int] = []
    for n, a in enumerate(anchors):
        floor = anchors[n - 1] + 1 if n else start
        starts.append(_header_start(lines, a, floor, depth))
    blocks: list[Block] = []
    for n, a in enumerate(anchors):
        m = DATE_RANGE.search(lines[a])
        assert m
        b_end = starts[n + 1] if n + 1 < len(anchors) else end
        blocks.append(Block(m.group("start"), m.group("end"), "\n".join(lines[starts[n]:max(b_end, a + 1)])))
    return blocks


def _skill_items(lines: list[str], sections: list[tuple[str, int]]) -> list[str]:
    items: list[str] = []
    # Every skills-like section counts, not just the first: a label extracted on its own line
    # ('SKILLS & AWARDS' / 'Technical Skills:' / 'Go, Java, …') opens a second 'skills' section.
    for idx, (key, start) in enumerate(sections):
        if key not in ("skills", "tools", "soft_skills", "languages"):
            continue
        end = sections[idx + 1][1] if idx + 1 < len(sections) else len(lines)
        for line in lines[start + 1:end]:
            # Any short "Label:" prefix (Hard skills:, Technical Skills:, Certifications:, …) is a label.
            body = re.sub(r"^[A-Za-z][A-Za-z &/]{1,30}:\s*", "", _BULLET.sub("", line))
            for part in re.split(r"[·,|;•]", body):
                part = re.sub(r"\s*\((?:a1|a2|b1|b2|c1|c2|native)\)\s*$", "", part.strip(), flags=re.IGNORECASE)
                if part:
                    items.append(part)
    return items
