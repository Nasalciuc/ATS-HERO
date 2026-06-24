"""Skill / keyword extraction.

Built around a curated tech dictionary so short, symbol-bearing terms that naive
tokenizers drop — Go, C#, C++, ML, AI, UX, R — are recognized. When the trained
spaCy model is loaded, multi-word skill phrases are additionally pulled from noun
chunks. Single-letter skills (R, C) require list-style delimiters to avoid matching
stray prose.
"""
import re

# Canonical lowercase forms.
_TECH_SKILLS: set[str] = {
    # languages
    "python", "java", "javascript", "typescript", "go", "golang", "rust", "c#",
    "c++", "ruby", "php", "swift", "kotlin", "scala", "perl", "sql", "bash",
    "matlab", "objective-c", "dart", "elixir", "haskell",
    # web / frameworks
    "react", "angular", "vue", "svelte", "node", "nextjs", "nuxt", "django",
    "flask", "fastapi", "spring", "rails", "express", "tailwind", "graphql",
    "rest", "redux", "jquery",
    # data / ml
    "ml", "ai", "nlp", "tensorflow", "pytorch", "pandas", "numpy", "spark",
    "hadoop", "scikit-learn", "keras", "bi", "tableau", "powerbi",
    # cloud / devops
    "aws", "gcp", "azure", "docker", "kubernetes", "k8s", "terraform", "ansible",
    "ci", "cd", "jenkins", "git", "linux", "nginx", "kafka",
    # databases
    "postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch",
    "sqlite", "dynamodb", "cassandra",
    # design / qa / other
    "ux", "ui", "qa", "figma", "sketch", "css", "html", "seo", "scrum", "agile",
    "jira", "saas", "api",
}

# Single-letter skills handled separately (high false-positive risk in prose).
_SINGLE_LETTER_SKILLS = {"r", "c"}

# Display casing for terms that look wrong lowercased.
_DISPLAY: dict[str, str] = {
    "c#": "C#", "c++": "C++", "javascript": "JavaScript", "typescript": "TypeScript",
    "nodejs": "Node.js", "node": "Node.js", "nextjs": "Next.js", "nuxt": "Nuxt",
    "graphql": "GraphQL", "postgresql": "PostgreSQL", "postgres": "PostgreSQL",
    "mysql": "MySQL", "mongodb": "MongoDB", "aws": "AWS", "gcp": "GCP",
    "k8s": "Kubernetes", "ml": "ML", "ai": "AI", "nlp": "NLP", "ux": "UX",
    "ui": "UI", "qa": "QA", "ci": "CI", "cd": "CD", "bi": "BI", "css": "CSS",
    "html": "HTML", "seo": "SEO", "sql": "SQL", "api": "API", "rest": "REST",
    "saas": "SaaS", "powerbi": "Power BI", "scikit-learn": "scikit-learn",
    "golang": "Go", "r": "R", "c": "C",
}

# Tokens split on whitespace and surrounding punctuation, but internal # and +
# are preserved so "c#" / "c++" survive.
_TOKEN_RE = re.compile(r"[^\s]+")
_STRIP_RE = re.compile(r"^[^\w#+]+|[^\w#+]+$")


def _norm(token: str) -> str:
    return _STRIP_RE.sub("", token).lower()


def _display(skill: str) -> str:
    return _DISPLAY.get(skill, skill.capitalize() if skill.isalpha() else skill)


def extract_skills(text: str, doc=None) -> list[str]:
    """Return distinct, display-cased skills found in `text`.

    `doc` is an optional spaCy Doc; when its model is trained, noun chunks add
    multi-word skill phrases.
    """
    found: set[str] = set()

    for raw in _TOKEN_RE.findall(text):
        norm = _norm(raw)
        if norm in _TECH_SKILLS:
            found.add(norm)

    # Single letters only in a clear list context: ", R," / "R," / "/C" etc.
    lowered = text.lower()
    for letter in _SINGLE_LETTER_SKILLS:
        if re.search(rf"(?:^|[,;|/•\n]|\band\s)\s*{re.escape(letter)}\s*(?:[,;|/•\n]|$|\band\b)", lowered):
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
