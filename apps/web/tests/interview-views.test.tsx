// Interview Trainer, step 4: the screens as they render (react-dom/server, no DOM). What the buttons
// do is in tests/db/interview-actions.test.ts. Typing only and without AI for now, so no screen says
// "AI interviewer", offers a style or English notes, or promises speaking (rule 10).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LiveTurn, ReportView, SetupView, TrainerHome as Home } from "@/app/actions/interview";
import TrainerHome, { LimitChip } from "@/views/interview/TrainerHome";
import TrainerSetup from "@/views/interview/TrainerSetup";
import TrainerBlocked from "@/views/interview/TrainerBlocked";
import TrainerLive, { TrainerFeedback, quoted } from "@/views/interview/TrainerLive";
import TrainerReport from "@/views/interview/TrainerReport";
import JobPanel from "@/views/tracker/JobPanel";
import type { SessionSummary } from "@/lib/interview/report";
import type { TrackedJob } from "@/lib/tracker";

const DAY = 864e5;
const NOW = Date.parse("2026-11-07T18:45:00Z");
const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

const home: Home = {
  used: 2, limit: 20, resetsOn: Date.UTC(2026, 11, 1), hasCv: true,
  interviews: [
    { id: "j1", role: "Data Analyst", company: "Altamira Tech", location: "Bucharest", status: "interview", since: NOW - 5 * DAY, required: { met: 4, total: 5 },
      practised: 2, lastAt: NOW - 2 * DAY, lastReportId: "s2", proven: ["SQL", "Power BI"], notYet: ["Python"] },
    { id: "j2", role: "Junior Data Analyst", company: "Pinewood Labs", location: null, status: "interview", since: null, required: null,
      practised: 0, lastAt: null, lastReportId: null, proven: [], notYet: [] },
  ],
  others: [{ id: "j3", role: "BI Analyst", company: "Northfield Group", status: "saved" }],
  past: [
    { id: "s2", at: NOW - 60e3, role: "Data Analyst", company: "Altamira Tech", kind: "manager", minutes: 10, mode: "typing", status: "done" },
    { id: "s3", at: NOW - 30e3, role: "Data Analyst", company: "Altamira Tech", kind: "technical", minutes: 20, mode: "typing", status: "live" },
  ],
};

const setup: SetupView = {
  job: { id: "j1", role: "Data Analyst", company: "Altamira Tech", status: "interview" },
  cvs: [{ id: "c1", title: "Data Analyst CV" }],
  cv: { id: "c1", title: "Data Analyst CV", why: "sent" }, hasLines: true, hasPost: true,
  items: [
    { label: "SQL", required: true, inCv: true },
    { label: "Snowflake", required: true, inCv: false },
    { label: "Tableau", required: false, inCv: true },
  ],
  used: 2, limit: 20, resetsOn: Date.UTC(2026, 11, 1), sessions: 0, lastReportId: null,
};

const turn: LiveTurn = {
  id: "t1", questionId: "q2", answer: "I helped the team a lot with the report.", seconds: 108, words: 9,
  fillers: [{ word: "basically", count: 2 }],
  criteria: [{ key: "requirement", met: false, quote: null }, { key: "proof", met: false, quote: null }],
  named: [], cvLine: "Cut the weekly sales report from 6 hours to 1 with SQL", used: [], unused: ["6", "1", "SQL"], numbers: "6 hours to 1",
};

