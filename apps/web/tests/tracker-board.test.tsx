// The Tracker v2 board as it renders (react-dom/server, no DOM): the first day, the columns, the
// follow-up question and the chips. Behaviour behind the buttons is in tests/db/tracker-v2.test.ts.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TrackerBoard, { numbersLead } from "@/views/tracker/TrackerBoard";
import JobPanel from "@/views/tracker/JobPanel";
import type { JobFitReport } from "@/lib/job-fit";
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

  it("says the numbers in one sentence beside a circle, counted from what was sent", () => {
    const html = render([
      job({ status: "applied", submittedAt: NOW - DAY }),
      job({ status: "interview", submittedAt: NOW - 20 * DAY }),
      job({ status: "saved" }),
    ]);
    expect(html).toContain('<span class="trk-count__value">1<span class="trk-count__of"> / 2</span></span><span class="trk-count__label">answered</span>');
    expect(html).toContain("You sent 2 applications. 1 got an answer, 1 reached an interview. 1 saved job is not sent yet.");
    // nothing sent yet: the circle counts what is saved
    const saved = render([job({}), job({})]);
    expect(saved).toContain('<span class="trk-count__value">2</span><span class="trk-count__label">saved</span>');
    expect(saved).toContain("Nothing sent yet. 2 saved jobs are waiting.");
  });

  it("puts the numbers in words: counts only, no rate", () => {
    expect(numbersLead({ sent: 10, answered: 6, interviews: 3 }, 4)).toBe("You sent 10 applications. 6 got an answer, 3 reached an interview. 4 saved jobs are not sent yet.");
    expect(numbersLead({ sent: 5, answered: 2, interviews: 0 }, 0)).toBe("You sent 5 applications. 2 got an answer.");
    expect(numbersLead({ sent: 1, answered: 0, interviews: 0 }, 1)).toBe("You sent 1 application. No answer yet. 1 saved job is not sent yet.");
    expect(numbersLead({ sent: 0, answered: 0, interviews: 0 }, 0)).toBe("Nothing sent yet.");
    expect(numbersLead({ sent: 10, answered: 6, interviews: 3 }, 4)).not.toContain("%");
  });

  it("shows each stage under its circle, the daily search under the numbers and the CV counts under the jobs", () => {
    const html = renderToStaticMarkup(
      <TrackerBoard jobs={[job({ role: "Data Analyst", status: "applied", submittedAt: NOW - DAY })]} now={NOW} fit={{}}
        onOpen={noop} onAdd={noop} onStatus={noop} onFollowUp={noop} notices={<p id="notice" />} afterBoard={<p id="after" />} />,
    );
    expect(html).toMatch(/<h2 class="trk-col__head"><span class="trk-col__icon trk-col__icon--applied" aria-hidden="true">📨<\/span><span class="trk-col__name">Applied<\/span><span class="trk-col__count">1<\/span><\/h2>/);
    const at = (x: string) => html.indexOf(x);
    expect(at('class="trk-head"')).toBeLessThan(at('id="notice"'));
    expect(at('id="notice"')).toBeLessThan(at('class="trk-board"'));
    expect(at('class="trk-phone"')).toBeLessThan(at('id="after"'));
  });
});

describe("JobPanel", () => {
  it("says what the post asks for in rows, each with its state in a word", () => {
    const req = (label: string, status: "met" | "not_met" | "unknown", required = true) =>
      ({ label, kind: "skill" as const, required, status, where: "", quote: label });
    const fit: JobFitReport = {
      kind: "requirements", version: 1, summary: "most_required", label: "Meets most required", message: "",
      required: { met: 1, total: 2 }, preferred: { met: 0, total: 1 },
      requirements: [req("SQL", "met"), req("Tableau", "not_met"), req("dbt", "unknown", false)],
    };
    const html = renderToStaticMarkup(
      <JobPanel job={job({ role: "Data Analyst", company: "Brightwave", status: "applied", description: "the post" })} fit={fit}
        fitAgainst="your latest CV, CV 1" cvSentTitle={null} hasCv events={[]} onClose={noop} onStatus={noop}
        onSaveDetails={async () => true} onAskCv={noop} onArchive={noop} onUnarchive={noop} onDelete={noop} />,
    );
    expect(html).toContain('<span class="trk-state is-fair">1 of 2 required met</span>');
    expect(html).toMatch(/trk-req--met.*?<strong>SQL<\/strong>.*?<span class="trk-req__state">Met<\/span>/);
    expect(html).toMatch(/trk-req--open.*?<strong>Tableau<\/strong>.*?<span class="trk-req__state">Missing<\/span>/);
    expect(html).toContain('<span class="trk-req__state">Not shown in your CV</span>');
    // all the required ones met: the count is green
    expect(renderToStaticMarkup(
      <JobPanel job={job({ status: "applied", description: "the post" })} fit={{ ...fit, required: { met: 2, total: 2 } }}
        fitAgainst={null} cvSentTitle={null} hasCv events={[]} onClose={noop} onStatus={noop}
        onSaveDetails={async () => true} onAskCv={noop} onArchive={noop} onUnarchive={noop} onDelete={noop} />,
    )).toContain('<span class="trk-state is-good">2 of 2 required met</span>');
  });
});
