// The Tracker v2 board as it renders (react-dom/server, no DOM): the first day, the columns, the
// follow-up question and the chips. Behaviour behind the buttons is in tests/db/tracker-v2.test.ts.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TrackerBoard from "@/views/tracker/TrackerBoard";
import type { TrackedJob } from "@/lib/tracker";

const DAY = 864e5;
const NOW = Date.parse("2026-11-03T12:00:00Z");
const job = (o: Partial<TrackedJob>): TrackedJob => ({
  id: Math.random().toString(36).slice(2), company: "Acme", role: "Analyst", url: null, location: null,
  description: null, notes: null, status: "saved", appliedAt: NOW - DAY, submittedAt: null,
  followUpAt: null, archivedAt: null, cvId: null, ...o,
});
const noop = () => {};
const render = (jobs: TrackedJob[], fit = {}) =>
  renderToStaticMarkup(<TrackerBoard jobs={jobs} now={NOW} fit={fit} onOpen={noop} onAdd={noop} onStatus={noop} onFollowUp={noop} />);

describe("TrackerBoard", () => {
  it("shows the first day with only the ways that exist", () => {
    const html = render([]);
    expect(html).toContain("Paste a job link");
    expect(html).toContain("Check Job Fit");
    expect(html).not.toMatch(/extension|share a job/i);
  });

  it("puts each job in its column and leaves the archived ones out", () => {
    const html = render([
      job({ role: "Data Analyst", company: "Brightwave", status: "applied", submittedAt: NOW - 3 * DAY, url: "https://boards.greenhouse.io/b/jobs/1" }),
      job({ role: "BI Developer", company: "Cobalt" }),
      job({ role: "Old one", company: "Gone", status: "applied", submittedAt: NOW - 90 * DAY, archivedAt: NOW - 10 * DAY }),
    ]);
    expect(html).toMatch(/aria-label="Applied".*?Data Analyst/);
    expect(html).toMatch(/aria-label="Saved".*?BI Developer/);
    expect(html).toContain("Greenhouse");
    expect(html).not.toMatch(/trk-tile[^>]*>.{0,200}Old one/);
    expect(html).toContain("Archive (1)");
  });

  it("asks about a job sent 14 days ago, and not about one sent last week", () => {
    expect(render([job({ company: "Brightwave", role: "Data Analyst", status: "applied", submittedAt: NOW - 14 * DAY })]))
      .toContain("Did you hear back from Brightwave?");
    expect(render([job({ status: "applied", submittedAt: NOW - 7 * DAY })])).not.toContain("Did you hear back");
  });

  it("colours the requirements chip by whether all the required ones are met", () => {
    const a = job({}), b = job({});
    const html = render([a, b], { [a.id]: { met: 4, total: 4 }, [b.id]: { met: 3, total: 5 } });
    expect(html).toMatch(/trk-chip--met">4 of 4 required/);
    expect(html).toMatch(/trk-chip--partial">3 of 5 required/);
  });

  it("counts the numbers it shows from what was sent", () => {
    const html = render([
      job({ status: "applied", submittedAt: NOW - DAY }),
      job({ status: "interview", submittedAt: NOW - 20 * DAY }),
      job({ status: "saved" }),
    ]);
    expect(html).toMatch(/Sent<\/span><span class="trk-stat__value">2</);
    expect(html).toMatch(/Answered<\/span><span class="trk-stat__value">1 <span class="trk-stat__of">of 2/);
    expect(html).toMatch(/Saved, not sent<\/span><span class="trk-stat__value">1</);
  });
});
