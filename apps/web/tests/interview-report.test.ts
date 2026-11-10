// Interview Trainer, step 4: the report, without AI (lib/interview/report.ts). Everything it says is
// counted from the answers, the CV lines the questions are tied to and the post's requirements: proof
// for a requirement is an answer that named it and used a fact of its CV line; "Things to practice" are
// at most three, one per question, the clearest first; a retried answer replaces the earlier one.
import { describe, expect, it } from "vitest";
import { askAbout } from "@/lib/interview/pack";
import { measureAnswer, mergeMeasures } from "@/lib/interview/measure";
import {
  aiFeedbackOf, answersOf, exchangesOf, latestTurns, listWords, measuresOf, numberSpan, progress, proofSoFar, requirementStates,
  summarize, type TurnLike,
} from "@/lib/interview/report";
import { emptyCvData, type CvData, type InterviewFeedback, type InterviewPack } from "@/lib/types";

const LINE_SQL = "Cut the monthly report from 6 hours to 1 with SQL";
const LINE_BI = "Built Power BI dashboards used daily by 40 operations staff";
const cv: CvData = {
  ...emptyCvData(),
  skills: ["SQL", "Python"],
  work: [{
    id: "w1", role: "Data Analyst", company: "Brightline", description: `${LINE_SQL}\n${LINE_BI}`,
    startDate: "2022", endDate: "", current: true, country: "", cityState: "",
  }],
};
const post = "Data Analyst\nRequirements:\n- SQL\n- Power BI\n- Python\n- Snowflake";
const items = askAbout(cv, post);

const pack: InterviewPack = {
  questions: [
    { id: "q1", text: "Your CV says you cut the monthly report with SQL. How?", requirement: "SQL", bullet: { ref: "work.0.0", text: LINE_SQL } },
    { id: "q2", text: "Tell me about the Power BI dashboards.", requirement: "Power BI", bullet: { ref: "work.0.1", text: LINE_BI } },
    { id: "q3", text: "Snowflake isn't in your CV. What's closest?", requirement: "Snowflake", bullet: { ref: "work.0.0", text: LINE_SQL } },
    { id: "q4", text: "Who used the dashboards?", requirement: null, bullet: { ref: "work.0.1", text: LINE_BI } },
  ],
};

let position = 0;
function turn(questionId: string, answer: string | null, seconds = 40): TurnLike {
  const q = pack.questions.find((x) => x.id === questionId)!;
  return {
    questionId, position: ++position, answer,
    measures: answer == null ? null : measureAnswer({ text: answer, seconds, mode: "typing", requirement: q.requirement, bullet: q.bullet }),
  };
}

const GOOD_SQL = "I rewrote the report in SQL and it went from 6 hours to 1.";
const VAGUE_BI = "I built dashboards for the operations team.";
const GOOD_BI = "I built Power BI dashboards that 40 people in operations used every day.";

describe("the requirements in a session", () => {
  it("are proof when an answer named one and used a fact of its CV line; asked when only named or asked; else not asked", () => {
    const turns = [turn("q1", GOOD_SQL), turn("q2", VAGUE_BI), turn("q3", null)];
    expect(items.map((i) => i.label)).toEqual(["SQL", "Power BI", "Python", "Snowflake"]);
    expect(requirementStates(pack, turns, items)).toEqual(["proof", "asked", "not_asked", "asked"]);
  });

  it("a question the session never reached asked nothing", () => {
    expect(requirementStates(pack, [turn("q1", GOOD_SQL)], items)).toEqual(["proof", "not_asked", "not_asked", "not_asked"]);
  });

  it("a retried answer replaces the earlier one", () => {
    const turns = [turn("q2", VAGUE_BI), turn("q2", GOOD_BI)];
    const latest = latestTurns(pack, turns);
    expect(latest[1]).toMatchObject({ tries: 2, turn: { answer: GOOD_BI } });
    expect(requirementStates(pack, turns, items)[1]).toBe("proof");
  });
});

