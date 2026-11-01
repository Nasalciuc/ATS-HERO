"""ATS lab — the parity cases that keep the lab parser (`parser.py`) and the browser's TypeScript
port (`apps/web/lib/ats-read/parse.ts`) giving the same answers.

`tools/ats-lab/parity/cases.jsonl` holds one case per line: a text an ATS reader produced and what
`parse()` makes of it. pytest (`tests/test_parity.py`) and vitest (`tests/ats-parse.test.ts`) both
check every case, so changing either parser without the other fails a test.

Regenerate after a deliberate parser change (needs the lab files and the corpus rendered first):

    npx tsx --tsconfig lab/tsconfig.json lab/render.tsx                         # from apps/web
    python tools/ats-lab/corpus/make_corpus.py tools/ats-lab/out/corpus           # from the repo root
    soffice --headless --convert-to pdf --outdir tools/ats-lab/out/corpus tools/ats-lab/out/corpus/*.docx
    python -m app.lab.parity --write                                              # from apps/ai

The texts come only from synthetic people (tools/ats-lab/fixtures, the corpus) and the hand-written
edge cases below (AGENTS.md rule 11).
"""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from .extractors import DOCX_EXTRACTORS, PDF_EXTRACTORS, available
from .parser import Parsed, parse

ROOT = Path(__file__).resolve().parents[4]
CASES = ROOT / "tools" / "ats-lab" / "parity" / "cases.jsonl"
LAB_FILES = ROOT / "tools" / "ats-lab" / "out" / "files"
CORPUS = ROOT / "tools" / "ats-lab" / "out" / "corpus"

# The readers whose texts become cases (Tika and LibreOffice/mammoth add nothing the parser hasn't
# seen from these, and keep the file small).
PDF_READERS = ("pdftotext", "pdftotext-layout", "pdfminer", "pypdf", "pdfplumber", "pdfjs")
DOCX_READERS = ("python-docx", "docx2txt", "pymupdf")
LAB_LAYOUTS = ("classic", "modern", "docx")

