/**
 * Interview Trainer: what a session showed, and the job's progress, without AI (ANTRENOR-INTERVIU-VOCE.md
 * B7 and §12.2, screens 4 and 5).
 *
 * Everything here is counted from the answers, the CV lines the questions are tied to, and the post's
 * requirements read the way Job Fit reads them. Nothing is a grade (IV-6, IV-17):
 * - a requirement has **proof** in a session when an answer named it and used a fact (a number, a tool)
 *   of its question's CV line; it was **asked** when a question asked about it or an answer named it;
 * - "What went well" and "Things to practice" only say what the counts show, each tied to a question;
 * - a retried answer replaces the earlier one in the report; the earlier one stays in the session;
 * - a question's follow-ups belong to its answer: what the person said in them counts with it.
 *
 * When the interviewer was the model (step 5), a question also has the model's feedback, as it was
 * kept after our checks (feedback.ts): the parts of the answer with the person's words, vague
 * phrases, English notes and a stronger answer. The report only counts over it: which notes still
 * stand, which kind of note came up more than once, which part an answer lacked.
 */
import { findSkills } from "@/lib/job-fit";
import { measuredCriteria, mergeMeasures, numbersIn } from "./measure";
import type { AskItem } from "./pack";
import type {
  CvBulletRef, EnglishKind, InterviewCriterion, InterviewFeedback, InterviewKind, InterviewMeasures, InterviewPack,
  InterviewQuestion, InterviewStyle,
} from "@/lib/types";

export const KIND_LABEL: Record<InterviewKind, string> = {
  recruiter: "Recruiter screen",
  technical: "Technical",
  manager: "Hiring manager",
};

export const STYLE_LABEL: Record<InterviewStyle, string> = { friendly: "Friendly", neutral: "Neutral", tough: "Tough" };

/** What a kind of English note is called in the report, and what to practise when it comes up again (B2). */
export const ENGLISH_LABEL: Record<EnglishKind, string> = {
  tense: "Verb tense",
  preposition: "Prepositions",
  article: "Articles (a, an, the)",
  agreement: "Subject and verb",
  word_form: "Word forms",
  word_choice: "Word choice",
  word_order: "Word order",
  plural: "Plurals",
  other: "Other",
};
const ENGLISH_PRACTICE: Partial<Record<EnglishKind, string>> = {
  tense: "Keep to the past tense when you tell what happened.",
  preposition: "Check the prepositions you use most.",
  article: "Say a, an and the where English needs them.",
  agreement: "Match the verb to its subject.",
  word_form: "Check the form of the words you weren’t sure of.",
  word_choice: "Check the words you weren’t sure of.",
  word_order: "Keep to the usual English word order.",
  plural: "Check your plurals.",
};

/** "Things to practice" lists at most this many (B7: exactly three when there are three). */
export const PRACTICE_MAX = 3;
/** Below this, an answer is short enough to ask for an example. */
export const SHORT_ANSWER_WORDS = 30;
/** A filler word is worth practising when it came up this many times in the session. */
const FILLER_SESSION_MIN = 4;

/**
 * What the report needs of a turn: interview_turns as stored. A turn with no `kind` is a question's
 * own (every turn was, before follow-ups).
 */
export type TurnLike = {
  id?: string;
  questionId: string;
  position: number;
  kind?: "question" | "follow_up";
  /** the question as it was asked; a follow-up's own words */
  question?: string;
  answer: string | null;
  measures: InterviewMeasures | null;
  feedback?: InterviewFeedback | null;
  better?: string | null;
  dismissed?: number[] | null;
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

/** One try at a question: the question's own turn, then the follow-ups asked on its answer, in order. */
export type Exchange<T extends TurnLike = TurnLike> = { turn: T; follow: T[] };

/** A session's turns as tries, in the order they were given. A follow-up belongs to the latest try at its question. */
export function exchangesOf<T extends TurnLike>(turns: T[]): Exchange<T>[] {
  const out: Exchange<T>[] = [];
  for (const t of [...turns].sort((a, b) => a.position - b.position)) {
    if ((t.kind ?? "question") === "question") {
      out.push({ turn: t, follow: [] });
      continue;
    }
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i].turn.questionId === t.questionId) {
        out[i].follow.push(t);
        break;
      }
    }
  }
  return out;
}

