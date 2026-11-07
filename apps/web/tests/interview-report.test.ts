// Interview Trainer, step 4: the report, without AI (lib/interview/report.ts). Everything it says is
// counted from the answers, the CV lines the questions are tied to and the post's requirements: proof
// for a requirement is an answer that named it and used a fact of its CV line; "Things to practice" are
// at most three, one per question, the clearest first; a retried answer replaces the earlier one.
import { describe, expect, it } from "vitest";
import { askAbout } from "@/lib/interview/pack";
import { measureAnswer } from "@/lib/interview/measure";
import {
  latestTurns, listWords, numberSpan, progress, proofSoFar, requirementStates, summarize, type TurnLike,
} from "@/lib/interview/report";
import { emptyCvData, type CvData, type InterviewPack } from "@/lib/types";

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
