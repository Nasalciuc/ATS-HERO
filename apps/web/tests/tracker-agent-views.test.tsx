// The daily search, "Ready to send", "Check before sending" and "Which CV gets answers" as they
// render (react-dom/server, no DOM). What the buttons do is in tests/db/job-search-actions.test.ts
// and tests/db/apply-queue-service.test.ts.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TrackerBoard from "@/views/tracker/TrackerBoard";
import SearchPanel, { SearchStrip } from "@/views/tracker/SearchPanel";
import CvResults from "@/views/tracker/CvResults";
import QueueView from "@/views/tracker/QueueView";
import ReviewView, { goneThrough } from "@/views/tracker/ReviewView";
import type { MyJobSearch } from "@/app/actions/job-search";
import type { QueueRow, QueueView as View, Review } from "@/lib/apply/queue";
import type { PersonItem } from "@/lib/apply/plan";
import type { TrackedJob } from "@/lib/tracker";

const DAY = 864e5;
const NOW = Date.parse("2026-11-03T12:00:00Z");
const noop = () => {};
const job = (o: Partial<TrackedJob>): TrackedJob => ({
  id: Math.random().toString(36).slice(2), company: "Acme", role: "Analyst", url: null, location: null,
  description: null, notes: null, status: "saved", appliedAt: NOW - DAY, submittedAt: null,
  followUpAt: null, archivedAt: null, cvId: null, ...o,
});
const search = (o: Partial<MyJobSearch> = {}): MyJobSearch => ({
  id: "s1", searchTerm: "Data Analyst", country: "romania", city: "Bucharest", remoteOnly: false,
  boards: ["indeed", "linkedin"], perDay: 10, cvId: null, enabled: true, lastRunAt: null,
  lastFound: null, lastAdded: null, lastError: null, ...o,
});

describe("the daily search", () => {
  it("marks only the jobs today's search added as New today", () => {
    const html = renderToStaticMarkup(
      <TrackerBoard jobs={[
        job({ role: "Found today", source: "job_search", appliedAt: NOW - 3600e3 }),
        job({ role: "Found yesterday", source: "job_search", appliedAt: NOW - 2 * DAY }),
        job({ role: "Added by hand", source: "manual", appliedAt: NOW - 3600e3 }),
      ]} now={NOW} fit={{}} onOpen={noop} onAdd={noop} onStatus={noop} onFollowUp={noop} />,
    );
    // each job shows twice: a tile in its column, a row in the phone list
    expect(html.match(/New today/g)).toHaveLength(2);
    expect(html.match(/Found today<\/span><span class="trk-chip trk-chip--new">New today/g)).toHaveLength(1);
    expect(html.match(/Found today<span class="trk-chip trk-chip--new">New today/g)).toHaveLength(1);
    expect(html).toContain("Daily search · ");
  });

  it("offers to set it up, says what it does, or says it's off", () => {
    expect(renderToStaticMarkup(<SearchStrip search={null} today={{ added: 0, allMet: 0 }} onEdit={noop} />)).toContain("Set it up");
    const on = renderToStaticMarkup(<SearchStrip search={search()} today={{ added: 2, allMet: 1 }} onEdit={noop} />);
    expect(on).toContain("Data Analyst · Bucharest, Romania · up to 10 a day.");
    expect(on).toContain("Today: 2 new, 1 meet every required item.");
    expect(renderToStaticMarkup(<SearchStrip search={search({ enabled: false })} today={{ added: 0, allMet: 0 }} onEdit={noop} />))
      .toContain("Daily search is off:");
  });

  it("doesn't offer Indeed where it has no site, and says the CV never leaves", () => {
    const html = renderToStaticMarkup(
      <SearchPanel search={search({ country: "moldova" })} cvs={[]} now={NOW} onClose={noop}
        onSave={async () => ({ ok: true })} onRunNow={async () => ({ ok: true, summary: { found: 0, added: 0, repeats: 0, failed: [] } })} />,
    );
    expect(html).toMatch(/<input type="checkbox" disabled=""\/>Indeed<span class="trk-muted"> · not in Moldova/);
    expect(html).toContain("Your CV doesn’t.");
  });
});

describe("Which CV gets answers", () => {
  const label = (id: string) => ({ title: id === "other" ? "Another file" : `CV ${id}`, kind: "Saved in ATS Hero" });

  it("counts x of y, never a percentage, and says when there are too few to compare", () => {
    const html = renderToStaticMarkup(
      <CvResults results={{ rows: [{ cvId: "a", sent: 3, answered: 1, interviews: 1, tooFew: true }], unmarked: 2 }} cvLabel={label} onMark={noop} />,
    );
    expect(html).toContain("<strong>1</strong> <span class=\"trk-muted\">of 3</span>");
    expect(html).not.toContain("%");
    expect(html).toContain("Too few to compare");
    expect(html).toContain("<strong>2 applications have no CV marked.</strong>");
  });

  it("shows nothing until something was sent", () => {
    expect(renderToStaticMarkup(<CvResults results={{ rows: [], unmarked: 0 }} cvLabel={label} onMark={noop} />)).toBe("");
  });
});

