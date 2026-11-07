/**
 * Interview Trainer: what an answer measured, without AI (ANTRENOR-INTERVIU-VOCE.md §5 and B4; IV-6, IV-17).
 *
 * Counts from the answer's words and its time, shown as information, never as a grade: how long it
 * took, how many words, words per minute and the pauses over 3 seconds (spoken answers only: typing
 * speed says nothing about an interview), and the filler words used more than once. Plus two checks
 * against the job and the CV, made the way Job Fit reads skills:
 * - which of the question's requirements the answer named ("Requirement covered");
 * - which facts of the question's CV line the answer used: its numbers and its tools ("Proof from
 *   your CV"). A number the line has and the answer didn't say is a hint: "it's already in your CV".
 * The judgement calls (the STAR parts, vague phrases, English) are the model's, with a quote (step 5).
 */
import { findSkills } from "@/lib/job-fit";
import type { CvBulletRef, InterviewCriterion, InterviewMeasures, InterviewMode } from "@/lib/types";

/** A pause this long or longer counts (B4: "pauses over 3 seconds"). */
export const LONG_PAUSE_S = 3;
/** A filler word is listed from this many uses in one answer: once is how people talk ("doar peste un prag"). */
export const FILLER_MIN = 2;
/** Below this, a spoken answer is too short for words per minute to mean anything. */
const MIN_SECONDS_FOR_RATE = 10;

/** The filler words and phrases counted, and where they count. */
const FILLERS: { word: string; re: RegExp }[] = [
  { word: "um", re: /(?<![\p{L}\p{N}])u+m+(?![\p{L}\p{N}])/giu },
  { word: "uh", re: /(?<![\p{L}\p{N}])u+h+(?![\p{L}\p{N}])/giu },
  { word: "erm", re: /(?<![\p{L}\p{N}])e+r+m+(?![\p{L}\p{N}])/giu },
  { word: "you know", re: /(?<![\p{L}\p{N}])you know(?![\p{L}\p{N}])(?!\s+(?:how|what|why|when|where|who|that|if|the|a|an|it)\b)/giu },
  { word: "I mean", re: /(?<![\p{L}\p{N}])i mean(?![\p{L}\p{N}])(?=\s*[,.]|\s+(?:it|we|the|like|you)\b)/giu },
  { word: "kind of", re: /(?<![\p{L}\p{N}])kind of(?![\p{L}\p{N}])/giu },
  { word: "sort of", re: /(?<![\p{L}\p{N}])sort of(?![\p{L}\p{N}])/giu },
  { word: "basically", re: /(?<![\p{L}\p{N}])basically(?![\p{L}\p{N}])/giu },
  { word: "actually", re: /(?<![\p{L}\p{N}])actually(?![\p{L}\p{N}])/giu },
  { word: "literally", re: /(?<![\p{L}\p{N}])literally(?![\p{L}\p{N}])/giu },
  // "like" only as a filler: set off by commas ("it was, like, huge"), never "I like" or "like this one"
  { word: "like", re: /(?<=,\s*|^\s*|[.!?]\s+)like(?=\s*,)/giu },
  // "so" only where it starts a sentence, after another filler or not: "So the report took…", "Um, so…"
  { word: "so", re: /(?<=(?:^|[.!?])\s*(?:(?:u+m+|u+h+|e+r+m+|well|okay|ok),?\s+)?)so(?![\p{L}\p{N}])/giu },
];

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
/** The sentence of the answer that holds this part of it, for the quote. */
const sentenceAt = (text: string, index: number) => {
  let start = 0;
  for (const s of sentencesOf(text)) {
    const at = text.indexOf(s, start);
    if (index >= at && index < at + s.length) return s;
    start = at + s.length;
  }
  return text.trim();
};

/** "6 hours", "45%", "120k", "2.3M", "40": the numbers a line gives, as they're written. */
const NUMBER = /(?<![\p{L}\p{N}.,])\d+(?:[.,]\d+)?\s*(?:%|k\b|m\b|bn\b|x\b)?/giu;
/** One key per number however it's written: "45%" and "45" meet, "2.3M" and "2,3m" meet. */
const numberKey = (n: string) => n.toLowerCase().replace(/\s+/g, "").replace(",", ".").replace(/%$/, "");

const SMALL: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const DIGIT: Record<string, number> = { one: 1, ...Object.fromEntries(Object.entries(SMALL).filter(([, n]) => n < 10)) };
const SCALE: Record<string, string> = { hundred: "00", thousand: "k", million: "m" };
/**
 * Numbers said in words, as digits, so a transcript's "six hours to one" meets the CV's "6 hours to 1":
 * "forty-five percent" → "45%", "two million" → "2m". "One" counts only next to a unit or after "to"/"from"
 * ("one of the teams" is not a number).
 */