describe("the CV line's numbers, quoted", () => {
  it("from the first to the last one; a lone number with the word after it", () => {
    expect(numberSpan(LINE_SQL, ["6", "1"])).toBe("6 hours to 1");
    expect(numberSpan(LINE_BI, ["40"])).toBe("40 operations");
    expect(numberSpan("Cut reporting time by 45% for 12 teams", ["45%"])).toBe("45%");
    expect(numberSpan(LINE_SQL, ["7"])).toBeNull();
  });
});

describe("the session's report", () => {
  const turns = [turn("q1", GOOD_SQL, 50), turn("q2", VAGUE_BI, 20), turn("q3", null)];
  const s = summarize({ pack, turns, items });

  it("knows what was answered, skipped and not reached", () => {
    expect(s).toMatchObject({ total: 4, answered: 2, skipped: 1 });
    expect(s.questions.map((q) => q.state)).toEqual(["answered", "answered", "skipped", "not_reached"]);
    expect(s.questions[0]).toMatchObject({ named: ["SQL"], used: ["6", "1", "SQL"], unused: [] });
  });

  it("says what went well only from the counts", () => {
    expect(s.wentWell).toEqual([
      "You used facts from your CV in 1 of 2 answers.",
      "You named what the job asks for: SQL.",
    ]);
  });

  it("lists at most three things to practise, one per question, the clearest first, with the CV's own words", () => {
    expect(s.toPractice).toEqual([
      { n: 2, text: "Say the result in numbers.", detail: "Question 2: “40 operations” is in your CV." },
      { n: 3, text: "Answer question 3.", detail: "You skipped it." },
      { n: 1, text: "Give one example: what you did, and what changed.", detail: "Question 1: 14 words." },
    ]);
    expect(s.focus).toEqual([
      { ref: "work.0.1", requirement: "Power BI" },
      { ref: "work.0.0", requirement: "Snowflake" },
      { ref: "work.0.0", requirement: "SQL" },
    ]);
  });

  it("lists the required items with no proof yet: asked or not, in the CV or not", () => {
    expect(s.noProof).toEqual([
      { label: "Power BI", inCv: true, askedIn: 2, named: false },
      { label: "Python", inCv: true, askedIn: null, named: false },
      { label: "Snowflake", inCv: false, askedIn: 3, named: false },
    ]);
  });

  it("averages what was measured; words per minute only for spoken answers", () => {
    expect(s.measured).toEqual({ averageSeconds: 35, averageWords: 11, wordsPerMinute: null, fillers: 0 });
    expect(summarize({ pack, turns: [], items }).measured).toBeNull();
  });

  it("praises answering every question only when every one was answered", () => {
    const all = summarize({ pack, items, turns: [turn("q1", GOOD_SQL), turn("q2", GOOD_BI), turn("q3", "I used BigQuery, which is close."), turn("q4", "The operations team.")] });
    expect(all.wentWell).toContain("You answered all 4 questions.");
    expect(all.wentWell[0]).toBe("You used facts from your CV in 2 of 4 answers.");
  });

  it("suggests leaving out a filler word that came up four times or more", () => {
    const um = "Um, so basically I used SQL. Um, it was, um, basically fine. Basically, um, yes.";
    const r = summarize({ pack, items, turns: [turn("q1", um), turn("q2", GOOD_BI)] });
    expect(r.fillerWords[0]).toEqual({ word: "um", count: 4 });
    expect(r.toPractice.at(-1)).toEqual({ n: null, text: "Leave out the filler words.", detail: "“um” came up 4 times." });
  });
});

describe("the job's progress", () => {
  const first = { id: "s1", at: 1, kind: "recruiter" as const, pack, turns: [turn("q1", GOOD_SQL), turn("q2", VAGUE_BI)] };
  const second = { id: "s2", at: 2, kind: "manager" as const, pack, turns: [turn("q2", GOOD_BI)] };

  it("starts from the second session, oldest first, the rows what the job asks", () => {
    expect(progress([first], items)).toBeNull();
    const p = progress([second, first], items)!;
    expect(p.columns.map((c) => c.id)).toEqual(["s1", "s2"]);
    expect(p.rows.map((r) => [r.label, ...r.states])).toEqual([
      ["SQL", "proof", "not_asked"],
      ["Power BI", "asked", "proof"],
      ["Python", "not_asked", "not_asked"],
      ["Snowflake", "not_asked", "not_asked"],
    ]);
  });

  it("shows the last three sessions", () => {
    const more = [1, 2, 3, 4].map((at) => ({ ...first, id: `s${at}`, at }));
    expect(progress(more, items)!.columns.map((c) => c.id)).toEqual(["s2", "s3", "s4"]);
  });

  it("sums up the proof given so far and the required items still without it", () => {
    expect(proofSoFar([first, second], items)).toEqual({ proven: ["SQL", "Power BI"], notYet: ["Python", "Snowflake"] });
  });
});