describe("the home page", () => {
  const html = renderToStaticMarkup(<TrainerHome home={home} now={NOW} paste="" onPaste={noop} onAddAndPractice={noop} />);
  const t = text(html);

  it("shows the jobs in Interview with what Job Fit counts and how often they were practised", () => {
    expect(t).toContain("4 of 5 required");
    expect(t).toContain("Practiced twice · last one 2 days ago");
    expect(t).toContain("Proof given so far: SQL and Power BI. Not yet: Python.");
    expect(t).toContain("Not practiced yet");
    expect(html).toContain('href="/app/interview/new?job=j1"');
    expect(html).toContain('href="/app/interview/s2/report"');
  });

  it("lists the other jobs, the pasted post and the past sessions; an unfinished one is continued", () => {
    expect(t).toContain("BI Analyst · Northfield Group · Saved");
    expect(t).toContain("We add it to your Tracker as Saved.");
    expect(t).toContain("Hiring manager · 10 min · typed");
    expect(html).toContain('href="/app/interview/s3">Continue</a>');
  });

  it("says what it does today: typed answers, no AI interviewer", () => {
    expect(t).toContain("You type your answers");
    expect(t).not.toMatch(/\bAI\b/);
  });

  it("says how many sessions are left this month", () => {
    expect(text(renderToStaticMarkup(<LimitChip used={2} limit={20} />))).toContain("Beta: 18 of 20 sessions left this month");
  });

  it("without a job in Interview, says where they come from", () => {
    expect(text(renderToStaticMarkup(<TrainerHome home={{ ...home, interviews: [] }} now={NOW} paste="" onPaste={noop} onAddAndPractice={noop} />)))
      .toContain("No job in Interview yet");
  });
});

describe("setting up", () => {
  const t = text(renderToStaticMarkup(<TrainerSetup setup={setup} busy={false} error={null} onChangeCv={noop} onStart={noop} onOpenCv={noop} />));

  it("names the job and the CV the questions come from, and what the post asks for", () => {
    expect(t).toContain("Data Analyst · Altamira Tech · with the CV you sent: Data Analyst CV");
    expect(t).toContain("The skills the job asks for: SQL and Snowflake.");
    expect(t).toMatch(/SQLin your CV/);
    expect(t).toMatch(/Snowflakeno proof in your CV yet/);
    expect(t).toContain("Tableau · nice to have");
  });

  it("offers typing only, and no style or English notes until the model asks the questions", () => {
    expect(t).toContain("Speaking isn’t available yet.");
    expect(t).not.toMatch(/Friendly|Neutral|Tough|English notes|Bedrock|\bAI\b/);
    expect(t).toContain("About 10 minutes · 18 sessions left this month");
  });

  it("can't start from a CV with no lines", () => {
    const empty = text(renderToStaticMarkup(<TrainerSetup setup={{ ...setup, hasLines: false }} busy={false} error={null} onChangeCv={noop} onStart={noop} onOpenCv={noop} />));
    expect(empty).toContain("Your CV has no lines to ask about yet.");
    expect(empty).not.toContain("Start interview");
  });
});

describe("the session", () => {
  const props = {
    session: { role: "Data Analyst", company: "Altamira Tech", kind: "manager" as const, timer: false }, n: 2, total: 4,
    question: { text: "Your CV says “Cut the report”. How?", requirement: "SQL" }, timeLeft: 372, answerSeconds: 10, retrying: false,
    draft: "", onDraft: noop, transcript: [], showTranscript: true, onToggleTranscript: noop, busy: false, error: null,
    onSend: noop, onPause: noop, onResume: noop, onSkip: noop, onEnd: noop, onReport: noop,
  };

  it("says it's a practice interview, typed, with the time left; the question's own quotes become single ones", () => {
    const t = text(renderToStaticMarkup(<TrainerLive {...props} phase="answering" />));
    expect(t).toContain("Practice interview");
    expect(t).not.toContain("AI interviewer");
    expect(t).toContain("6:12 left");
    expect(t).toContain("Question 2 of 4 · about: SQL");
    expect(t).toContain("“Your CV says ‘Cut the report’. How?”");
    expect(quoted("a “b” c")).toBe("“a ‘b’ c”");
  });

  it("finishes with the answer being written when the time is up; a pause offers to skip", () => {
    expect(text(renderToStaticMarkup(<TrainerLive {...props} phase="answering" timeLeft={0} draft="x" />))).toContain("Send and finish");
    const paused = text(renderToStaticMarkup(<TrainerLive {...props} phase="paused" />));
    expect(paused).toContain("Paused · the clock is stopped");
    expect(paused).toContain("Skip this question");
  });

  it("a second try doesn't use the interview's time, and can't be skipped", () => {
    const t = text(renderToStaticMarkup(<TrainerLive {...props} phase="paused" retrying />));
    expect(t).not.toContain("Skip this question");
    expect(text(renderToStaticMarkup(<TrainerLive {...props} phase="answering" retrying />))).toContain("this doesn’t use time from the interview");
  });

  it("the 2-minute timer reminds, it doesn't cut", () => {
    const t = text(renderToStaticMarkup(<TrainerLive {...props} phase="answering" session={{ ...props.session, timer: true }} answerSeconds={130} />));
    expect(t).toContain("Two minutes: finish your sentence and send it");
    expect(t).toContain("2:00 of 2:00");
  });
});