export function spokenNumbers(text: string): string {
  const units = "(?:hours?|days?|weeks?|months?|years?|minutes?|people|persons?|teams?|engineers?|percent|per cent|%)";
  return text
    .replace(new RegExp(`(?<![\\p{L}])(${Object.keys(TENS).join("|")})(?:[- ](${Object.keys(DIGIT).filter((w) => w !== "one").join("|")}|one))?(?:\\s+(hundred|thousand|million))?(?![\\p{L}])`, "giu"),
      (_, t: string, d: string | undefined, s: string | undefined) => `${TENS[t.toLowerCase()] + (d ? DIGIT[d.toLowerCase()] : 0)}${s ? SCALE[s.toLowerCase()] : ""}`)
    .replace(new RegExp(`(?<![\\p{L}])(${Object.keys(SMALL).join("|")})(?:\\s+(hundred|thousand|million))?(?![\\p{L}])`, "giu"),
      (_, w: string, s: string | undefined) => `${SMALL[w.toLowerCase()]}${s ? SCALE[s.toLowerCase()] : ""}`)
    .replace(new RegExp(`(?<=\\b(?:to|from)\\s+)one(?![\\p{L}])|(?<![\\p{L}])one(?=\\s+${units}(?![\\p{L}]))`, "giu"), "1")
    .replace(/(\d)\s*(?:percent|per cent)\b/giu, "$1%");
}

export type AnswerInput = {
  text: string;
  /** how long the answer took, in seconds */
  seconds: number;
  mode: InterviewMode;
  /** spoken answers: the silences inside the answer, in seconds */
  pauses?: number[];
  /** the question's requirement ("React and TypeScript"), if it asks about one */
  requirement?: string | null;
  /** the question's CV line */
  bullet?: CvBulletRef | null;
};

/** The measures of one answer: counts and matches, no judgement. */
export function measureAnswer(input: AnswerInput): InterviewMeasures {
  const text = input.text.normalize("NFKC");
  const words = text.match(WORD)?.length ?? 0;
  const seconds = Math.max(0, Math.round(input.seconds));
  const spoken = input.mode === "voice";
  const fillers = FILLERS
    .map((f) => ({ word: f.word, count: [...text.matchAll(f.re)].length }))
    .filter((f) => f.count >= FILLER_MIN)
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  return {
    seconds,
    words,
    wordsPerMinute: spoken && seconds >= MIN_SECONDS_FOR_RATE ? Math.round(words / (seconds / 60)) : 0,
    longPauses: spoken ? (input.pauses ?? []).filter((p) => p >= LONG_PAUSE_S).length : 0,
    fillers,
    named: namedIn(text, input.requirement ?? null),
    cvFacts: input.bullet ? cvFactsIn(text, input.bullet.text) : { used: [], unused: [] },
  };
}

/** The requirement's skills the answer names, as Job Fit names them ("TypeScript"). */
export function namedIn(answer: string, requirement: string | null): string[] {
  if (!requirement) return [];
  const keys = new Set(findSkills(requirement).map((h) => h.key));
  return [...new Set(findSkills(answer).filter((h) => keys.has(h.key)).map((h) => h.name))];
}

/** The CV line's facts (numbers, tools) the answer used, and those it didn't. */
export function cvFactsIn(answer: string, line: string): { used: string[]; unused: string[] } {
  const said = new Set([...spokenNumbers(answer.normalize("NFKC")).matchAll(NUMBER)].map((m) => numberKey(m[0])));
  const saidSkills = new Set(findSkills(answer).map((h) => h.key));
  const used: string[] = [];
  const unused: string[] = [];
  for (const m of line.normalize("NFKC").matchAll(NUMBER)) {
    const n = m[0].trim();
    (said.has(numberKey(n)) ? used : unused).push(n);
  }
  for (const h of findSkills(line)) (saidSkills.has(h.key) ? used : unused).push(h.name);
  const uniq = (xs: string[]) => [...new Set(xs)];
  return { used: uniq(used), unused: uniq(unused).filter((x) => !used.includes(x)) };
}

/**
 * The two criteria the measures decide, with the answer's words as the quote: the requirement (when
 * the question asks about one) and the proof from the CV line.
 */
export function measuredCriteria(answer: string, m: InterviewMeasures, requirement: string | null): InterviewCriterion[] {
  const quoteOf = (needles: string[]) => {
    const lower = answer.toLowerCase();
    for (const n of needles) {
      const i = lower.indexOf(n.toLowerCase());
      if (i >= 0) return sentenceAt(answer, i);
    }
    return null;
  };
  const out: InterviewCriterion[] = [];
  if (requirement) out.push({ key: "requirement", met: (m.named ?? []).length > 0, quote: quoteOf(m.named ?? []) });
  const used = m.cvFacts?.used ?? [];
  out.push({ key: "proof", met: used.length > 0, quote: quoteOf(used) });
  return out;
}
