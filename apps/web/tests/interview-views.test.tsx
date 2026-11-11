// Interview Trainer: the screens as they render (react-dom/server, no DOM). What the buttons do is in
// tests/db/interview-actions.test.ts and interview-ai-actions.test.ts. Typing only, so no screen
// promises speaking; and a screen says "AI interviewer", offers a style or English notes, or shows
// the model's feedback only in a session whose interviewer is the model (rule 10; steps 4 and 5).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LiveTurn, ReportView, SetupView, TrainerHome as Home } from "@/app/actions/interview";
import TrainerHome, { LimitChip } from "@/views/interview/TrainerHome";
import TrainerSetup from "@/views/interview/TrainerSetup";
import TrainerBlocked from "@/views/interview/TrainerBlocked";
import TrainerLive, { criterionNote, measuredForShow, QuestionSteps, summaryOf, TrainerFeedback, quoted } from "@/views/interview/TrainerLive";
import { segments } from "@/views/interview/format";
import TrainerReport, { reportLead } from "@/views/interview/TrainerReport";
import JobPanel from "@/views/tracker/JobPanel";
import type { AiFeedback, SessionSummary } from "@/lib/interview/report";
import type { TrackedJob } from "@/lib/tracker";

// The day a report is kept until, as the page says it: in the reader's own zone (longDate). A local
// date, so "6 May 2027" holds wherever the tests run.
const KEPT_UNTIL = new Date(2027, 4, 6, 12).getTime();

const DAY = 864e5;
const NOW = Date.parse("2026-11-07T18:45:00Z");
const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

const home: Home = {
  used: 2, limit: 20, resetsOn: Date.UTC(2026, 11, 1), hasCv: true, ai: false,
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
  used: 2, limit: 20, resetsOn: Date.UTC(2026, 11, 1), sessions: 0, lastReportId: null, ai: null, lastStyle: null,
};

