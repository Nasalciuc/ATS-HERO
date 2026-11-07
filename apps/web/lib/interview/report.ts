/**
 * Interview Trainer: what a session showed, and the job's progress, without AI (ANTRENOR-INTERVIU-VOCE.md
 * B7 and §12.2, screens 4 and 5).
 *
 * Everything here is counted from the answers, the CV lines the questions are tied to, and the post's
 * requirements read the way Job Fit reads them. Nothing is a grade (IV-6, IV-17):
 * - a requirement has **proof** in a session when an answer named it and used a fact (a number, a tool)
 *   of its question's CV line; it was **asked** when a question asked about it or an answer named it;
 * - "What went well" and "Things to practice" only say what the counts show, each tied to a question;
 * - a retried answer replaces the earlier one in the report; the earlier one stays in the session.
 * The model's judgement (STAR with quotes, vague phrases, English, a stronger answer) comes in step 5.
 */
import { findSkills } from "@/lib/job-fit";
import { measuredCriteria, numbersIn } from "./measure";
import type { AskItem } from "./pack";
import type {
  CvBulletRef, InterviewCriterion, InterviewKind, InterviewMeasures, InterviewPack, InterviewQuestion,
} from "@/lib/types";

export const KIND_LABEL: Record<InterviewKind, string> = {
  recruiter: "Recruiter screen",
  technical: "Technical",
  manager: "Hiring manager",
};

/** "Things to practice" lists at most this many (B7: exactly three when there are three). */
export const PRACTICE_MAX = 3;
/** Below this, an answer is short enough to ask for an example. */
export const SHORT_ANSWER_WORDS = 30;
/** A filler word is worth practising when it came up this many times in the session. */
const FILLER_SESSION_MIN = 4;

/** What the report needs of a turn: interview_turns as stored. */
export type TurnLike = {
  questionId: string;
  position: number;
  answer: string | null;
  measures: InterviewMeasures | null;
};

/** A requirement's place in one session. */
export type ReqState = "proof" | "asked" | "not_asked";

const keysIn = (text: string) => new Set(findSkills(text).map((h) => h.key));
const hits = (keys: Set<string>, item: Pick<AskItem, "keys">) => item.keys.some((k) => keys.has(k));

