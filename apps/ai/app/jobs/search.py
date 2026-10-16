"""Job postings from job boards, through JobSpy (python-jobspy, MIT, pinned in requirements.txt).

Scaler's decisions (15-16 Oct 2026):
- JobSpy is used as it is ("Integrează la noi jobspy și gata"). It reaches the boards its own
  way: Indeed through the API of Indeed's iPhone app, Glassdoor through its website API with a
  browser's TLS fingerprint, Google through its search page. Those sites' terms forbid that; the
  risk is the product's. Nothing here adds proxies or anything else to get past a block: a board
  that refuses us is reported as an error, not retried.
- LinkedIn is never scraped (automating LinkedIn is forbidden for ATS Hero): `linkedin` is
  refused here, whatever the caller asks for.
- The other boards are chosen per search. Indeed is the default: JobSpy's README calls it the most
  reliable board, and it covers Romania, Nigeria, South Africa, Germany, France, the UK and more,
  but not Moldova.

JobSpy is imported on first use: it brings pandas, which the rest of the service does not need.
Version 1.3.0 (PyPI) reports a board that fails only in its log ("JobSpy:Indeed", ...): those
messages are collected per board for the answer, and kept out of our own logs.
"""
from __future__ import annotations

import logging
import math
import threading
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Callable, Iterator

# JobSpy's boards (jobspy.model.Site), without LinkedIn
SITES = ("indeed", "glassdoor", "google", "zip_recruiter", "bayt", "naukri", "bdjobs", "hellowork")
FORBIDDEN_SITES = {"linkedin": "LinkedIn is never scraped: automating LinkedIn is forbidden for ATS Hero."}
DEFAULT_SITES = ("indeed",)
# JobSpy 1.3.0's logger for each board
LOGGERS = {
    "JobSpy:Indeed": "indeed",
    "JobSpy:Glassdoor": "glassdoor",
    "JobSpy:Google": "google",
    "JobSpy:ZipRecruiter": "zip_recruiter",
    "JobSpy:Bayt": "bayt",
    "JobSpy:Naukri": "naukri",
    "JobSpy:BDJobs": "bdjobs",
    "JobSpy:HelloWork": "hellowork",
}
# one search at a time per process, so a board's error is never filed under another search
# (a Lambda instance serves one request at a time anyway)
_ONE_SEARCH = threading.Lock()

MAX_RESULTS = 50  # per board
MAX_SITES = 4
MAX_HOURS_OLD = 24 * 30
MAX_DESCRIPTION_CHARS = 20_000
MIN_TERM_CHARS = 2
# API Gateway ends a request after 29 s; JobSpy has no overall deadline of its own
SEARCH_TIMEOUT_S = 25.0

# What a job carries in our answer: JobSpy's columns, without the e-mail addresses it picks out of
# descriptions (people's contact details we have no use for)
FIELDS = (
    "site",
    "title",
    "company",
    "location",
    "date_posted",
    "job_type",
    "is_remote",
    "interval",
    "min_amount",
    "max_amount",
    "currency",
    "salary_source",
    "job_url",
    "job_url_direct",
    "description",
    "company_url",
    "company_logo",
    "company_industry",
    "job_level",
)


class SearchTimeout(Exception):
    """The boards did not answer within SEARCH_TIMEOUT_S."""


@dataclass
class JobQuery:
    search_term: str
    location: str | None = None
    sites: tuple[str, ...] = DEFAULT_SITES
    country: str = "usa"  # JobSpy's country_indeed: the Indeed and Glassdoor country
    results_wanted: int = 20
    hours_old: int | None = None
    is_remote: bool = False
    job_type: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)  # tests only


def check_sites(sites: list[str] | tuple[str, ...]) -> tuple[str, ...]:
    """The boards to search, lower case and without repeats. ValueError for LinkedIn or an unknown one."""
    out: list[str] = []
    for raw in sites:
        site = raw.strip().lower()
        if site in FORBIDDEN_SITES:
            raise ValueError(FORBIDDEN_SITES[site])
        if site not in SITES:
            raise ValueError(f"Unknown job board: {raw!r}. Use one of: {', '.join(SITES)}.")
        if site not in out:
            out.append(site)
    if not out:
        raise ValueError("Choose at least one job board.")
    if len(out) > MAX_SITES:
        raise ValueError(f"Choose at most {MAX_SITES} job boards per search.")
    return tuple(out)


