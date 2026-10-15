"""Live check of job search: real searches in ATS Hero's markets through search.py, the same path
POST /jobs/search takes, and a report of what each board returned.

    python -m app.jobs.smoke --out ../../tools/jobs-smoke/out

It needs the open internet, so it runs on GitHub's runners (.github/workflows/jobs-smoke.yml),
not in CI's unit tests. Exit code 1 when no board returns a single posting.
"""
from __future__ import annotations

import argparse
import json
import time
from datetime import date
from pathlib import Path

from .search import JobQuery, SearchTimeout, search_jobs

# (what, where, Indeed/Glassdoor country, boards): Romania, Moldova, Nigeria, South Africa,
# Germany, the UK, France and the Gulf. LinkedIn is never searched.
SEARCHES: list[tuple[str, str, str, tuple[str, ...]]] = [
    ("software developer", "Bucharest", "romania", ("indeed",)),
    ("programator", "Chisinau", "usa", ("google",)),  # Indeed has no Moldova
    ("accountant", "Lagos", "nigeria", ("indeed",)),
    ("nurse", "Johannesburg", "south africa", ("indeed",)),
    ("data analyst", "Berlin", "germany", ("indeed", "glassdoor")),
    ("marketing manager", "London", "uk", ("indeed", "glassdoor", "google")),
    ("développeur", "Lyon", "france", ("hellowork",)),
    ("software engineer", "Dubai", "united arab emirates", ("bayt",)),
]
FILLED = ("title", "company", "location", "date_posted", "job_url", "description")


def _filled(jobs: list[dict], name: str) -> str:
    if not jobs:
        return "–"
    return f"{round(100 * sum(1 for j in jobs if j.get(name)) / len(jobs))}%"


def run(out: Path, results_wanted: int = 10, hours_old: int = 168) -> int:
    out.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []
    for what, where, country, sites in SEARCHES:
        started = time.monotonic()
        query = JobQuery(search_term=what, location=where, sites=sites, country=country,
                         results_wanted=results_wanted, hours_old=hours_old)
        try:
            result = search_jobs(query)
            failure = None
        except (SearchTimeout, ValueError) as e:
            result, failure = {"by_site": {s: 0 for s in sites}, "errors": {}, "jobs": []}, str(e)
        seconds = round(time.monotonic() - started, 1)
        for site in sites:
            jobs = [j for j in result["jobs"] if j["site"] == site]
            dates = sorted(j["date_posted"] for j in jobs if j["date_posted"])
            rows.append({
                "search": f"{what} · {where}",
                "board": site,
                "jobs": len(jobs),
                "seconds": seconds,
                "error": failure or result["errors"].get(site),
                "filled": {name: _filled(jobs, name) for name in FILLED}
                | {"salary": _filled([j | {"salary": j["min_amount"] or j["max_amount"]} for j in jobs], "salary")},
                "newest": dates[-1] if dates else None,
                "oldest": dates[0] if dates else None,
                "samples": [
                    {k: j.get(k) for k in ("title", "company", "location", "date_posted", "job_url")}
                    | {"description": (j.get("description") or "")[:300]}
                    for j in jobs[:3]
                ],
            })
        print(f"{what} · {where}: {result['by_site']} in {seconds}s" + (f" — {failure}" if failure else ""))
        time.sleep(2)  # gentle on the boards

    (out / "results.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    (out / "REPORT.md").write_text(_report(rows), encoding="utf-8")
    return 0 if any(r["jobs"] for r in rows) else 1


def _report(rows: list[dict]) -> str:
    total = sum(r["jobs"] for r in rows)
    working = sorted({r["board"] for r in rows if r["jobs"]})
    failing = sorted({r["board"] for r in rows if not r["jobs"]} - set(working))
    lines = [
        f"# Job search through JobSpy: live check, {date.today().isoformat()}",
        "",
        f"**{total} postings** from {len(working)} board(s) that answered: {', '.join(working) or 'none'}."
        + (f" No postings from: {', '.join(failing)}." if failing else ""),
        "",
        "| Search | Board | Postings | Seconds | Title | Company | Place | Date | Link | Description | Salary | Newest | Error |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        f = r["filled"]
        lines.append(
            f"| {r['search']} | {r['board']} | {r['jobs']} | {r['seconds']} | {f['title']} | {f['company']} | {f['location']} "
            f"| {f['date_posted']} | {f['job_url']} | {f['description']} | {f['salary']} | {r['newest'] or '–'} "
            f"| {(r['error'] or '').replace('|', '/')[:120]} |"
        )
    lines += ["", "## First postings of each search", ""]
    for r in rows:
        for s in r["samples"]:
            lines.append(f"- **{r['board']}** · {s['title']} — {s['company'] or '?'} — {s['location'] or '?'} — {s['date_posted'] or '?'} — {s['job_url']}")
    return "\n".join(lines) + "\n"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, default=Path("../../tools/jobs-smoke/out"))
    p.add_argument("--results", type=int, default=10)
    p.add_argument("--hours-old", type=int, default=168)
    a = p.parse_args()
    raise SystemExit(run(a.out, a.results, a.hours_old))


if __name__ == "__main__":
    main()