/** "SQL, Python and Power BI" */
export function listWords(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** Each question of the pack with its latest turn (a retry replaces the earlier answer), in the pack's order. */
export function latestTurns<T extends TurnLike>(pack: InterviewPack, turns: T[]): { question: InterviewQuestion; turn: T | null; tries: number }[] {
  return pack.questions.map((question) => {
    const mine = turns.filter((t) => t.questionId === question.id).sort((a, b) => a.position - b.position);
    return { question, turn: mine.at(-1) ?? null, tries: mine.filter((t) => t.answer != null).length };
  });
}

/** The post's requirements an answer names, as Job Fit names them. */
export function requirementsNamed(answer: string, items: AskItem[]): string[] {
  const keys = keysIn(answer);
  return items.filter((i) => hits(keys, i)).map((i) => i.label);
}

/** Each requirement's state in a session, in the order of `items`. */
export function requirementStates(pack: InterviewPack, turns: TurnLike[], items: AskItem[]): ReqState[] {
  const latest = latestTurns(pack, turns).filter((x) => x.turn);
  return items.map((item) => {
    let state: ReqState = "not_asked";
    for (const { question, turn } of latest) {
      const asked = Boolean(question.requirement) && hits(keysIn(question.requirement as string), item);
      const named = turn?.answer != null && hits(keysIn(turn.answer), item);
      if (named && (turn?.measures?.cvFacts?.used.length ?? 0) > 0) return "proof";
      if (asked || named) state = "asked";
    }
    return state;
  });
}

/**
 * The part of a CV line that holds these numbers, to quote it: "6 hours to 1" in "Cut the report from
 * 6 hours to 1 with SQL". A lone number takes the word after it ("40 people"). Null when none is there.
 */
export function numberSpan(line: string, numbers: string[]): string | null {
  const found = numbersIn(line).filter((n) => numbers.includes(n.text));
  if (!found.length) return null;
  const start = found[0].start;
  let end = found[found.length - 1].end;
  if (end - start > 40) end = found[0].end;
  if (found.length === 1 || end === found[0].end) {
    // "40" alone says little: "40 operations staff" → "40 operations"
    if (/^\d+$/.test(line.slice(start, end))) end += line.slice(end).match(/^\s+[\p{L}][\p{L}'’-]*/u)?.[0].length ?? 0;
  }
  return line.slice(start, end);
}

export type QuestionReport = {
  /** 1-based, as the session asked it */
  n: number;
  id: string;
  text: string;
  requirement: string | null;
  bullet: CvBulletRef;
  state: "answered" | "skipped" | "not_reached";
  answer: string | null;
  tries: number;
  criteria: InterviewCriterion[];
  /** the post's requirements the answer named */
  named: string[];
  /** the CV line's facts the answer used, and those it didn't */
  used: string[];
  unused: string[];
  measures: InterviewMeasures | null;
};

export type PracticeItem = { text: string; detail: string; n: number | null };

export type NoProof = {
  label: string;
  /** the CV shows it: a line, or the skills list */
  inCv: boolean;
  /** the question that asked about it, if one was reached */
  askedIn: number | null;
  /** an answer named it, without a fact from its CV line */
  named: boolean;
};

export type SessionSummary = {
  total: number;
  answered: number;
  skipped: number;
  wentWell: string[];
  toPractice: PracticeItem[];
  /** "Practice these again": the lines and requirements of the questions to practise */
  focus: { ref: string; requirement: string | null }[];
  noProof: NoProof[];
  /** averages over the answers; null before the first answer */
  measured: { averageSeconds: number; averageWords: number; wordsPerMinute: number | null; fillers: number } | null;
  fillerWords: { word: string; count: number }[];
  /** the post's requirements named across the session */
  named: string[];
  questions: QuestionReport[];
};

const ofAnswers = (k: number, n: number) => (n === 1 ? "your answer" : k === n ? `all ${n} answers` : `${k} of ${n} answers`);

/** The report of one session: the questions, what went well, what to practise, what has no proof yet. */
export function summarize(input: { pack: InterviewPack; turns: TurnLike[]; items: AskItem[] }): SessionSummary {
  const { pack, items } = input;
  const latest = latestTurns(pack, input.turns);
  const questions: QuestionReport[] = latest.map(({ question, turn, tries }, i) => {
    const answer = turn?.answer ?? null;
    const m = turn?.measures ?? null;
    return {
      n: i + 1,
      id: question.id,
      text: question.text,
      requirement: question.requirement,
      bullet: question.bullet,
      state: !turn ? "not_reached" : answer == null ? "skipped" : "answered",
      answer,
      tries,
      criteria: answer != null && m ? measuredCriteria(answer, m, question.requirement) : [],
      named: answer != null ? requirementsNamed(answer, items) : [],
      used: m?.cvFacts?.used ?? [],
      unused: m?.cvFacts?.unused ?? [],
      measures: m,
    };
  });
  const answered = questions.filter((q) => q.state === "answered");
  const skipped = questions.filter((q) => q.state === "skipped");
  const named = items.filter((i) => answered.some((q) => q.named.includes(i.label))).map((i) => i.label);

  // what went well: only what the counts show
  const wentWell: string[] = [];
  const withFacts = answered.filter((q) => q.used.length > 0).length;
  if (withFacts) wentWell.push(`You used facts from your CV in ${ofAnswers(withFacts, answered.length)}.`);
  if (named.length) wentWell.push(`You named what the job asks for: ${listWords(named)}.`);
  if (answered.length > 1 && !skipped.length && answered.length === questions.length)
    wentWell.push(`You answered all ${questions.length} questions.`);

  // things to practise: the clearest first, one per question, at most three
  type Candidate = PracticeItem & { rank: number; q: QuestionReport | null };
  const candidates: Candidate[] = [];
  for (const q of questions) {
    if (q.state === "answered") {
      const numbers = q.unused.filter((f) => /\d/.test(f));
      if (numbers.length && !q.used.some((f) => /\d/.test(f))) {
        const span = numberSpan(q.bullet.text, numbers);
        candidates.push({ rank: 1, q, n: q.n, text: "Say the result in numbers.", detail: `Question ${q.n}: “${span ?? numbers[0]}” is in your CV.` });
      }
      if (q.requirement && q.criteria.some((c) => c.key === "requirement" && !c.met))
        candidates.push({ rank: 2, q, n: q.n, text: `Name ${q.requirement} in your answer.`, detail: `Question ${q.n} asked about it.` });
      const words = q.measures?.words ?? 0;
      if (words < SHORT_ANSWER_WORDS)
        candidates.push({ rank: 4, q, n: q.n, text: "Give one example: what you did, and what changed.", detail: `Question ${q.n}: ${words} ${words === 1 ? "word" : "words"}.` });
    } else if (q.state === "skipped") {
      candidates.push({ rank: 3, q, n: q.n, text: `Answer question ${q.n}.`, detail: "You skipped it." });
    }
  }
  const fillerWords = mergeFillers(answered.map((q) => q.measures?.fillers ?? []));
  if (fillerWords[0] && fillerWords[0].count >= FILLER_SESSION_MIN)
    candidates.push({ rank: 5, q: null, n: null, text: "Leave out the filler words.", detail: `“${fillerWords[0].word}” came up ${fillerWords[0].count} times.` });
  candidates.sort((a, b) => a.rank - b.rank || (a.n ?? 99) - (b.n ?? 99));
  const picked: Candidate[] = [];
  for (const c of candidates) {
    if (picked.length >= PRACTICE_MAX) break;
    if (c.q && picked.some((p) => p.q?.id === c.q?.id)) continue;
    picked.push(c);
  }
  const toPractice = picked.map(({ text, detail, n }) => ({ text, detail, n }));
  const focus = picked.flatMap((p) => (p.q ? [{ ref: p.q.bullet.ref, requirement: p.q.requirement }] : []));

  // the required items with no proof in this session
  const states = requirementStates(pack, input.turns, items);
  const noProof: NoProof[] = items.flatMap((item, i) => {
    if (!item.required || states[i] === "proof") return [];
    const asked = questions.find((q) => q.state !== "not_reached" && q.requirement && hits(keysIn(q.requirement), item));
    return [{ label: item.label, inCv: Boolean(item.proof) || item.listed, askedIn: asked?.n ?? null, named: named.includes(item.label) }];
  });

  const measuredOf = answered.map((q) => q.measures).filter((m): m is InterviewMeasures => Boolean(m));
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const rates = measuredOf.map((m) => m.wordsPerMinute).filter((r) => r > 0);
  return {
    total: questions.length,
    answered: answered.length,
    skipped: skipped.length,
    wentWell: wentWell.slice(0, 3),
    toPractice,
    focus,
    noProof,
    measured: measuredOf.length
      ? {
          averageSeconds: mean(measuredOf.map((m) => m.seconds)),
          averageWords: mean(measuredOf.map((m) => m.words)),
          wordsPerMinute: rates.length ? mean(rates) : null,
          fillers: measuredOf.reduce((a, m) => a + m.fillers.reduce((b, f) => b + f.count, 0), 0),
        }
      : null,
    fillerWords,
    named,
    questions,
  };
}

function mergeFillers(lists: { word: string; count: number }[][]): { word: string; count: number }[] {
  const all = new Map<string, number>();
  for (const list of lists) for (const f of list) all.set(f.word, (all.get(f.word) ?? 0) + f.count);
  return [...all].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

export type ProgressSession = { id: string; at: number; kind: InterviewKind; pack: InterviewPack; turns: TurnLike[] };
export type Progress = {
  columns: { id: string; at: number; kind: InterviewKind }[];
  rows: { label: string; required: boolean; states: ReqState[] }[];
};

/** Progress columns: the last sessions for the job, oldest first. */
export const PROGRESS_COLUMNS = 3;

/**
 * The job's requirements across its sessions (IV-21): from the second session on, else null. The
 * columns are the last few sessions, oldest first; the rows, what the job asks today.
 */
export function progress(sessions: ProgressSession[], items: AskItem[]): Progress | null {
  if (sessions.length < 2 || !items.length) return null;
  const cols = [...sessions].sort((a, b) => a.at - b.at).slice(-PROGRESS_COLUMNS);
  const states = cols.map((s) => requirementStates(s.pack, s.turns, items));
  return {
    columns: cols.map((s) => ({ id: s.id, at: s.at, kind: s.kind })),
    rows: items.map((item, i) => ({ label: item.label, required: item.required, states: states.map((st) => st[i]) })),
  };
}

/** Over every session for a job: the requirements with proof, and the required ones still without it. */
export function proofSoFar(sessions: Pick<ProgressSession, "pack" | "turns">[], items: AskItem[]): { proven: string[]; notYet: string[] } {
  const proven = new Set<string>();
  for (const s of sessions) requirementStates(s.pack, s.turns, items).forEach((st, i) => st === "proof" && proven.add(items[i].label));
  return {
    proven: items.filter((i) => proven.has(i.label)).map((i) => i.label),
    notYet: items.filter((i) => i.required && !proven.has(i.label)).map((i) => i.label),
  };
}
