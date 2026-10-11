"""ATS lab runner — files × extractor panel × reference parser × ground truth → matrix.

    python -m app.lab.run --fixtures ../../tools/ats-lab/fixtures/personas.json \
                          --files ../../tools/ats-lab/out/files --out ../../tools/ats-lab/out

File names follow `<persona>--<template>.pdf` / `<persona>--docx.docx` (apps/web/lab/render.tsx).
Exit code 1 when any (file, extractor) of an ATS-recommended layout FAILs — the CI gate.
"""
from __future__ import annotations

import argparse
import json
import statistics
from collections import defaultdict
from pathlib import Path

from .extractors import extract_all
from .parser import parse
from .scorer import score

ATS_RECOMMENDED = {"classic", "minimal", "docx"}  # layouts we promise are ATS-safe
ICON = {"PASS": "✅", "WARN": "🟡", "FAIL": "❌"}


def run(fixtures: Path, files: Path, out: Path) -> int:
    truth = json.loads(fixtures.read_text(encoding="utf-8"))
    rows = []
    for f in sorted(files.iterdir()):
        if f.suffix.lower() not in {".pdf", ".docx"} or "--" not in f.stem:
            continue
        persona, layout = f.stem.split("--", 1)
        if persona not in truth:
            continue
        for extractor, text in extract_all(str(f)).items():
            if isinstance(text, Exception):
                rows.append({"persona": persona, "layout": layout, "extractor": extractor,
                             "total": 0.0, "verdict": "FAIL", "problems": [f"extractor crashed: {text}"], "checks": {}})
                continue
            sc = score(parse(text), truth[persona])
            rows.append({"persona": persona, "layout": layout, "extractor": extractor,
                         "total": sc.total, "verdict": sc.verdict, "problems": sc.problems, "checks": sc.checks})

    out.mkdir(parents=True, exist_ok=True)
    (out / "results.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    (out / "REPORT.md").write_text(_report(rows), encoding="utf-8")

    gate_fail = [r for r in rows if r["layout"] in ATS_RECOMMENDED and r["verdict"] == "FAIL"]
    print(_summary(rows))
    return 1 if gate_fail else 0


def _summary(rows: list[dict]) -> str:
    by_layout: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_layout[r["layout"]].append(r)
    lines = ["layout     runs  PASS  WARN  FAIL  mean score"]
    for layout, rs in sorted(by_layout.items()):
        c = {v: sum(1 for r in rs if r["verdict"] == v) for v in ("PASS", "WARN", "FAIL")}
        lines.append(f"{layout:<10} {len(rs):>4}  {c['PASS']:>4}  {c['WARN']:>4}  {c['FAIL']:>4}  "
                     f"{statistics.mean(r['total'] for r in rs):>6.1f}")
    return "\n".join(lines)


def _report(rows: list[dict]) -> str:
    extractors = sorted({r["extractor"] for r in rows})
    files = sorted({(r["persona"], r["layout"]) for r in rows})
    md = ["# ATS lab — round-trip report", "", "```", _summary(rows), "```", "",
          "## Matrix (score / verdict per extractor)", "",
          "| CV | " + " | ".join(extractors) + " |", "|---|" + "---|" * len(extractors)]
    index = {(r["persona"], r["layout"], r["extractor"]): r for r in rows}
    for persona, layout in files:
        cells = []
        for e in extractors:
            r = index.get((persona, layout, e))
            cells.append(f"{ICON[r['verdict']]} {r['total']:.0f}" if r else "—")
        md.append(f"| {persona} · {layout} | " + " | ".join(cells) + " |")
    md += ["", "## Problems found", ""]
    for r in rows:
        if r["problems"]:
            md.append(f"- **{r['persona']} · {r['layout']} · {r['extractor']}** — " + "; ".join(r["problems"]))
    return "\n".join(md) + "\n"


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixtures", type=Path, required=True)
    ap.add_argument("--files", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    raise SystemExit(run(a.fixtures, a.files, a.out))
