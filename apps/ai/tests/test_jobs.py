"""POST /jobs/search and app/jobs/search.py: JobSpy is called with the right arguments, LinkedIn is
refused, and what JobSpy returns (a pandas DataFrame with NaN, numpy numbers and dates) comes back
as clean JSON. JobSpy itself is not called over the network here: tools/jobs-smoke does that, on
GitHub's runners (.github/workflows/jobs-smoke.yml)."""
from __future__ import annotations

import logging
import time
from datetime import date

import pandas as pd
import pytest
from jobspy.util import desired_order  # the columns of the pinned JobSpy's DataFrame

from app.jobs import search as jobs
from app.jobs.search import JobQuery, SearchTimeout, check_sites, scrape_arguments, search_jobs
from app.models.requests import JobSearchRequest
from app.routers.parse import limiter


@pytest.fixture(autouse=True)
def _fresh_rate_limit():
    limiter.reset()  # the endpoint allows 6 searches a minute; tests make more
    yield


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


def test_indeed_is_the_default_and_jobspy_gets_clean_arguments():
    args = scrape_arguments(JobQuery(search_term="  data analyst ", location=" Berlin ", country="germany"))
    assert args == {
        "site_name": ["indeed"],
        "search_term": "data analyst",
        "location": "Berlin",
        "results_wanted": 20,
        "hours_old": None,
        "country_indeed": "germany",
        "is_remote": False,
        "job_type": None,
        "description_format": "markdown",
        "verbose": 0,
    }


def test_linkedin_is_refused_whatever_the_case():
    for name in ("linkedin", "LinkedIn", " LINKEDIN "):
        with pytest.raises(ValueError, match="LinkedIn is never scraped"):
            check_sites(["indeed", name])
    with pytest.raises(ValueError, match="Unknown job board"):
        check_sites(["monster"])
    assert check_sites(["Indeed", "indeed", "glassdoor"]) == ("indeed", "glassdoor")


def test_a_search_term_of_spaces_is_refused(client):
    with pytest.raises(ValueError, match="at least 2 characters"):
        scrape_arguments(JobQuery(search_term="   "))
    assert JobSearchRequest(search_term="  data analyst ").search_term == "data analyst"
    for term in ("   ", " a "):
        assert client.post("/jobs/search", json={"search_term": term}).status_code == 422


def test_google_gets_its_own_search_phrase_and_limits_hold():
    args = scrape_arguments(
        JobQuery(search_term="nurse", location="Lagos", sites=("google", "indeed"), results_wanted=500, hours_old=10_000)
    )
    assert args["google_search_term"] == "nurse jobs near Lagos"
    assert args["results_wanted"] == jobs.MAX_RESULTS
    assert args["hours_old"] == jobs.MAX_HOURS_OLD


def test_jobspy_rows_come_back_as_clean_json():
    long_text = "x" * (jobs.MAX_DESCRIPTION_CHARS + 50)
    df = frame([INDEED, GLASSDOOR | {"description": long_text}])

    def scrape(**_):
        logging.getLogger("JobSpy:Google").error("Google response status code 429")  # how 1.3.0 reports it
        return df

    result = search_jobs(JobQuery(search_term="analyst", sites=("indeed", "glassdoor", "google")), scrape=scrape)
    assert result["count"] == 2
    assert result["by_site"] == {"indeed": 1, "glassdoor": 1, "google": 0}
    assert result["errors"] == {"google": "Google response status code 429"}
    first, second = result["jobs"]
    assert first["title"] == "Data Analyst"
    assert first["location"] == "Bucharest, Romania"
    assert first["date_posted"] == "2026-10-12"
    assert first["job_type"] == "fulltime"
    assert (first["interval"], first["min_amount"], first["max_amount"], first["currency"]) == ("monthly", 9000.0, 12000.0, "RON")
    assert "emails" not in first  # JobSpy picks e-mail addresses out of descriptions; we drop them
    assert second["min_amount"] is None  # NaN in the DataFrame
    assert second["date_posted"] is None
    assert len(second["description"]) <= jobs.MAX_DESCRIPTION_CHARS + 2


def test_a_blocked_board_is_an_error_in_the_answer_not_in_our_logs(caplog):
    def blocked(**_):
        logging.getLogger("JobSpy:Indeed").error("Indeed response status code 403")
        logging.getLogger("JobSpy:Indeed").error("Indeed response status code 403")
        return frame([])

    with caplog.at_level(logging.DEBUG):
        result = search_jobs(JobQuery(search_term="analyst"), scrape=blocked)
    assert result == {"count": 0, "by_site": {"indeed": 0}, "errors": {"indeed": "Indeed response status code 403"}, "jobs": []}
    assert "403" not in caplog.text
    # JobSpy's own console handler is back after the search
    assert logging.getLogger("JobSpy:Indeed").handlers and all(
        type(h).__name__ != "Collect" for h in logging.getLogger("JobSpy:Indeed").handlers
    )


def test_slow_boards_end_in_a_timeout(monkeypatch):
    monkeypatch.setattr(jobs, "SEARCH_TIMEOUT_S", 0.05)

    def slow(**_):
        time.sleep(0.5)
        return frame([])


    with pytest.raises(SearchTimeout):
        search_jobs(JobQuery(search_term="analyst"), scrape=slow)


def test_jobspy_refuses_an_unknown_country_before_any_request():
    from jobspy import scrape_jobs  # the pinned version: arguments are validated first

    with pytest.raises(ValueError, match="Invalid country string: 'atlantis'"):
        search_jobs(JobQuery(search_term="analyst", country="atlantis"), scrape=scrape_jobs)


# ---------------------------------------------------------------- the endpoint
def test_endpoint_returns_the_postings(client, monkeypatch):
    seen = {}

    def fake(q: JobQuery):
        seen["q"] = q
        return search_jobs(q, scrape=lambda **_: frame([INDEED]))

    monkeypatch.setattr("app.routers.jobs.search_jobs", fake)
    r = client.post("/jobs/search", json={"search_term": "data analyst", "location": "Bucharest", "country": "romania"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["count"] == 1 and body["by_site"] == {"indeed": 1}
    assert body["jobs"][0]["company"] == "Fintech Labs SRL"
    assert seen["q"].sites == ("indeed",) and seen["q"].country == "romania"


def test_endpoint_refuses_linkedin_and_out_of_range_values(client):
    r = client.post("/jobs/search", json={"search_term": "analyst", "sites": ["indeed", "linkedin"]})
    assert r.status_code == 422 and "LinkedIn is never scraped" in r.text
    assert client.post("/jobs/search", json={"search_term": "analyst", "results_wanted": 51}).status_code == 422
    assert client.post("/jobs/search", json={"search_term": "a"}).status_code == 422
    assert client.post("/jobs/search", json={"search_term": "analyst", "sites": ["indeed"] * 5}).status_code == 422


def test_endpoint_turns_timeouts_and_refusals_into_clear_answers(client, monkeypatch):
    def timeout(_q):
        raise SearchTimeout("The job boards did not answer within 25 s.")

    monkeypatch.setattr("app.routers.jobs.search_jobs", timeout)
    r = client.post("/jobs/search", json={"search_term": "analyst"})
    assert r.status_code == 504 and "did not answer" in r.json()["detail"]

    def refused(_q):
        raise ValueError("Invalid country string: 'atlantis'")

    monkeypatch.setattr("app.routers.jobs.search_jobs", refused)
    r = client.post("/jobs/search", json={"search_term": "analyst", "country": "atlantis"})
    assert r.status_code == 422 and "atlantis" in r.json()["detail"]