describe("the feedback after an answer", () => {
  const html = renderToStaticMarkup(
    <TrainerFeedback session={{ role: "Data Analyst", company: "Altamira Tech", kind: "manager" }} n={2} total={4}
      question={{ text: "Tell me about the weekly report.", requirement: "SQL" }} turn={turn} ahead={["Python"]} last={false}
      canRetry timeLeft={372} busy={false} error={null} onNext={noop} onRetry={noop} onEnd={noop} />,
  );
  const t = text(html);

  it("shows what's missing, and the CV's own numbers to say", () => {
    expect(t).toContain("Missing: say where you used SQL.");
    expect(t).toContain("Missing: a number or a tool from your CV line.");
    expect(t).toContain("Say the result. It’s already in your CV:");
    expect(html).toContain("<strong>6 hours to 1</strong>");
  });

  it("counts, not grades; and what's still to come", () => {
    expect(t).toContain("1 min 48 s");
    expect(t).toContain("Counts from your answer, not grades. Filler words: “basically” ×2.");
    expect(t).toContain("Still to come in this session: Python.");
    expect(t).toContain("Next question");
    expect(t).toContain("Try this answer again");
  });

  it("the last answer leads to the report; no more tries leaves no retry", () => {
    const last = text(renderToStaticMarkup(
      <TrainerFeedback session={{ role: "R", company: "C", kind: "manager" }} n={4} total={4} question={{ text: "Q", requirement: null }}
        turn={turn} ahead={[]} last canRetry={false} timeLeft={10} busy={false} error={null} onNext={noop} onRetry={noop} onEnd={noop} />,
    ));
    expect(last).toContain("See your report");
    expect(last).not.toContain("Try this answer again");
  });
});