it("lists words the way people say them", () => {
  expect(listWords(["SQL"])).toBe("SQL");
  expect(listWords(["SQL", "Python", "Power BI"])).toBe("SQL, Python and Power BI");
});

// Step 5: a question's follow-ups belong to its answer, and the model's feedback rides on the
// question's own turn. The report counts over both; it adds no judgement of its own.
describe("follow-ups", () => {
  const follow = (questionId: string, question: string, answer: string | null): TurnLike => ({ ...turn(questionId, answer), kind: "follow_up", question });

  it("belong to the latest try at their question, in the order they were asked", () => {
    const turns = [
      turn("q1", "I rewrote the report."), follow("q1", "In what?", "In SQL."), follow("q1", "And the result?", null),
      turn("q2", VAGUE_BI),
      turn("q1", GOOD_SQL), follow("q1", "Who used it?", "The finance team."),
    ];
    const tries = exchangesOf(turns);
    expect(tries.map((x) => [x.turn.questionId, x.turn.answer, x.follow.map((f) => f.question)])).toEqual([
      ["q1", "I rewrote the report.", ["In what?", "And the result?"]],
      ["q2", VAGUE_BI, []],
      ["q1", GOOD_SQL, ["Who used it?"]],
    ]);
    // a skipped follow-up says nothing
    expect(answersOf(tries[0])).toEqual(["I rewrote the report.", "In SQL."]);
    const latest = latestTurns(pack, turns);
    expect(latest[0]).toMatchObject({ tries: 2, turn: { answer: GOOD_SQL }, answers: [GOOD_SQL, "The finance team."] });
    expect(latest[0].follow.map((f) => f.answer)).toEqual(["The finance team."]);
    expect(latest[2]).toMatchObject({ turn: null, follow: [], answers: [], measures: null, tries: 0 });
  });

  it("count with their question: a fact of the CV line said in a follow-up is proof", () => {
    const only = [turn("q2", VAGUE_BI)];
    expect(requirementStates(pack, only, items)[1]).toBe("asked");
    const more = "About 40 people used them every day, in Power BI.";
    const turns = [...only, follow("q2", "How many people used them, and in what?", more)];
    expect(requirementStates(pack, turns, items)[1]).toBe("proof");
    const q = summarize({ pack, turns, items }).questions[1];
    expect(q).toMatchObject({ answer: VAGUE_BI, used: ["40", "Power BI"], unused: [], named: ["Power BI"] });
    expect(q.follow).toEqual([{ question: "How many people used them, and in what?", answer: more }]);
    expect(q.criteria).toEqual([{ key: "requirement", met: true, quote: more }, { key: "proof", met: true, quote: more }]);
    expect(q.measures).toMatchObject({ seconds: 80, words: 17 });
    expect(summarize({ pack, turns, items }).toPractice.map((t) => t.text)).not.toContain("Say the result in numbers.");
  });

  it("add up: the time and the words, a filler word's uses, what was named and used in any of the answers", () => {
    const a = measureAnswer({ text: "Um, I built it. Um, basically it was Power BI.", seconds: 30, mode: "voice", pauses: [4], requirement: "Power BI", bullet: pack.questions[1].bullet });
    const b = measureAnswer({ text: "Basically 40 people used it. Basically every day.", seconds: 30, mode: "voice", pauses: [5, 1], requirement: "Power BI", bullet: pack.questions[1].bullet });
    expect(mergeMeasures([a, b])).toEqual({
      seconds: 60, words: 18, wordsPerMinute: 18, longPauses: 2,
      fillers: [{ word: "basically", count: 2 }, { word: "um", count: 2 }],
      named: ["Power BI"], cvFacts: { used: ["Power BI", "40"], unused: [] },
    });
    expect(mergeMeasures([a])).toBe(a);
    expect(mergeMeasures([])).toBeNull();
    expect(measuresOf({ turn: turn("q1", null), follow: [] })).toBeNull();
  });
});