const turn: LiveTurn = {
  id: "t1", questionId: "q2", answer: "I helped the team a lot with the report.", follow: [], ai: null, seconds: 108, words: 9,
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

  it("gives each job a row: a picture in a ring that is green once it was practised, where the practice stands in a word, and the way in", () => {
    const html = renderToStaticMarkup(<TrainerHome home={home} now={NOW} paste="" onPaste={noop} onAddAndPractice={noop} />);
    expect((html.match(/<li class="trn-job">/g) ?? []).length).toBe(2);
    expect((html.match(/class="trn-job__icon is-done"/g) ?? []).length).toBe(1);
    expect(html).toContain('<span class="trn-state is-good">Practiced twice · last one 2 days ago</span>');
    expect(html).toContain('<span class="trn-state is-none">Not practiced yet</span>');
    expect(html).toContain('<a class="topbtn topbtn--dark" href="/app/interview/new?job=j1">Practice again</a>');
    expect(html).toContain('<a class="topbtn topbtn--dark" href="/app/interview/new?job=j2">Practice</a>');
    // the job's card class belongs to no other piece of the trainer: the form card is .trn-fcard
    expect(html).not.toContain('class="trn-card"');
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
    session: { role: "Data Analyst", company: "Altamira Tech", kind: "manager" as const, timer: false, ai: false, style: "friendly" as const }, n: 2, total: 4,
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

const plain = { role: "Data Analyst", company: "Altamira Tech", kind: "manager" as const, ai: false, style: "friendly" as const, englishNotes: false };

describe("the feedback after an answer", () => {
  const html = renderToStaticMarkup(
    <TrainerFeedback session={plain} n={2} total={4}
      question={{ text: "Tell me about the weekly report.", requirement: "SQL" }} turn={turn} ahead={["Python"]} last={false}
      canRetry timeLeft={372} busy={false} error={null} onNext={noop} onRetry={noop} onEnd={noop} />,
  );
  const t = text(html);

  it("says in one plain sentence what the answer showed, then each thing as a row: its name, whether it is there, what to say", () => {
    expect(t).toContain("Your answer didn’t use your CV yet. Add a number or a tool from it.");
    expect(t).toContain("What this answer showed");
    expect(t).toContain("The requirementNot namedSay where you used SQL.");
    expect(t).toContain("Proof from your CVNot usedAdd a number or a tool from your CV line.");
    expect((html.match(/<li class="trn-row is-missing"/g) ?? []).length).toBe(2);
    // the CV's own numbers to say
    expect(t).toContain("Say the result. It’s already in your CV:");
    expect(html).toContain("<strong>6 hours to 1</strong>");
  });

  it("gives the counts in one quiet line, without a grade; and what's still to come", () => {
    expect(t).toContain("1 min 48 s · 9 words · filler words: “basically” ×2");
    expect(t).not.toMatch(/\bscore|grade|\/10|out of 10/i);
    expect(t).toContain("None of the post’s requirements, by name. Still to come in this session: Python.");
    expect(t).toContain("Next question");
    expect(t).toContain("Try this answer again");
  });

  it("the last answer leads to the report; no more tries leaves no retry", () => {
    const last = text(renderToStaticMarkup(
      <TrainerFeedback session={plain} n={4} total={4} question={{ text: "Q", requirement: null }}
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
    english: null,
    questions: [
      { n: 1, id: "q1", text: "Q one", requirement: null, bullet: { ref: "work.0.1", text: "Built dashboards for 40 staff" }, state: "answered",
        turnId: "t1", answer: "I built them for 40 people.", follow: [], tries: 2, criteria: [{ key: "proof", met: true, quote: "I built them for 40 people." }],
        named: [], used: ["40"], unused: [], measures: { seconds: 60, words: 6, wordsPerMinute: 0, longPauses: 0, fillers: [] }, ai: null },
      { n: 2, id: "q2", text: "Q two", requirement: "SQL", bullet: { ref: "work.0.0", text: "Cut the report from 6 hours to 1 with SQL" }, state: "skipped",
        turnId: "t2", answer: null, follow: [], tries: 0, criteria: [], named: [], used: [], unused: [], measures: null, ai: null },
    ],
  };
  const report: ReportView = {
    id: "s2", applicationId: "j1", role: "Data Analyst", company: "Altamira Tech", at: NOW - 60e3, kind: "manager", minutes: 10, mode: "typing",
    status: "done", ai: false, style: "friendly", englishNotes: false, prepared: "a_bit", keptUntil: KEPT_UNTIL, summary,
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

// ── with the model (step 5) ──────────────────────────────────────────────────────────────────────

const ANSWER = "So the report took me a lot of time every week. Then I make the Power BI file refresh by itself. Basically I helped the team a lot with this.";
const MORE = "It went from 6 hours to 1, I was responsible of the whole process.";
const ai: AiFeedback = {
  criteria: [
    { key: "situation", met: true, quote: "the report took me a lot of time every week" },
    { key: "action", met: true, quote: "Then I make the Power BI file refresh by itself." },
    { key: "result", met: true, quote: "It went from 6 hours to 1" },
    { key: "task", met: false, quote: null },
  ],
  vague: [{ phrase: "I helped the team a lot with this", ask: "Who got the report, and how much sooner?" }],
  english: [
    { index: 0, quote: "Then I make", better: "Then I made", why: "Past tense: the story happened at Brightline.", kind: "tense" },
    { index: 2, quote: "responsible of", better: "responsible for", why: null, kind: "preposition" },
  ],
  dismissed: 1,
  stronger: "At Brightline, the weekly sales report took me a lot of time. I automated it in Power BI, and it went from 6 hours to 1.",
  strongerRefused: false,
};
const aiTurn: LiveTurn = {
  ...turn, answer: ANSWER, follow: [{ question: "And what changed for the team?", answer: MORE }, { question: "Who used it?", answer: null }],
  criteria: [{ key: "requirement", met: true, quote: null }, { key: "proof", met: true, quote: "It went from 6 hours to 1, I was responsible of the whole process." }],
  used: ["6", "1", "SQL"], unused: [], numbers: null, named: ["SQL"], ai,
};
const withModel = { ...plain, ai: true, style: "tough" as const, englishNotes: true };

describe("setting up, when the interviewer can be the model", () => {
  const withAi: SetupView = { ...setup, ai: { agreed: false, provider: "Amazon Bedrock (in the US)", name: "Amazon Bedrock" }, lastStyle: null };
  const render = (s: SetupView, initial = {}) => renderToStaticMarkup(<TrainerSetup setup={s} initial={initial} busy={false} error={null} onChangeCv={noop} onStart={noop} onOpenCv={noop} />);

  it("offers the interviewer's style, each with what it does, and English notes", () => {
    const t = text(render(withAi));
    expect(t).toContain("The interviewer");
    expect(t).toContain("Warm, one follow-up question. Good for a first run.");
    expect(t).toContain("Polite and brief, like most real interviews.");
    expect(t).toContain("Asks for numbers and pushes on vague answers. Never rude.");
    expect(t).toContain("English notes · up to 3 per answer, grammar and phrasing only");
    // Friendly the first time; the last style after that
    expect(render(withAi)).toMatch(/name="trn-style" checked=""\/> Friendly/);
    expect(render({ ...withAi, lastStyle: "tough" })).toMatch(/name="trn-style" checked=""\/> Tough/);
  });

  it("says before the first session that the interviewer is an AI and where the answers go, and asks for a tick", () => {
    const t = text(render(withAi));
    // what a prompt holds (lib/interview/prompt.ts), said in full
    expect(t).toContain("The interviewer is an AI, not a person. Your answers go to Amazon Bedrock (in the US), with the question, the line of your CV it is about (with that job’s title and employer) and the job you’re practicing for");
    expect(t).toContain("Your name, your contact details and the rest of your CV aren’t sent.");
    expect(t).toContain("We keep your answers and the feedback for 180 days, and you can delete a session any time.");
    expect(t).toContain("I understand the interviewer is an AI and my answers go to Amazon Bedrock.");
    // not ticked: the same practice, without AI, and the button says so
    expect(t).toContain("Start without AI");
    expect(t).toContain("Without this you can still practice");
    expect(text(render(withAi, { consent: true }))).toContain("Start interview");
    expect(text(render(withAi, { consent: true }))).not.toContain("Start without AI");
  });

  it("stands on the builder's page: the flow's steps, the requirements in a tips card, the tick right over the button it changes", () => {
    const html = render(withAi);
    expect(html).toContain('<span class="analyze-step__label is-current">Set up</span>');
    expect(text(html)).toContain("🎯Set up🎤Interview📋Report");
    expect(text(html)).toContain("From the job postWhat the interviewer will ask about");
    expect(html).toContain('class="trn-mint trn-before"');
    const at = (x: string) => html.indexOf(x);
    expect(at("trn-setup__form")).toBeGreaterThan(-1);
    expect(at("trn-setup__form")).toBeLessThan(at("I understand the interviewer is an AI"));
    expect(at("I understand the interviewer is an AI")).toBeLessThan(at("Start without AI"));
  });

  it("doesn't ask again once the person agreed, and still says who the interviewer is", () => {
    const t = text(render({ ...withAi, ai: { ...withAi.ai!, agreed: true }, sessions: 3 }));
    expect(t).not.toContain("Before your first session");
    expect(t).not.toContain("I understand the interviewer is an AI");
    expect(t).toContain("Start interview");
    expect(t).toContain("The interviewer is an AI. Your answers go to Amazon Bedrock (in the US).");
  });

  it("names a development provider as one", () => {
    const dev = text(render({ ...withAi, ai: { agreed: false, provider: "Anthropic (development only)", name: "Anthropic" } }));
    expect(dev).toContain("Your answers go to Anthropic (development only)");
    expect(dev).not.toContain("Bedrock");
  });
});

describe("the home page, when the interviewer can be the model", () => {
  it("says so; and never promises speaking", () => {
    const t = text(renderToStaticMarkup(<TrainerHome home={{ ...home, ai: true }} now={NOW} paste="" onPaste={noop} onAddAndPractice={noop} />));
    expect(t).toContain("Practice with an AI interviewer that knows the job and your CV. You type your answers");
    expect(t).not.toMatch(/voice|speak|recording/i);
  });
});

describe("the session with the model", () => {
  const props = {
    session: { ...withModel, timer: false }, n: 2, total: 4,
    question: { text: "And what changed for the team?", requirement: "SQL" }, timeLeft: 372, answerSeconds: 10, retrying: false,
    draft: "", onDraft: noop, showTranscript: true, onToggleTranscript: noop, busy: false, error: null,
    onSend: noop, onPause: noop, onResume: noop, onSkip: noop, onEnd: noop, onReport: noop,
    transcript: [
      { who: "interviewer" as const, text: "Hi Ana, I’m an AI interviewer, not a person. I’ll ask you about the Data Analyst role at Altamira Tech. Ready when you are." },
      { who: "interviewer" as const, text: "Tell me about the weekly report." }, { who: "you" as const, text: ANSWER },
      { who: "interviewer" as const, text: "And what changed for the team?" },
    ],
  };

  it("keeps “AI interviewer” at the top, with the style, and opens by saying it is an AI", () => {
    const t = text(renderToStaticMarkup(<TrainerLive {...props} phase="answering" followUp />));
    expect(t).toContain("AI interviewer");
    expect(t).not.toContain("Practice interview");
    expect(t).toContain("Data Analyst · Altamira Tech · Hiring manager · Tough");
    expect(t).toContain("Hi Ana, I’m an AI interviewer, not a person.");
    expect(t).toContain("Typing mode · the interviewer reads your answer");
    // the follow-up is marked as one
    expect(t).toContain("Follow-up · question 2 of 4 · about: SQL");
    expect(t).toContain("“And what changed for the team?”");
  });

  it("stops the clock and takes no answer while the interviewer reads; a follow-up can be skipped from a pause", () => {
    const thinking = renderToStaticMarkup(<TrainerLive {...props} phase="thinking" question={null} />);
    expect(text(thinking)).toContain("Thinking…");
    // said once to a screen reader (the status), and shown under the loading circle
    expect(thinking).toMatch(/class="trn-live__status trn-live__status--thinking trk-sr" role="status"/);
    expect(thinking).toContain('<p class="trn-reading__msg" aria-hidden="true">Thinking…</p>');
    // the circle holds a line drawing (a thought bubble), as the score page's loading circle does, not an emoji face
    expect(thinking).toMatch(/<div class="trn-reading__badge" aria-hidden="true">.*<svg class="trn-reading__icon"/);
    expect(thinking).not.toContain("🤔");
    expect(text(thinking)).toContain("Your answer is saved. The clock is stopped while the interviewer reads it.");
    expect(thinking).not.toContain("<textarea");
    expect(text(thinking)).not.toContain("Send answer");
    expect(text(renderToStaticMarkup(<TrainerLive {...props} phase="paused" retrying followUp />))).toContain("Skip this question");
  });
});

describe("the questions as steps", () => {
  const done = (h: string) => (h.match(/class="trn-steps__node is-done"/g) ?? []).length;

  it("shows a circle a question, the one being asked in the ring, and the report at the end", () => {
    const h = renderToStaticMarkup(<QuestionSteps n={2} total={4} />);
    expect((h.match(/class="trn-steps__label[^"]*">Question \d</g) ?? []).length).toBe(4);
    expect(done(h)).toBe(1);
    expect(h).toContain('<span class="trn-steps__label is-current">Question 2</span>');
    expect(h).toMatch(/aria-current="step"><span class="trn-steps__line is-filled"/);
    expect(h).toContain('<span class="trn-steps__label">Report</span>');
    // the current step is told apart by its word and aria-current, not only its colour
    expect((h.match(/aria-current="step"/g) ?? []).length).toBe(1);
  });

  it("ends on the report once every question has its answer", () => {
    const h = renderToStaticMarkup(<QuestionSteps n={4} total={4} done />);
    expect(done(h)).toBe(4);
    expect(h).toContain('<span class="trn-steps__label is-current">Report</span>');
    expect((h.match(/aria-current="step"/g) ?? []).length).toBe(1);
  });

  it("stands on the session and on the feedback after an answer", () => {
    const session = { ...plain, timer: false };
    const live = renderToStaticMarkup(
      <TrainerLive session={session} phase="answering" n={3} total={4} question={{ text: "Q", requirement: null }} timeLeft={60} answerSeconds={0}
        retrying={false} draft="" onDraft={noop} transcript={[]} showTranscript onToggleTranscript={noop} busy={false} error={null}
        onSend={noop} onPause={noop} onResume={noop} onSkip={noop} onEnd={noop} onReport={noop} />,
    );
    expect(live).toContain('<span class="trn-steps__label is-current">Question 3</span>');
    const card = renderToStaticMarkup(
      <TrainerFeedback session={plain} n={2} total={4} question={{ text: "Q", requirement: null }} turn={turn} ahead={[]} last={false}
        canRetry timeLeft={372} busy={false} error={null} onNext={noop} onRetry={noop} onEnd={noop} />,
    );
    expect(card).toContain('<span class="trn-steps__label is-current">Question 2</span>');
  });
});

describe("the feedback with the model", () => {
  const card = (o: Partial<Parameters<typeof TrainerFeedback>[0]> = {}) => renderToStaticMarkup(
    <TrainerFeedback session={withModel} n={2} total={4} question={{ text: "Tell me about the weekly report.", requirement: "SQL" }} turn={aiTurn}
      aiState="ready" ahead={[]} last={false} canRetry timeLeft={372} busy={false} error={null} onNext={noop} onRetry={noop} onEnd={noop}
      onDismissNote={noop} onAskAgain={noop} {...o} />,
  );
  const html = card();
  const t = text(html);

  it("shows the answer and its follow-ups, with the vague phrase and the notes marked in place", () => {
    expect(t).toContain("Follow-up “And what changed for the team?”");
    expect(t).toContain("Follow-up “Who used it?”You skipped it.");
    expect(html).toContain('<mark class="trn-mark trn-mark--vague">I helped the team a lot with this</mark>');
    expect(html).toContain('<mark class="trn-mark trn-mark--english">Then I make</mark>');
    expect(html).toContain('<mark class="trn-mark trn-mark--english">responsible of</mark>');
    // the marks have words too: a key, and each phrase written out below
    expect(t).toContain("vague");
    expect(t).toContain("English note");
  });

  it("gives the four parts of the answer with the person's words, then what the answer measured; no score", () => {
    expect(t).toContain("What a hiring manager listens for");
    const order = ["SituationSaid", "TaskMissing", "ActionSaid", "ResultSaid", "The requirementNamed", "Proof from your CVUsed"].map((x) => t.indexOf(x));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(t).toContain("“the report took me a lot of time every week”");
    expect(t).toContain("TaskMissingSay what was yours to do.");
    // the first sentence says the same as the rows, in plain words
    expect(t).toContain("Your answer has the situation, what you did and the result. Your task is missing.");
    // the requirement was named in words the CV writes another way: no sentence to show
    expect(t).toContain("Named in your answer.");
    expect(criterionNote({ key: "proof", met: true, quote: null }, null, ["12", "Python"])).toBe("You used: 12, Python.");
    expect(t).not.toMatch(/\bscore|\/10|out of 10|grade[^s]|confiden|\bATS\b/i);
  });

  it("gives every part a row with a picture; a part that isn't there is told apart by its word, not only its colour", () => {
    expect((html.match(/<li class="trn-row /g) ?? []).length).toBe(6);
    expect((html.match(/<li class="trn-row is-missing"/g) ?? []).length).toBe(1);
    expect((html.match(/class="trn-row__icon" aria-hidden="true"/g) ?? []).length).toBe(6);
    // the model's reading isn't here: only what the answer measured
    expect((card({ aiState: "loading", turn: { ...aiTurn, ai: null } }).match(/<li class="trn-row /g) ?? []).length).toBe(2);
  });

  it("puts the answer's parts into one plain sentence, from the same facts as the rows", () => {
    const part = (key: "situation" | "task" | "action" | "result", met: boolean) => ({ key, met, quote: met ? "some words" : null });
    expect(summaryOf([part("situation", true), part("task", true), part("action", true), part("result", true)], []))
      .toBe("Your answer has all four parts: the situation, your task, what you did and the result.");
    expect(summaryOf([part("situation", true), part("task", true), part("action", true), part("result", false)], []))
      .toBe("Your answer has the situation, your task and what you did. The result is missing.");
    expect(summaryOf([part("situation", true), part("task", false), part("action", true), part("result", false)], []))
      .toBe("Your answer has the situation and what you did. Your task and the result are missing.");
    expect(summaryOf([part("situation", false), part("result", false)], [])).toBe("Your answer doesn’t show these parts yet: the situation and the result.");
    // a part the model couldn't show with the person's words is left out, not called missing
    expect(summaryOf([part("situation", true), part("action", true)], [])).toBe("Your answer has the situation and what you did.");
    // without the model's reading: what the answer measured
    const named = (met: boolean) => ({ key: "requirement" as const, met, quote: null });
    const proof = (met: boolean) => ({ key: "proof" as const, met, quote: null });
    expect(summaryOf([], [named(true), proof(true)])).toBe("You named what the job asks for, and used a fact from your CV.");
    expect(summaryOf([], [named(false), proof(true)])).toBe("You used a fact from your CV. Name what the job asks for too.");
    expect(summaryOf([], [proof(true)])).toBe("You used a fact from your CV.");
    expect(summaryOf([], [named(true), proof(false)])).toBe("You named what the job asks for. Add a number or a tool from your CV.");
    expect(summaryOf([], [named(false), proof(false)])).toBe("Your answer didn’t use your CV yet. Add a number or a tool from it.");
  });

  it("shows a sentence once when it both names the requirement and holds the proof", () => {
    const same = "I wrote the SQL that cut it from 6 hours to 1.";
    const shown = measuredForShow([{ key: "requirement", met: true, quote: same }, { key: "proof", met: true, quote: same }]);
    expect(shown).toEqual([{ key: "requirement", met: true, quote: same }, { key: "proof", met: true, quote: null }]);
    const both = text(card({ turn: { ...aiTurn, criteria: [{ key: "requirement", met: true, quote: same }, { key: "proof", met: true, quote: same }] } }));
    expect(both.split(`“${same}”`).length - 1).toBe(1);
    expect(both).toContain("Proof from your CVUsedYou used: 6, 1, SQL.");
    // two sentences, or a proof that is missing: as they are
    const apart = [{ key: "requirement" as const, met: true, quote: "I used SQL." }, { key: "proof" as const, met: true, quote: "It went from 6 hours to 1." }];
    expect(measuredForShow(apart)).toEqual(apart);
    const none = [{ key: "requirement" as const, met: true, quote: same }, { key: "proof" as const, met: false, quote: null }];
    expect(measuredForShow(none)).toEqual(none);
  });

  it("asks for the CV's numbers in words that fit what the answer already said", () => {
    const unsaid = { ...aiTurn, used: ["SQL"], unused: ["6", "1"], numbers: "6 hours to 1", cvLine: "Cut the report from 6 hours to 1 with SQL" };
    // a result in words, the numbers unsaid: the Result box is ticked, so only the numbers are asked for
    const ticked = text(card({ turn: unsaid }));
    expect(ticked).toContain("Say it in numbers. They’re already in your CV:“Cut the report from 6 hours to 1 with SQL”");
    expect(ticked).not.toContain("Say the result. It’s already in your CV:");
    const missing = { ...ai, criteria: ai.criteria.map((c) => (c.key === "result" ? { ...c, met: false, quote: null } : c)) };
    expect(text(card({ turn: { ...unsaid, ai: missing } }))).toContain("Say the result. It’s already in your CV:");
    expect(card({ turn: unsaid })).toContain("<strong>6 hours to 1</strong>");
  });

  it("shows each vague phrase with the question that makes it concrete, and no verdict", () => {
    expect(t).toContain("Make it concrete(1)“I helped the team a lot with this” Who got the report, and how much sooner?");
  });

  it("shows the English notes that stand, each with “I said it right”, and counts the ones marked right", () => {
    expect(t).toContain("English · 2 notes");
    expect(html).toContain("<del>Then I make</del>");
    expect(html).toContain("<strong>Then I made</strong>");
    expect(t).toContain("Past tense: the story happened at Brightline.");
    expect((html.match(/I said it right<\/button>/g) ?? []).length).toBe(2);
    expect(t).toContain("Grammar and wording only, from what you typed. If a note is wrong, choose “I said it right”: it goes, and it isn’t counted.");
    expect(t).toContain("You marked 1 note as “I said it right”.");
    // English notes off: no panel, no marks in the answer
    const off = card({ session: { ...withModel, englishNotes: false }, turn: { ...aiTurn, ai: { ...ai, english: [], dismissed: 0 } } });
    expect(text(off)).not.toMatch(/English ·|I said it right/);
    expect(off).not.toContain("trn-mark--english");
    // on, and nothing to note: no word about a button that isn't there
    const clean = text(card({ turn: { ...aiTurn, ai: { ...ai, english: [], dismissed: 0 } } }));
    expect(clean).toContain("No notes on this answer.Grammar and wording only, from what you typed.");
    expect(clean).not.toContain("If a note is wrong");
    // every note marked right
    const all = text(card({ turn: { ...aiTurn, ai: { ...ai, english: [], dismissed: 2 } } }));
    expect(all).toContain("No notes left on this answer.");
    expect(all).toContain("You marked 2 notes as “I said it right”.");
  });

  it("marks the stronger answer as made with AI, and says when one was refused", () => {
    // the label first, as the Pro Tips card has its badge: nobody reads the answer before knowing who made it
    expect(t).toContain("Made with AI. Check it.A stronger answer“At Brightline, the weekly sales report took me a lot of time.");
    expect(t).toContain("Built only from what you said and your CV. Say it in your own words; don’t learn it by heart.");
    const refused = text(card({ turn: { ...aiTurn, ai: { ...ai, stronger: null, strongerRefused: true } } }));
    expect(refused).toContain("None this time. The AI’s version said something that is in neither your answer nor your CV, so we didn’t show it.");
    expect(refused).not.toContain("Made with AI. Check it.");
    expect(text(card({ turn: { ...aiTurn, ai: { ...ai, stronger: null } } }))).not.toContain("A stronger answer");
  });

  it("says when the interviewer is still reading, and when its feedback can't be had: what the answer measured stays", () => {
    const loading = text(card({ aiState: "loading", turn: { ...aiTurn, ai: null } }));
    expect(loading).toContain("The interviewer is reading your answer…");
    expect(loading).toContain("Proof from your CVUsed");
    expect(loading).not.toMatch(/Situation|A stronger answer|Make it concrete/);
    const down = text(card({ aiState: "unavailable", turn: { ...aiTurn, ai: null } }));
    expect(down).toContain("The AI feedback isn’t available right now. This is what your answer measured. Try again");
    expect(down).toContain("Next question");
  });
});

describe("marking an answer", () => {
  it("cuts it where the phrases stand, once each, and leaves what overlaps or isn't there unmarked", () => {
    expect(segments("I helped a lot. Then I make it.", [{ text: "helped a lot", mark: "vague" }, { text: "I make", mark: "english" }])).toEqual([
      { text: "I ", mark: null }, { text: "helped a lot", mark: "vague" }, { text: ". Then ", mark: null }, { text: "I make", mark: "english" }, { text: " it.", mark: null },
    ]);
    expect(segments("a lot of help", [{ text: "a lot of help", mark: "vague" }, { text: "lot", mark: "english" }, { text: "missing", mark: "english" }]))
      .toEqual([{ text: "a lot of help", mark: "vague" }]);
    // a phrase shown cut short is found by its start
    expect(segments("We did many things together.", [{ text: "many things…", mark: "vague" }])[1]).toEqual({ text: "many things", mark: "vague" });
    expect(segments("", [])).toEqual([{ text: "", mark: null }]);
    expect(segments("plain", [])).toEqual([{ text: "plain", mark: null }]);
  });
});

describe("the report of a session with the model", () => {
  const base: SessionSummary = {
    total: 2, answered: 2, skipped: 0, wentWell: ["You said what came of it in 1 of 2 answers."],
    toPractice: [{ n: null, text: "Keep to the past tense when you tell what happened.", detail: "2 times." }],
    focus: [], noProof: [], measured: { averageSeconds: 95, averageWords: 84, wordsPerMinute: null, fillers: 2 }, fillerWords: [], named: ["SQL"],
    english: { notes: 3, dismissed: 1, patterns: [{ kind: "tense", label: "Verb tense", count: 2, example: { quote: "Then I make", better: "Then I made" } }] },
    questions: [
      { n: 1, id: "q1", text: "Tell me about the weekly report.", requirement: "SQL", bullet: { ref: "work.0.0", text: "Cut the report from 6 hours to 1 with SQL" },
        state: "answered", turnId: "t1", answer: ANSWER, follow: [{ question: "And what changed for the team?", answer: MORE }], tries: 1,
        criteria: aiTurn.criteria, named: ["SQL"], used: ["6", "1", "SQL"], unused: [],
        measures: { seconds: 120, words: 40, wordsPerMinute: 0, longPauses: 0, fillers: [] }, ai },
      { n: 2, id: "q2", text: "Who used it?", requirement: null, bullet: { ref: "work.0.1", text: "Built dashboards for 40 staff" },
        state: "answered", turnId: "t2", answer: "The finance team.", follow: [], tries: 1, criteria: [{ key: "proof", met: false, quote: null }],
        named: [], used: [], unused: ["40"], measures: { seconds: 20, words: 3, wordsPerMinute: 0, longPauses: 0, fillers: [] }, ai: null },
    ],
  };
  const report: ReportView = {
    id: "s9", applicationId: "j1", role: "Data Analyst", company: "Altamira Tech", at: NOW - 60e3, kind: "manager", minutes: 10, mode: "typing",
    status: "done", ai: true, style: "tough", englishNotes: true, prepared: null, keptUntil: KEPT_UNTIL, summary: base, progress: null,
    sessionsForJob: 1, required: 1, cvId: "c1", used: 3, limit: 20, resetsOn: Date.UTC(2026, 11, 1),
  };
  const props = { now: NOW, busy: null, confirmDelete: false, message: null, onPracticeThese: noop, onAskDelete: noop, onCancelDelete: noop, onDelete: noop, onPrepared: noop, onOpenCv: noop, onDismissNote: noop, onAskAgain: noop };
  const html = renderToStaticMarkup(<TrainerReport report={report} {...props} />);
  const t = text(html);

  it("names the interviewer's style, and says at the bottom what was made with AI", () => {
    expect(t).toContain("Hiring manager · Tough · 10 min · 2 questions · typed");
    expect(t).toContain("The interviewer was an AI. Its feedback and the stronger answers are made with AI from your answers and your CV: check them before you use them.");
    expect(t).not.toContain("without AI");
  });

  it("gives each question its follow-ups and the model's feedback, as on the card", () => {
    expect(t).toContain("Follow-up “And what changed for the team?”");
    // the parts as the card's rows, a size down; the requirement's row goes by its own name
    expect(t).toContain("SituationSaid“the report took me a lot of time every week”");
    expect(t).toContain("TaskMissingSay what was yours to do.");
    expect(t).toContain("SQLNamedNamed in your answer.");
    expect(html).toContain('<ul class="trn-rows trn-rows--compact">');
    expect(t).toContain("Make it concrete(1)“I helped the team a lot with this” Who got the report, and how much sooner?");
    expect(t).toContain("English · 2 notes");
    expect((html.match(/I said it right<\/button>/g) ?? []).length).toBe(2);
    expect(t).toContain("Made with AI. Check it.");
    expect(html).toContain('<mark class="trn-mark trn-mark--english">responsible of</mark>');
    // the tag is the answer's result when the model read it, the CV fact otherwise
    expect(t).toMatch(/1\. “Tell me about the weekly report\.”Result given/);
    expect(t).toMatch(/2\. “Who used it\?”No fact from your CV/);
    // one heading per stronger answer
    expect(html).toContain('id="trn-stronger-q1"');
  });

  it("says in one line when an answer the model read has no English note", () => {
    const clean = { ...ai, english: [], dismissed: 0 };
    const quiet = text(renderToStaticMarkup(<TrainerReport report={{ ...report, summary: { ...base, questions: [{ ...base.questions[0], ai: clean }, base.questions[1]] } }} {...props} />));
    expect(quiet).toContain("English: no notes on this answer");
    expect(quiet).not.toMatch(/English · \d|I said it right<|Grammar and wording only/);
    // the answer the model hasn't read says nothing about its English
    expect(quiet.split("English: no notes on this answer").length - 1).toBe(1);
    // English notes off: not a word
    const off = text(renderToStaticMarkup(<TrainerReport report={{ ...report, englishNotes: false, summary: { ...base, questions: [{ ...base.questions[0], ai: clean }, base.questions[1]] } }} {...props} />));
    expect(off).not.toContain("English: no notes");
  });

  it("shows once a sentence that both names the requirement and holds the proof", () => {
    const same = "I wrote the SQL that cut it from 6 hours to 1.";
    const q = { ...base.questions[0], criteria: [{ key: "requirement" as const, met: true, quote: same }, { key: "proof" as const, met: true, quote: same }] };
    const once = text(renderToStaticMarkup(<TrainerReport report={{ ...report, summary: { ...base, questions: [q, base.questions[1]] } }} {...props} />));
    expect(once).toContain(`SQLNamed“${same}”`);
    expect(once).toContain("Proof from your CVUsedYou used: 6, 1, SQL.");
    expect(once.split(`“${same}”`).length - 1).toBe(1);
  });

  it("opens like the results page: the flow's steps, the answers counted in a circle, one sentence and the way on", () => {
    expect(html).toContain('<span class="analyze-step__label is-current">Report</span>');
    expect((html.match(/analyze-step__node is-done/g) ?? []).length).toBe(2);
    // a count of answers, in words too; never a score
    expect(t).toContain("2 / 2answered");
    expect(t).not.toMatch(/\bscore\b|\/100|out of 10|\bgrade\b/i);
    expect(t).toContain("You said what came of it in 1 of 2 answers. Next: keep to the past tense when you tell what happened.");
    // the lists under it have the same, numbered, under the score page's badges
    expect(t).toContain("What went well(1)You said what came of it in 1 of 2 answers.");
    expect(t).toContain("1 thing to practice(1)Keep to the past tense when you tell what happened. 2 times.");
    expect(html).toContain('class="score-badge score-badge--good"');
    expect(html).toContain('class="score-badge score-badge--suggestion"');
  });

  it("puts the first thing that went well and the first thing to practise into one sentence", () => {
    const well = ["You used facts from your CV in 2 of 3 answers."];
    const next = [{ n: 2, text: "Say the result in numbers.", detail: "Question 2." }];
    expect(reportLead({ answered: 3, wentWell: well, toPractice: next })).toBe("You used facts from your CV in 2 of 3 answers. Next: say the result in numbers.");
    expect(reportLead({ answered: 3, wentWell: well, toPractice: [] })).toBe("You used facts from your CV in 2 of 3 answers.");
    expect(reportLead({ answered: 3, wentWell: [], toPractice: next })).toBe("Next time: say the result in numbers.");
    expect(reportLead({ answered: 3, wentWell: [], toPractice: [] })).toBe("Your answers are counted below.");
    expect(reportLead({ answered: 0, wentWell: [], toPractice: [] })).toBe("No answer was sent in this session.");
  });

  it("shows each question as a row that opens: its number in a ring, its state in a word, the question's number for a screen reader", () => {
    expect(html).toContain('<span class="trn-q__num is-good" aria-hidden="true">1</span>');
    expect(html).toContain('<span class="trn-q__num is-fair" aria-hidden="true">2</span>');
    expect(html).toContain('<span class="trk-sr">1. </span>“Tell me about the weekly report.”');
    expect(html).toContain('<span class="trn-state is-good">Result given</span>');
    expect(html).toContain('<span class="trn-state is-fair">No fact from your CV</span>');
    expect((html.match(/<details class="trn-q"/g) ?? []).length).toBe(2);
  });

  it("lists the kinds of English note that came up more than once, without the ones marked right", () => {
    expect(t).toContain("English · what came up more than once");
    expect(t).toContain("(1)Verb tense · 2 times · “Then I make” → “Then I made”");
    expect(t).toContain("You marked 1 note as “I said it right”; it isn’t counted.");
    const none = text(renderToStaticMarkup(<TrainerReport report={{ ...report, summary: { ...base, english: { notes: 1, dismissed: 0, patterns: [] } } }} {...props} />));
    expect(none).toContain("No kind of note came up twice in this session.");
    // English notes off: the section isn't there
    expect(text(renderToStaticMarkup(<TrainerReport report={{ ...report, englishNotes: false }} {...props} />))).not.toMatch(/English ·|I said it right/);
  });

  it("fills in as the interviewer reads the answers, and says when it can't", () => {
    const reading = text(renderToStaticMarkup(<TrainerReport report={report} {...props} waiting={{ t2: "loading" }} />));
    expect(reading).toContain("The interviewer is reading your answers: 1 of 2 done. The report fills in as it goes.");
    expect(reading).toContain("The interviewer is reading this answer…");
    const down = text(renderToStaticMarkup(<TrainerReport report={report} {...props} waiting={{ t2: "unavailable" }} />));
    expect(down).toContain("The AI feedback isn’t available right now for one answer. The rest of the report is counted from your answers. Try again");
    expect(down).toContain("The AI feedback on this answer isn’t available right now.");
  });
});