describe("the report", () => {
  const summary: SessionSummary = {
    total: 4, answered: 2, skipped: 1,
    wentWell: ["You used facts from your CV in 1 of 2 answers."],
    toPractice: [{ n: 2, text: "Say the result in numbers.", detail: "Question 2: “6 hours to 1” is in your CV." }],
    focus: [{ ref: "work.0.0", requirement: "SQL" }],
    noProof: [
      { label: "SQL", inCv: true, askedIn: 2, named: false },
      { label: "Snowflake", inCv: false, askedIn: null, named: false },
    ],
    measured: { averageSeconds: 95, averageWords: 84, wordsPerMinute: null, fillers: 2 },
    fillerWords: [{ word: "basically", count: 2 }],
    named: ["Power BI"],
    questions: [
      { n: 1, id: "q1", text: "Q one", requirement: null, bullet: { ref: "work.0.1", text: "Built dashboards for 40 staff" }, state: "answered",
        answer: "I built them for 40 people.", tries: 2, criteria: [{ key: "proof", met: true, quote: "I built them for 40 people." }],
        named: [], used: ["40"], unused: [], measures: { seconds: 60, words: 6, wordsPerMinute: 0, longPauses: 0, fillers: [] } },
      { n: 2, id: "q2", text: "Q two", requirement: "SQL", bullet: { ref: "work.0.0", text: "Cut the report from 6 hours to 1 with SQL" }, state: "skipped",
        answer: null, tries: 0, criteria: [], named: [], used: [], unused: [], measures: null },
    ],
  };
  const report: ReportView = {
    id: "s2", applicationId: "j1", role: "Data Analyst", company: "Altamira Tech", at: NOW - 60e3, kind: "manager", minutes: 10, mode: "typing",
    status: "done", prepared: "a_bit", keptUntil: Date.UTC(2027, 4, 6, 12), summary,
    progress: {
      columns: [{ id: "s1", at: NOW - 5 * DAY, kind: "recruiter" }, { id: "s2", at: NOW - 60e3, kind: "manager" }],
      rows: [{ label: "SQL", required: true, states: ["proof", "asked"] }],
    },
    sessionsForJob: 2, required: 2, cvId: "c1", used: 2, limit: 20, resetsOn: Date.UTC(2026, 11, 1),
  };
  const props = { now: NOW, busy: null, confirmDelete: false, message: null, onPracticeThese: noop, onAskDelete: noop, onCancelDelete: noop, onDelete: noop, onPrepared: noop, onOpenCv: noop };

  it("starts with what went well, the things to practise and what has no proof yet", () => {
    const t = text(renderToStaticMarkup(<TrainerReport report={report} {...props} />));
    expect(t).toContain("What went well");
    expect(t).toContain("1 thing to practice");
    expect(t).toContain("Practice these again");
    expect(t).toContain("A 10-minute session that asks these first, in other words.");
    expect(t).toContain("Question 2 asked; your answer didn’t name it.");
    expect(t).toContain("Not in your CV. If you’ve used it, add it to your CV first.");
  });

  it("shows the job's progress from its second session, and the questions with the CV's line", () => {
    const html = renderToStaticMarkup(<TrainerReport report={report} {...props} />);
    const t = text(html);
    expect(t).toContain("Proof given");
    expect(t).toContain("Asked, no proof");
    expect(t).toContain("answered 2 times; this is the last answer");
    expect(t).toContain("You skipped this question.");
    expect(t).toContain("Your CV says: “Cut the report from 6 hours to 1 with SQL”");
    expect(html).toMatch(/role="radio" aria-checked="true"[^>]*>A bit</);
    expect(t).toContain("until 6 May 2027 (180 days)");
    expect(t).toContain("without AI");
  });

  it("on the first session, says the progress comes next time; deleting asks first", () => {
    const t = text(renderToStaticMarkup(<TrainerReport report={{ ...report, progress: null, sessionsForJob: 1 }} {...props} confirmDelete />));
    expect(t).toContain("This is your first session for this job.");
    expect(t).toContain("Delete your answers and this report? The Tracker job stays.");
    expect(t).toContain("Keep it");
  });

  it("an unfinished session says so and links back to it", () => {
    const html = renderToStaticMarkup(<TrainerReport report={{ ...report, status: "live" }} {...props} />);
    expect(text(html)).toContain("This interview isn’t finished.");
    expect(html).toContain('href="/app/interview/s2"');
    expect(text(html)).not.toContain("Do you feel more prepared");
  });
});

describe("when a practice can't start", () => {
  it("the month's sessions: when they come back, and the last report", () => {
    const html = renderToStaticMarkup(<TrainerBlocked kind="limit" limit={20} resetsOn={Date.UTC(2026, 11, 1)} lastReportId="s2" />);
    expect(text(html)).toContain("You’ve used your 20 sessions this month");
    expect(text(html)).toContain("They come back on 1 Dec.");
    expect(html).toContain('href="/app/interview/s2/report"');
  });

  it("signed out, or without a CV", () => {
    expect(text(renderToStaticMarkup(<TrainerBlocked kind="signed_out" />))).toContain("Sign in to practice");
    expect(text(renderToStaticMarkup(<TrainerBlocked kind="no_cv" />))).toContain("Make a CV first");
  });
});

describe("the Tracker's job card", () => {
  const job: TrackedJob = {
    id: "j1", company: "Altamira Tech", role: "Data Analyst", url: null, location: null, description: null, notes: null,
    status: "interview", appliedAt: NOW - DAY, submittedAt: null, followUpAt: null, archivedAt: null, cvId: null,
  };
  const base = {
    job, fit: null, fitAgainst: null, cvSentTitle: null, hasCv: true, events: [], onClose: noop, onStatus: noop,
    onSaveDetails: async () => true, onAskCv: noop, onArchive: noop, onUnarchive: noop, onDelete: noop,
  };

  it("offers “Practice this interview” and says how many times it was practised, only while the trainer is on", () => {
    const on = text(renderToStaticMarkup(<JobPanel {...base} practice={{ href: "/app/interview/new?job=j1", times: 2 }} />));
    expect(on).toContain("Practice this interview");
    expect(on).toContain("Practiced twice");
    expect(text(renderToStaticMarkup(<JobPanel {...base} />))).not.toContain("Practice this interview");
  });
});