describe("the model's feedback in the report", () => {
  const feedback: InterviewFeedback = {
    criteria: [
      { key: "situation", met: true, quote: "the report took a day" }, { key: "action", met: true, quote: "I rewrote the report in SQL" },
      { key: "result", met: false, quote: null },
    ],
    vague: [{ phrase: "a lot of things", ask: "Which things?" }],
    english: [
      { quote: "I make it", better: "I made it", kind: "tense", why: "Past." },
      { quote: "since 2 years", better: "for 2 years", kind: "preposition" },
      { quote: "I rewrite", better: "I rewrote", kind: "tense" },
    ],
    prompt: "interview-feedback.v1",
  };
  const withAi = (t: TurnLike, o: Partial<TurnLike> = {}): TurnLike => ({ ...t, feedback, better: "A stronger answer.", ...o });

  it("is read from the question's turn: the notes that still stand, each with its place", () => {
    expect(aiFeedbackOf({ feedback: null })).toBeNull();
    expect(aiFeedbackOf({})).toBeNull();
    const ai = aiFeedbackOf({ feedback, better: "A stronger answer.", dismissed: [1] });
    expect(ai).toMatchObject({ dismissed: 1, stronger: "A stronger answer.", strongerRefused: false });
    expect(ai?.english).toEqual([
      { index: 0, quote: "I make it", better: "I made it", why: "Past.", kind: "tense" },
      { index: 2, quote: "I rewrite", better: "I rewrote", why: null, kind: "tense" },
    ]);
    expect(aiFeedbackOf({ feedback: { ...feedback, strongerRefused: true }, better: null })).toMatchObject({ stronger: null, strongerRefused: true });
  });

  it("adds what it found to the session's summary, and nothing for a session without it", () => {
    const plain = summarize({ pack, items, turns: [turn("q1", GOOD_SQL)] });
    expect(plain.english).toBeNull();
    expect(plain.questions[0].ai).toBeNull();

    const s = summarize({ pack, items, turns: [withAi(turn("q1", GOOD_SQL)), withAi(turn("q2", GOOD_BI), { dismissed: [0, 2] }), turn("q3", null)] });
    expect(s.questions[0].ai?.criteria).toHaveLength(3);
    // a skipped question has no feedback, even if a row carried one
    expect(summarize({ pack, items, turns: [withAi(turn("q1", null))] }).questions[0].ai).toBeNull();
    // q1: two tense notes and a preposition; q2: the preposition only (two marked right)
    expect(s.english).toEqual({
      notes: 4, dismissed: 2,
      patterns: [
        { kind: "tense", label: "Verb tense", count: 2, example: { quote: "I make it", better: "I made it" } },
        { kind: "preposition", label: "Prepositions", count: 2, example: { quote: "since 2 years", better: "for 2 years" } },
      ],
    });
    // one thing per question, the clearest first, then what came up across the session
    expect(s.toPractice).toEqual([
      { n: 1, text: "Say what came of it.", detail: "Question 1: the answer had no result." },
      { n: 2, text: "Say what came of it.", detail: "Question 2: the answer had no result." },
      { n: 3, text: "Answer question 3.", detail: "You skipped it." },
    ]);
    expect(s.wentWell).not.toContain("You said what came of it in all 2 answers.");
  });

  it("says what went well only where the model found the result, and what to practise where a part is missing", () => {
    const met: InterviewFeedback = { criteria: [{ key: "action", met: false, quote: null }, { key: "result", met: true, quote: "it went from 6 hours to 1" }], vague: [], english: [] };
    const s = summarize({ pack, items, turns: [{ ...turn("q1", GOOD_SQL), feedback: met }] });
    expect(s.wentWell).toContain("You said what came of it in your answer.");
    expect(s.toPractice).toEqual([{ n: 1, text: "Say what you did yourself, step by step.", detail: "Question 1: the answer didn’t say it." }]);
    expect(s.english).toEqual({ notes: 0, dismissed: 0, patterns: [] });
  });
});
