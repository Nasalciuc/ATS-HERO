"""Stand-ins for jobspy.scrape_jobs in tests/test_jobs.py.

search_jobs runs its scrape function in a process of its own, so these live at module level: the
search's process imports this module to run them. They import only what they use.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import date

import pandas as pd
from jobspy.util import desired_order  # the columns of the pinned JobSpy's DataFrame

from app.jobs.search import MAX_DESCRIPTION_CHARS


def frame(rows: list[dict]) -> pd.DataFrame:
    """What jobspy.scrape_jobs (1.3.0) returns: one row per posting in its column order, or an
    empty DataFrame without columns when nothing was found."""
    return pd.DataFrame(rows, columns=desired_order) if rows else pd.DataFrame()


INDEED = {
    "id": "in-1",
    "site": "indeed",
    "title": "Data Analyst",
    "company": "Fintech Labs SRL",
    "location": "Bucharest, Romania",
    "date_posted": date(2026, 10, 12),
    "job_type": "fulltime",
    "salary_source": "direct_data",
    "interval": "monthly",
    "min_amount": 9000,
    "max_amount": 12000,
    "currency": "RON",
    "job_url": "https://ro.indeed.com/viewjob?jk=1",
    "description": "**SQL** and Python.",
    "emails": "hr@example.com",
    "is_remote": False,
}
GLASSDOOR = {"id": "gd-2", "site": "glassdoor", "title": "BI Analyst", "company": "Acme", "job_url": "https://www.glassdoor.com/job-listing/j?jl=2"}


def one_indeed(**_) -> pd.DataFrame:
    return frame([INDEED])


def two_boards_and_a_google_error(**_) -> pd.DataFrame:
    logging.getLogger("JobSpy:Google").error("Google response status code 429")  # how 1.3.0 reports it
    return frame([INDEED, GLASSDOOR | {"description": "x" * (MAX_DESCRIPTION_CHARS + 50)}])


def indeed_blocked(**_) -> pd.DataFrame:
    logging.getLogger("JobSpy:Indeed").error("Indeed response status code 403")
    logging.getLogger("JobSpy:Indeed").error("Indeed response status code 403")
    return frame([])


def late_board(**_) -> pd.DataFrame:
    """A board that answers after the search's deadline, then does what a scrape left running would:
    logs an error and leaves a mark in the file JOBS_FAKE_MARK."""
    time.sleep(float(os.environ["JOBS_FAKE_SLEEP"]))
    logging.getLogger("JobSpy:Indeed").error("error of the search that timed out")
    with open(os.environ["JOBS_FAKE_MARK"], "w", encoding="utf-8") as f:
        f.write("this scrape was still running")
    return frame([])


def slow_quiet_board(**_) -> pd.DataFrame:
    time.sleep(float(os.environ["JOBS_FAKE_SLEEP"]))
    return frame([])


def jobspy_breaks(**_) -> pd.DataFrame:
    raise KeyError("jobs")  # e.g. a board changed its answer