# Hand-written texts for what the files above don't cover.
EDGE: dict[str, str] = {
    "single-year-degree": "Elena Rusu\nEDUCATION\nBSc in Software Engineering, Technical University of Moldova Chisinau, 2026\nSKILLS\nGo, Python",
    "range-cut-after-dash": "EXPERIENCE\nData Analyst, Moldcell, June 2018 –\nFebruary 2021\n• Built dashboards",
    "linkedin-cut-after-in": "Ana Popescu\nana@example.com\nlinkedin.com/in/\nanapopescu",
    "linkedin-cut-in-slug": "Ana Popescu\nlinkedin.com/in/ana-popescu-senior-\nfrontend",
    "google-docs-style": (
        "Alex Moraru\nSenior AI & Software Engineer\nalex.moraru@example.com • (+373) 690 00 000 • LinkedIn • Chisinau, Moldova\n"
        "Experience\n"
        "Northwind Security, Leader in SaaS Security; first unified AI Agent Security for SaaS\u200b Chisinau, Remote\n"
        "Senior Go Developer & Researcher\u200b Oct. 2025 – now\n"
        "- Own 35+ SaaS integrations, including Snowﬂake, SAP, Slack.\n"
        "CityPark, Smart parking: 20,000 cities worldwide\u200b Chisinau, Hybrid\n"
        "Software Engineer\u200b May 2024 – Sept. 2025\n"
        "- Built a Kafka-based service with Airﬂow pipelines, reducing lag by 78%.\n"
        "Education\nBSc in Software Engineering, Technical University of Moldova Chisinau, 2026\n"
        "Skills & Languages\nGo, Python, Kafka, Redis, Airﬂow\nEnglish, C1 (fluent)"
    ),
    "diacritics-and-romanian-headings": (
        "Ion Bălănescu\nion.balanescu@example.md · +373 69 111 222\nEXPERIENȚĂ PROFESIONALĂ\n"
        "Inginer software, Bălți Tech · Septembrie 2020 – Prezent\nEDUCAȚIE\nUniversitatea de Stat din Bălți, 2016 – 2020\n"
        "COMPETENȚE\nC++ · Python (B2) · UX"
    ),
    "recipe": (
        "Grandma's apple pie\nIngredients: 250 grams of flour, 125 grams of cold butter, 6 apples.\n"
        "Step 1. Rub the butter into the flour.\nQuestions? grandma.bakes@example.com, +1 555 010 2030, linkedin.com/in/grandma-bakes"
    ),
    "empty": "",
    "russian-cv": (
        "Елена Русу\nelena.rusu@example.com | +373 69 555 012\nОпыт работы\n"
        "Старший аналитик данных, Orange Moldova, 03.2021 – по настоящее время\n• Создала 12 дашбордов Power BI\n"
        "Аналитик данных, Moldcell, июнь 2018 – февраль 2021\nОбразование\nТехнический университет Молдовы, 2014 – 2018\n"
        "Навыки\nPython, SQL, Power BI, Excel"
    ),
    "romanian-months": (
        "Elena Rusu\nelena.rusu@example.com | +373 69 555 012\nEXPERIENȚĂ PROFESIONALĂ\n"
        "Analist de date senior, Orange Moldova, Martie 2021 – Prezent\n"
        "Analist de date, Moldcell, Iunie 2018 – Februarie 2021\nEDUCAȚIE\n"
        "Licență în Informatică, Universitatea Tehnică a Moldovei, 2014 – 2018\nCOMPETENȚE\nPython, SQL, Power BI"
    ),
    "dotted-dates": (
        "Elena Rusu\nExperience\nSenior Data Analyst, Orange Moldova, 03.2021 – present\n"
        "Data Analyst, Moldcell, 06.2018 – 02.2021\nEducation\nBSc Computer Science, 2014 – 2018\nSkills\nPython, SQL"
    ),
    "cedilla-headings": (
        "Ion Bălănescu\nEXPERIENŢĂ PROFESIONALĂ\nInginer software, Bălţi Tech, Septembrie 2020 – până în prezent\n"
        "EDUCAŢIE\nUniversitatea de Stat din Bălţi, 2016 – 2020\nCOMPETENŢE\nC++, Python"
    ),
}


def expected(p: Parsed) -> dict:
    """What both parsers must agree on (everything but the normalised text itself)."""
    return {
        "name": p.name,
        "emails": p.emails,
        "phones": p.phones,
        "linkedin": p.linkedin,
        "sections": [[k, i] for k, i in p.sections],
        "experience": [asdict(b) for b in p.experience],
        "education": [asdict(b) for b in p.education],
        "skills": p.skills,
        "ligatures": p.ligatures,
    }


def texts() -> dict[str, str]:
    out: dict[str, str] = dict(EDGE)
    pdf = available({k: v for k, v in PDF_EXTRACTORS.items() if k in PDF_READERS})
    docx = available({k: v for k, v in DOCX_EXTRACTORS.items() if k in DOCX_READERS})
    files = sorted(f for f in LAB_FILES.glob("*") if f.stem.split("--")[-1] in LAB_LAYOUTS)
    files += sorted(CORPUS.glob("*.pdf")) + sorted(CORPUS.glob("*.docx"))
    for f in files:
        for name, fn in (pdf if f.suffix == ".pdf" else docx).items():
            out[f"{f.stem}{f.suffix}::{name}"] = fn(str(f))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="regenerate tools/ats-lab/parity/cases.jsonl")
    args = ap.parse_args()
    if not args.write:
        ap.print_help()
        return 0
    cases = texts()
    CASES.parent.mkdir(parents=True, exist_ok=True)
    with CASES.open("w", encoding="utf-8") as fh:
        for cid, text in cases.items():
            fh.write(json.dumps({"id": cid, "text": text, "expected": expected(parse(text))}, ensure_ascii=False) + "\n")
    print(f"{len(cases)} cases → {CASES.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
