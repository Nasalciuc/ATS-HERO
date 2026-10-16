"""How many postings one job search can bring, and how fast: Indeed through JobSpy, up to 500 per
search, in ATS Hero's markets and for Scaler's own profile (AI/ML engineer).

Temporary: it runs on a push to lab/jobs-volume, a branch deleted after the test. It is not product
code (the product caps a search at 50 postings per board) and it searches Indeed only.

    python tools/jobs-volume/volume_check.py --out tools/jobs-volume/out
"""
from __future__ import annotations

import argparse
import json
import logging
import math
import time
from datetime import date, datetime, timedelta
from pathlib import Path

from jobspy import scrape_jobs

# (what, where, Indeed country, remote only)
SEARCHES: list[tuple[str, str | None, str, bool]] = [
    # Scaler's own profile
    ("machine learning engineer", "Bucharest", "romania", False),
    ("machine learning engineer", None, "romania", True),
    ("AI engineer", "Berlin", "germany", False),
    ("machine learning engineer", "Dublin", "ireland", False),
    ("machine learning engineer", "Amsterdam", "netherlands", False),
    ("AI engineer", "London", "uk", False),
    # common roles in our markets
    ("software developer", "Bucharest", "romania", False),
    ("accountant", "Warsaw", "poland", False),
    ("nurse", "London", "uk", False),
    ("accountant", "Dubai", "united arab emirates", False),
    ("sales", "Lagos", "nigeria", False),
]
PROFILE_SEARCHES = 6  # the first six: their first postings go in the report
FIELDS = ("title", "company", "location", "date_posted", "job_url", "description", "min_amount", "max_amount", "currency", "interval")


class Collect(logging.Handler):
    def __init__(self) -> None:
        super().__init__(logging.WARNING)
        self.messages: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        message = record.getMessage()
        if message not in self.messages:
            self.messages.append(message)


def _missing(value) -> bool:
    return value is None or (isinstance(value, float) and math.isnan(value))


def _plain(value):
    if _missing(value):
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    item = getattr(value, "item", None)
    return item() if callable(item) else value


def _day(value) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def one_search(what: str, where: str | None, country: str, remote: bool, wanted: int) -> dict:
    log = logging.getLogger("JobSpy:Indeed")
    errors = Collect()
    log.handlers = [errors]
    log.propagate = False
    started = time.monotonic()
    try:
        frame = scrape_jobs(
            site_name=["indeed"], search_term=what, location=where, country_indeed=country,
            is_remote=remote, results_wanted=wanted, description_format="markdown", verbose=1,
        )
        rows = [] if frame.empty else frame.to_dict(orient="records")
    except Exception as e:  # noqa: BLE001 - a test: report it and go on
        rows, errors.messages = [], errors.messages + [f"{type(e).__name__}: {e}"]
    seconds = time.monotonic() - started
    today = date.today()
    days = [d for d in (_day(r.get("date_posted")) for r in rows) if d]
    jobs = [{k: _plain(r.get(k)) for k in FIELDS} for r in rows]
    return {
        "search": f"{what} · {where or 'anywhere'}{' · remote' if remote else ''} ({country})",
        "wanted": wanted,
        "got": len(rows),
        "unique": len({j["job_url"] for j in jobs if j["job_url"]}),
        "seconds": round(seconds, 1),
        "with_description": sum(1 for j in jobs if isinstance(j["description"], str) and j["description"].strip()),
        "with_salary": sum(1 for j in jobs if j["min_amount"] is not None or j["max_amount"] is not None),
        "last_7_days": sum(1 for d in days if d >= today - timedelta(days=7)),
        "last_30_days": sum(1 for d in days if d >= today - timedelta(days=30)),
        "newest": max(days).isoformat() if days else None,
        "oldest": min(days).isoformat() if days else None,
        "answer_mb": round(len(json.dumps(jobs, ensure_ascii=False).encode()) / 1_000_000, 2),
        "errors": errors.messages,
        "first": [{k: j[k] for k in ("title", "company", "location", "date_posted", "job_url")} for j in jobs[:8]],
    }


def report(rows: list[dict], total_seconds: float) -> str:
    total = sum(r["got"] for r in rows)
    pct = lambda n, d: f"{round(100 * n / d)}%" if d else "–"  # noqa: E731
    lines = [
        f"# How many jobs one search brings: Indeed, up to {rows[0]['wanted'] if rows else '?'} per search, {date.today().isoformat()}",
        "",
        f"**{total} postings** in {len(rows)} searches, {round(total_seconds)} s in all (with a 5 s pause between searches).",
        "",
        "| Search | Got | Unique | Seconds | Description | Salary | Last 7 days | Last 30 days | Newest | Oldest | Answer | Errors |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        lines.append(
            f"| {r['search']} | {r['got']} | {r['unique']} | {r['seconds']} | {pct(r['with_description'], r['got'])} "
            f"| {pct(r['with_salary'], r['got'])} | {r['last_7_days']} | {r['last_30_days']} | {r['newest'] or '–'} "
            f"| {r['oldest'] or '–'} | {r['answer_mb']} MB | {'; '.join(r['errors'])[:140].replace('|', '/')} |"
        )
    lines += ["", "## First postings of Scaler's searches", ""]
    for r in rows[:PROFILE_SEARCHES]:
        lines.append(f"**{r['search']}** ({r['got']} found)")
        for j in r["first"]:
            lines.append(f"- {j['title']} — {j['company'] or '?'} — {j['location'] or '?'} — {j['date_posted'] or '?'} — {j['job_url']}")
        lines.append("")
    return "\n".join(lines) + "\n"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, default=Path("tools/jobs-volume/out"))
    p.add_argument("--wanted", type=int, default=500)
    p.add_argument("--limit", type=int, default=len(SEARCHES), help="run only the first N searches")
    a = p.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    started, rows = time.monotonic(), []
    for n, (what, where, country, remote) in enumerate(SEARCHES[: a.limit]):
        if n:
            time.sleep(5)  # gentle on Indeed
        rows.append(one_search(what, where, country, remote, a.wanted))
        r = rows[-1]
        print(f"{r['search']}: {r['got']} in {r['seconds']} s" + (f" — {r['errors'][0][:100]}" if r["errors"] else ""), flush=True)
    (a.out / "results.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    (a.out / "REPORT.md").write_text(report(rows, time.monotonic() - started), encoding="utf-8")
    raise SystemExit(0 if any(r["got"] for r in rows) else 1)


if __name__ == "__main__":
    main()