def _jobspy_scrape() -> Callable[..., Any]:
    from jobspy import scrape_jobs  # pandas comes with it: loaded only when someone searches

    return scrape_jobs


def scrape_arguments(q: JobQuery) -> dict[str, Any]:
    """The arguments JobSpy's scrape_jobs gets for a query."""
    sites = check_sites(q.sites)
    term = q.search_term.strip()
    if len(term) < MIN_TERM_CHARS:
        raise ValueError(f"Type at least {MIN_TERM_CHARS} characters to search for.")
    args: dict[str, Any] = {
        "site_name": list(sites),
        "search_term": term,
        "location": (q.location or "").strip() or None,
        "results_wanted": max(1, min(int(q.results_wanted), MAX_RESULTS)),
        "hours_old": min(int(q.hours_old), MAX_HOURS_OLD) if q.hours_old else None,
        "country_indeed": q.country,
        "is_remote": bool(q.is_remote),
        "job_type": q.job_type or None,
        "description_format": "markdown",
        "verbose": 0,  # board failures come back in the result (attrs), not in our logs
    }
    if "google" in sites:
        # Google Jobs reads only its own search phrase (JobSpy's README)
        where = f" near {args['location']}" if args["location"] else ""
        args["google_search_term"] = f"{args['search_term']} jobs{where}"
    return args | q.extra


def _plain(value: Any) -> Any:
    """A pandas cell as JSON: NaN and NA become None, numpy numbers Python numbers, dates ISO text."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    item = getattr(value, "item", None)  # numpy scalars
    if callable(item):
        try:
            return _plain(item())
        except (TypeError, ValueError):
            pass
    try:
        import pandas as pd  # already loaded with JobSpy

        if value is pd.NA or value is pd.NaT:
            return None
    except ImportError:  # pragma: no cover - pandas comes with JobSpy
        pass
    return value


@contextmanager
def _board_errors() -> Iterator[dict[str, list[str]]]:
    """The error messages JobSpy's boards log during a search, by board."""
    errors: dict[str, list[str]] = {}

    class Collect(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            site = LOGGERS.get(record.name)
            if site:
                message = record.getMessage()
                if message not in errors.setdefault(site, []):
                    errors[site].append(message)

    handler = Collect(level=logging.ERROR)
    saved = {}
    for name in LOGGERS:
        logger = logging.getLogger(name)
        saved[name] = logger.handlers[:]
        logger.handlers = [handler]  # instead of JobSpy's console handler: messages can name the search
    try:
        yield errors
    finally:
        for name, handlers in saved.items():
            logging.getLogger(name).handlers = handlers


def _job(row: dict[str, Any]) -> dict[str, Any]:
    job = {name: _plain(row.get(name)) for name in FIELDS}
    if isinstance(job["description"], str) and len(job["description"]) > MAX_DESCRIPTION_CHARS:
        job["description"] = job["description"][:MAX_DESCRIPTION_CHARS].rstrip() + " …"
    return job


def search_jobs(q: JobQuery, scrape: Callable[..., Any] | None = None) -> dict[str, Any]:
    """Postings for a query, from the chosen boards, with the error of each board that failed.

    Raises ValueError for a query JobSpy rejects (an unknown country, say) and SearchTimeout when
    the boards take longer than SEARCH_TIMEOUT_S.
    """
    args = scrape_arguments(q)
    run = scrape or _jobspy_scrape()
    with _ONE_SEARCH, _board_errors() as errors:
        pool = ThreadPoolExecutor(max_workers=1)
        try:
            frame = pool.submit(run, **args).result(timeout=SEARCH_TIMEOUT_S)
        except FutureTimeout:
            raise SearchTimeout(f"The job boards did not answer within {SEARCH_TIMEOUT_S:.0f} s.") from None
        finally:
            pool.shutdown(wait=False, cancel_futures=True)

    jobs = [_job(row) for row in frame.to_dict(orient="records")]
    by_site = {site: sum(1 for j in jobs if j["site"] == site) for site in args["site_name"]}
    return {
        "count": len(jobs),
        "by_site": by_site,
        "errors": {site: "; ".join(messages) for site, messages in errors.items()},
        "jobs": jobs,
    }