/** What the person said in one try: the question's answer, then each follow-up's. A skipped one says nothing. */
export const answersOf = (x: Exchange) => [x.turn, ...x.follow].map((t) => t.answer).filter((a): a is string => a != null);
/** What one try measured, over all its answers. */
export const measuresOf = (x: Exchange) => mergeMeasures([x.turn, ...x.follow].map((t) => t.measures).filter((m): m is InterviewMeasures => m != null));

/**
 * Each question of the pack with its latest try (a retry replaces the earlier answer), in the pack's
 * order: the question's own turn, its follow-ups, what the person said in them and what that measured.
 */
export function latestTurns<T extends TurnLike>(pack: InterviewPack, turns: T[]): {
  question: InterviewQuestion; turn: T | null; follow: T[]; answers: string[]; measures: InterviewMeasures | null; tries: number;
}[] {
  const all = exchangesOf(turns);
  return pack.questions.map((question) => {
    const mine = all.filter((x) => x.turn.questionId === question.id);
    const last = mine.at(-1);
    return {
      question,
      turn: last?.turn ?? null,
      follow: last?.follow ?? [],
      answers: last ? answersOf(last) : [],
      measures: last ? measuresOf(last) : null,
      tries: mine.filter((x) => x.turn.answer != null).length,
    };
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
    for (const { question, answers, measures } of latest) {
      const asked = Boolean(question.requirement) && hits(keysIn(question.requirement as string), item);
      const named = answers.length > 0 && hits(keysIn(answers.join("\n")), item);
      if (named && (measures?.cvFacts?.used.length ?? 0) > 0) return "proof";
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

/** The model's feedback on one try, as the screens read it: what still stands of what was kept. */
export type AiFeedback = {
  /** the situation, the task, the action and the result: those the model could show with the person's words, or found missing */
  criteria: InterviewCriterion[];
  vague: { phrase: string; ask: string }[];
  /** the notes not marked "I said it right", each with its place in what was kept */
  english: { index: number; quote: string; better: string; why: string | null; kind: EnglishKind | null }[];
  /** notes the person marked "I said it right": not shown, not counted */
  dismissed: number;
  stronger: string | null;
  /** the model wrote one, and our check refused it */
  strongerRefused: boolean;
};

/** The model's feedback on a try, from its question's turn; null when there is none. */
export function aiFeedbackOf(turn: Pick<TurnLike, "feedback" | "better" | "dismissed">): AiFeedback | null {
  const f = turn.feedback;
  if (!f) return null;
  const gone = new Set(turn.dismissed ?? []);
  return {
    criteria: f.criteria,
    vague: f.vague,
    english: f.english.flatMap((n, index) => (gone.has(index) ? [] : [{ index, quote: n.quote, better: n.better, why: n.why ?? null, kind: n.kind ?? null }])),
    dismissed: f.english.filter((_, index) => gone.has(index)).length,
    stronger: turn.better ?? null,
    strongerRefused: Boolean(f.strongerRefused),
  };
}

export type QuestionReport = {
  /** 1-based, as the session asked it */
  n: number;
  id: string;
  text: string;
  requirement: string | null;
  bullet: CvBulletRef;
  state: "answered" | "skipped" | "not_reached";
  /** the latest try's own turn: the model's feedback is kept on it */
  turnId: string | null;
  answer: string | null;
  /** the follow-ups the interviewer asked on that answer, each with what the person said (null: skipped) */
  follow: { question: string; answer: string | null }[];
  tries: number;
  criteria: InterviewCriterion[];
  /** the post's requirements the answers named */
  named: string[];
  /** the CV line's facts the answers used, and those they didn't */
  used: string[];
  unused: string[];
  /** over the question's answer and its follow-ups' */
  measures: InterviewMeasures | null;
  /** the model's feedback; null in a session without it, or while it isn't made yet */
  ai: AiFeedback | null;
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

/** A kind of English note that came up more than once in a session, with one of its notes (B2). */
export type EnglishPattern = { kind: EnglishKind; label: string; count: number; example: { quote: string; better: string } };

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
  /**
   * English over the session, from the model's notes: how many still stand, how many the person said
   * were right, and what came up more than once. Null when no answer has the model's feedback.
   */
  english: { notes: number; dismissed: number; patterns: EnglishPattern[] } | null;
  questions: QuestionReport[];
};

const ofAnswers = (k: number, n: number) => (n === 1 ? "your answer" : k === n ? `all ${n} answers` : `${k} of ${n} answers`);
/** A kind of note is a pattern from its second note. */
const PATTERN_MIN = 2;
const part = (q: QuestionReport, key: InterviewCriterion["key"]) => q.ai?.criteria.find((c) => c.key === key);

/** The report of one session: the questions, what went well, what to practise, what has no proof yet. */
export function summarize(input: { pack: InterviewPack; turns: TurnLike[]; items: AskItem[] }): SessionSummary {
  const { pack, items } = input;
  const latest = latestTurns(pack, input.turns);
  const questions: QuestionReport[] = latest.map(({ question, turn, follow, answers, measures, tries }, i) => {
    const answer = turn?.answer ?? null;
    const said = answers.join("\n");
    return {
      n: i + 1,
      id: question.id,
      text: question.text,
      requirement: question.requirement,
      bullet: question.bullet,
      state: !turn ? "not_reached" : answer == null ? "skipped" : "answered",
      turnId: turn?.id ?? null,
      answer,
      follow: follow.map((t) => ({ question: t.question ?? "", answer: t.answer })),
      tries,
      criteria: answer != null && measures ? measuredCriteria(answers, measures, question.requirement) : [],
      named: answer != null ? requirementsNamed(said, items) : [],
      used: measures?.cvFacts?.used ?? [],
      unused: measures?.cvFacts?.unused ?? [],
      measures,
      ai: turn && answer != null ? aiFeedbackOf(turn) : null,
    };
  });
  const answered = questions.filter((q) => q.state === "answered");
  const skipped = questions.filter((q) => q.state === "skipped");
  const named = items.filter((i) => answered.some((q) => q.named.includes(i.label))).map((i) => i.label);
  const read = answered.filter((q) => q.ai);

  // English: the notes that still stand, by kind
  const notes = read.flatMap((q) => q.ai?.english ?? []);
  const patterns: EnglishPattern[] = (Object.keys(ENGLISH_LABEL) as EnglishKind[])
    .filter((kind) => kind !== "other")
    .map((kind) => ({ kind, of: notes.filter((n) => n.kind === kind) }))
    .filter(({ of }) => of.length >= PATTERN_MIN)
    .sort((a, b) => b.of.length - a.of.length)
    .map(({ kind, of }) => ({ kind, label: ENGLISH_LABEL[kind], count: of.length, example: { quote: of[0].quote, better: of[0].better } }));

  // what went well: only what the counts show
  const wentWell: string[] = [];
  const withFacts = answered.filter((q) => q.used.length > 0).length;
  if (withFacts) wentWell.push(`You used facts from your CV in ${ofAnswers(withFacts, answered.length)}.`);
  if (named.length) wentWell.push(`You named what the job asks for: ${listWords(named)}.`);
  const withResult = read.filter((q) => part(q, "result")?.met).length;
  if (withResult) wentWell.push(`You said what came of it in ${ofAnswers(withResult, read.length)}.`);
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
      if (part(q, "result")?.met === false)
        candidates.push({ rank: 1.5, q, n: q.n, text: "Say what came of it.", detail: `Question ${q.n}: the answer had no result.` });
      if (q.requirement && q.criteria.some((c) => c.key === "requirement" && !c.met))
        candidates.push({ rank: 2, q, n: q.n, text: `Name ${q.requirement} in your answer.`, detail: `Question ${q.n} asked about it.` });
      if (part(q, "action")?.met === false)
        candidates.push({ rank: 2.5, q, n: q.n, text: "Say what you did yourself, step by step.", detail: `Question ${q.n}: the answer didn’t say it.` });
      if (q.ai?.vague.length)
        candidates.push({ rank: 3.5, q, n: q.n, text: "Make it concrete.", detail: `Question ${q.n}: “${q.ai.vague[0].phrase}”.` });
      const words = q.measures?.words ?? 0;
      if (words < SHORT_ANSWER_WORDS)
        candidates.push({ rank: 4, q, n: q.n, text: "Give one example: what you did, and what changed.", detail: `Question ${q.n}: ${words} ${words === 1 ? "word" : "words"}.` });
    } else if (q.state === "skipped") {
      candidates.push({ rank: 3, q, n: q.n, text: `Answer question ${q.n}.`, detail: "You skipped it." });
    }
  }
  const practiseEnglish = patterns.find((x) => ENGLISH_PRACTICE[x.kind]);
  if (practiseEnglish)
    candidates.push({ rank: 4.5, q: null, n: null, text: ENGLISH_PRACTICE[practiseEnglish.kind] as string, detail: `${practiseEnglish.count} times.` });
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
    english: read.length ? { notes: notes.length, dismissed: read.reduce((a, q) => a + (q.ai?.dismissed ?? 0), 0), patterns } : null,
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
