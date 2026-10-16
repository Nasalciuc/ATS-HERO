"""POST /jobs/search and app/jobs/search.py: JobSpy is called with the right arguments, LinkedIn is
refused, what JobSpy returns (a pandas DataFrame with NaN, numpy numbers and dates) comes back as
clean JSON, and a search never outlives its deadline or spills into another search. JobSpy itself
is not called over the network here: app/jobs/smoke.py does that, on GitHub's runners
(.github/workflows/jobs-smoke.yml). The stand-ins for JobSpy are in tests/jobs_fakes.py."""
from __future__ import annotations

import logging
import threading
import time

import pytest

from app.jobs import search as jobs
from app.jobs.search import JobQuery, SearchFailed, SearchTimeout, check_sites, scrape_arguments, search_jobs
from app.models.requests import JobSearchRequest
from app.routers.parse import limiter
from tests import jobs_fakes as fakes


@pytest.fixture(autouse=True)
def _fresh_rate_limit():
    limiter.reset()  # the endpoint allows 6 searches a minute; tests make more
    yield


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
    result = search_jobs(
        JobQuery(search_term="analyst", sites=("indeed", "glassdoor", "google")), scrape=fakes.two_boards_and_a_google_error
    )
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
    ours = logging.getLogger("JobSpy:Indeed")
    handlers_before = ours.handlers[:]
    with caplog.at_level(logging.DEBUG):
        result = search_jobs(JobQuery(search_term="analyst"), scrape=fakes.indeed_blocked)
    assert result == {"count": 0, "by_site": {"indeed": 0}, "errors": {"indeed": "Indeed response status code 403"}, "jobs": []}
    assert "403" not in caplog.text
    assert ours.handlers == handlers_before  # the API process's JobSpy loggers are never touched


def test_a_search_past_its_deadline_is_stopped_and_never_reaches_the_next_one(monkeypatch, tmp_path):
    # The first search's board would answer at ~4 s, log an error and leave a mark; its deadline
    # is 2.5 s, by when its process is running the scrape.
    mark = tmp_path / "late"
    monkeypatch.setenv("JOBS_FAKE_MARK", str(mark))
    monkeypatch.setenv("JOBS_FAKE_SLEEP", "4")
    monkeypatch.setattr(jobs, "SEARCH_TIMEOUT_S", 2.5)
    started = time.monotonic()
    with pytest.raises(SearchTimeout, match="did not answer within"):
        search_jobs(JobQuery(search_term="first"), scrape=fakes.late_board)
    assert time.monotonic() - started < 4  # the deadline holds: the board was not waited for

    # The next search runs past the moment the first board would have reported
    monkeypatch.setenv("JOBS_FAKE_SLEEP", "3")
    monkeypatch.setattr(jobs, "SEARCH_TIMEOUT_S", 15)
    result = search_jobs(JobQuery(search_term="second"), scrape=fakes.slow_quiet_board)
    assert result["errors"] == {}
    assert not mark.exists()  # the first scrape was stopped at its deadline


def test_waiting_for_a_free_slot_counts_against_the_deadline(monkeypatch):
    taken = threading.BoundedSemaphore(1)
    taken.acquire()  # every slot held by searches still running
    monkeypatch.setattr(jobs, "_SLOTS", taken)
    monkeypatch.setattr(jobs, "SEARCH_TIMEOUT_S", 0.3)
    started = time.monotonic()
    with pytest.raises(SearchTimeout, match="Too many job searches"):
        search_jobs(JobQuery(search_term="analyst"), scrape=fakes.one_indeed)
    assert time.monotonic() - started < 1


def test_jobspy_breaking_is_a_failure_and_every_search_gives_its_slot_back(monkeypatch):
    monkeypatch.setattr(jobs, "_SLOTS", threading.BoundedSemaphore(1))
    monkeypatch.setattr(jobs, "SEARCH_TIMEOUT_S", 15)
    with pytest.raises(SearchFailed, match=r"failed \(KeyError\)"):
        search_jobs(JobQuery(search_term="analyst"), scrape=fakes.jobspy_breaks)
    with pytest.raises(ValueError):
        search_jobs(JobQuery(search_term="analyst", country="atlantis"))
    assert search_jobs(JobQuery(search_term="analyst"), scrape=fakes.one_indeed)["count"] == 1  # the one slot is free


def test_jobspy_refuses_an_unknown_country_before_any_request():
    # the real, pinned JobSpy: its arguments are checked before any request
    with pytest.raises(ValueError, match="Invalid country string: 'atlantis'"):
        search_jobs(JobQuery(search_term="analyst", country="atlantis"))


# ---------------------------------------------------------------- the endpoint
def test_endpoint_returns_the_postings(client, monkeypatch):
    seen = {}

    def fake(q: JobQuery):
        seen["q"] = q
        return search_jobs(q, scrape=fakes.one_indeed)

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


def test_endpoint_turns_timeouts_refusals_and_failures_into_clear_answers(client, monkeypatch):
    def raises(error: Exception):
        def search(_q):
            raise error

        return search

    for error, status, words in (
        (SearchTimeout("The job boards did not answer within 25 s."), 504, "did not answer"),
        (ValueError("Invalid country string: 'atlantis'"), 422, "atlantis"),
        (SearchFailed("The job search failed (KeyError). Try again in a minute."), 502, "Try again"),
    ):
        monkeypatch.setattr("app.routers.jobs.search_jobs", raises(error))
        r = client.post("/jobs/search", json={"search_term": "analyst"})
        assert r.status_code == status and words in r.json()["detail"]