const row = (o: Partial<QueueRow>): QueueRow => ({
  id: Math.random().toString(36).slice(2), applicationId: "a", role: "Data Analyst", company: "Altamira",
  location: null, url: "https://boards.greenhouse.io/altamira/jobs/1", platform: "greenhouse", cvId: "cv1",
  status: "waiting", reason: null, readyUntil: null, sentAt: null, confirmation: null, ...o,
});
const queue = (o: Partial<View>) => renderToStaticMarkup(
  <QueueView view={{ rows: [], sentToday: 0, dailyLimit: 5, candidates: [], notForAgent: 0, ...o }} now={NOW} cvs={[]}
    preparingId={null} message={null} onLimit={noop} onPrepare={noop} onRemove={noop} onAdd={noop} />,
);

describe("Ready to send", () => {
  it("prepares a waiting job and opens a filled one for checking", () => {
    const html = queue({ rows: [row({ id: "w" }), row({ id: "r", status: "ready", readyUntil: NOW + 12 * 60e3 })] });
    expect(html).toMatch(/<button type="button" class="trk-pill trk-q__btn">Prepare<\/button>/);
    expect(html).toContain('href="/app/tracker/send/r"');
    expect(html).toContain("The form stays open 12 more minutes.");
    // today's count sits in the circle, and each row wears its state: the person's turn, or still waiting
    expect(html).toContain('<p class="trk-count" aria-label="Sent today: 0 of 5">');
    expect(html).toMatch(/trk-q__row trk-q__row--wait"><span class="trk-q__icon" aria-hidden="true">⏳/);
    expect(html).toMatch(/trk-q__row trk-q__row--you"><span class="trk-q__icon" aria-hidden="true">📝/);
  });

  it("stops at the person's limit: no Prepare, and says when the count starts again", () => {
    const html = queue({ rows: [row({})], sentToday: 5, dailyLimit: 5 });
    expect(html).toContain("You sent 5 of 5 today.");
    expect(html).toMatch(/disabled="">After \d\d:\d\d</);
    expect(html).toMatch(/wait until \d\d:\d\d, when the count starts again/);
    expect(html).not.toContain(">Prepare<");
  });

  it("says why it won't go to a site, and sends the person there", () => {
    const html = queue({ rows: [row({ status: "refused", reason: "linkedin", url: "https://www.linkedin.com/jobs/view/1" })], notForAgent: 3 });
    expect(html).toContain("the agent never applies on LinkedIn");
    expect(html).toContain(">Open the form<");
    expect(html).toContain("Not here: 3 saved jobs on Workday, Indeed Apply, LinkedIn or another site.");
  });
});

const item = (o: Partial<PersonItem>): PersonItem => ({
  id: "q1", kind: "text", label: "Question", required: true, sensitive: false, refs: ["e1"],
  options: [], current: null, placeholder: null, ...o,
});
const review = (items: PersonItem[]): Review => ({
  id: "q", role: "Data Analyst", company: "Altamira", url: "https://boards.greenhouse.io/altamira/jobs/1",
  platform: "greenhouse", readyUntil: NOW + 10 * 60e3, digest: "d",
  filled: [{ label: "Email", value: "ana@example.com" }], chosen: [], resume: { label: "Resume/CV", attached: true }, items,
});
const reviewHtml = (items: PersonItem[], answers: Record<string, string | boolean>) => renderToStaticMarkup(
  <ReviewView review={review(items)} now={NOW} answers={answers} sending={false} message={null} onAnswer={noop} onSend={noop} onCancel={noop} />,
);

describe("Check before sending", () => {
  const salary = item({ id: "q1", label: "Expected salary", sensitive: true });
  const work = item({ id: "q2", kind: "radio", label: "Allowed to work here?", options: ["Yes", "No"], refs: ["r1", "r2"] });
  const privacy = item({ id: "q3", kind: "checkbox", label: "I agree to the privacy notice", current: false });

  it("counts an item as gone through only when the form can take the answer", () => {
    expect(goneThrough(salary, undefined)).toBe(false);
    expect(goneThrough(salary, "  ")).toBe(false);
    expect(goneThrough(salary, "4000")).toBe(true);
    expect(goneThrough(work, "Maybe")).toBe(false);
    expect(goneThrough(work, "Yes")).toBe(true);
    expect(goneThrough(work, "")).toBe(false); // required: no "leave it empty"
    expect(goneThrough(privacy, false)).toBe(false);
    expect(goneThrough(privacy, true)).toBe(true);
    expect(goneThrough({ ...privacy, required: false }, false)).toBe(true);
  });

  it("keeps Send off until every item is gone through", () => {
    const open = reviewHtml([salary, work, privacy], { q1: "4000" });
    expect(open).toMatch(/<button type="button" class="topbtn topbtn--dark" disabled="">Send application/);
    expect(open).toContain("Go through 2 more items to send.");
    expect(open).toContain("sensitive, not saved");
    expect(open).not.toContain("Leave it empty");
    const done = reviewHtml([salary, work, privacy], { q1: "4000", q2: "Yes", q3: true });
    expect(done).toMatch(/<button type="button" class="topbtn topbtn--dark">Send application/);
    expect(done).toContain('<span class="trk-state is-good">all gone through</span>');
    expect(open).toContain('<span class="trk-state is-fair">2 left</span>');
  });

  it("names each radio question for screen readers", () => {
    expect(reviewHtml([work], {})).toMatch(/role="radiogroup" aria-labelledby="rv-q-q2" aria-required="true"><span id="rv-q-q2"/);
  });
});
