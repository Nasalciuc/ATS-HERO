/**
 * Interview Trainer: the model's feedback on one answer (ANTRENOR-INTERVIU-VOCE.md §5, B2, B3; IV-6,
 * IV-7, IV-12, IV-13), next to what the answer measured without AI (measure.ts).
 *
 * The model reads the question, the CV line it is about and what the person answered (with the
 * follow-ups), and says:
 * - which parts of a clear answer are there: the situation, the task, the action, the result, each
 *   with the person's words;
 * - which phrases are vague, each with the question that asks for the concrete thing. It never
 *   rewrites them and never gives a verdict;
 * - when the person left English notes on: up to three, on grammar and wording only;
 * - a stronger answer, made only from what the person said and the CV line.
 *
 * The model proposes; the code decides (checkFeedback):
 * - a part counts as there only with a quote that is in an answer word for word; one whose quote
 *   isn't is asked for again, then left out, never shown as "missing";
 * - a vague phrase or an English note whose quote isn't in an answer is dropped; a note never
 *   changes a number, and never speaks of accent or pronunciation;
 * - a stronger answer with a number, a quantity, a tool or a name that is in neither the answers nor
 *   the CV line is refused whole (guard.ts): asked for once more, then not shown.
 * No score, no grade, nothing about how the person sounded or felt (IV-6, IV-17).
 */
import { z } from "zod";
import { DATA_RULE } from "@/lib/ai/data";
import type { EnglishKind, InterviewCriterion, InterviewFeedback, InterviewKind } from "@/lib/types";
import { asksAboutPrivateLife, findQuote, inventedFacts, isRude } from "./guard";
import { numberKey, numbersIn, spokenNumbers } from "./measure";
import { runTask, type Checked, type Task, type TextModel } from "./model";
import { cvBlock, jobBlock, transcriptBlock, type ExchangePart } from "./prompt";
import { KIND_LABEL } from "./report";

/** IV-12: at most three English notes on an answer. Vague phrases take the same room. */
export const ENGLISH_NOTES_MAX = 3;
export const VAGUE_MAX = 3;
/** A stronger answer is one to say in about a minute, not a speech. */
export const STRONGER_MAX_WORDS = 200;
const STRONGER_MIN_CHARS = 40;
const QUOTE_SHOWN_MAX = 240;

export const ENGLISH_KINDS = ["tense", "preposition", "article", "agreement", "word_form", "word_choice", "word_order", "plural", "other"] as const satisfies readonly EnglishKind[];

const STAR = ["situation", "task", "action", "result"] as const;

export type FeedbackInput = {
  kind: InterviewKind;
  role: string;
  company: string;
  requirement: string | null;
  cvLine: string;
  /** the job the CV line comes from, when the CV still has the line */
  cvRole?: string;
  cvOrg?: string;
  /** the question and its answer, then each follow-up with its answer */
  exchange: ExchangePart[];
  /** the person left English notes on (IV-12) */
  english: boolean;
};

const INSTRUCTIONS = `You give feedback on one answer from a practice job interview. The candidate is practising for a real interview; many candidates are not native English speakers. Be exact and concrete. You do not grade, score, praise or encourage, and you never guess how the candidate felt or sounded.

You get the question, the line of the candidate's CV it is about, and what the candidate answered, to the question and to any follow-up questions. Return JSON with these parts.

"situation", "task", "action", "result": the four parts of a clear answer.
- situation: where and when this happened, or what the problem was.
- task: what the candidate was responsible for, or had to achieve.
- action: what the candidate did themselves, concretely. Not what "we" did, and not a duty ("I was responsible for reports").
- result: what changed because of it: a number, time saved, a decision taken, something delivered or used. "They were happy" is not a result.
For each part, "met" is true only when the candidate's own words say it. Then "quote" is the shortest piece of their answer that shows it, copied exactly, character for character, as one continuous piece of one answer. When the part is missing, "met" is false and "quote" is null. When in doubt, it is missing.

"vague": up to 3 phrases in the answers that say little ("I helped a lot", "various tasks", "improved things"). "phrase" is copied exactly from the answer. "ask" is the one short question whose answer would make it concrete ("Who used the report, and how much sooner did they get it?"). Do not rewrite the phrase and do not judge it. An empty list is right when nothing is vague.

"english": only when the prompt says English notes are on; otherwise an empty list. Up to 3 notes, the ones an interviewer would notice most: a wrong tense, a wrong preposition, a missing or wrong article, a verb that does not match its subject, a wrong word form, a wrong word, a wrong word order, a wrong plural. "quote" is the few words with the mistake, copied exactly from the answer. "better" is the same words corrected, and nothing more. "kind" is one of: tense, preposition, article, agreement, word_form, word_choice, word_order, plural, other. "why" is one short sentence. Only what is clearly wrong in standard English. Nothing about accent, pronunciation, spelling, capital letters, punctuation, filler words, style, or informal English that is correct. An empty list is right when nothing is clearly wrong.

"stronger": one stronger version of the answer, as the candidate could say it: first person, plain spoken English, 60 to 140 words, one paragraph. Build it ONLY from what the candidate said and from the CV line. You may reorder, cut and tighten, and say the situation, the task, the action and the result in that order. Do not add any number, tool, company, person, place, date or result that is in neither the candidate's answers nor the CV line. When the CV line has the result and the candidate did not say it, use the CV line's own numbers. Answer null when the candidate said too little to build on.

${DATA_RULE}

Answer with JSON only, in exactly this shape:
{"situation":{"met":true,"quote":"..."},"task":{"met":false,"quote":null},"action":{"met":true,"quote":"..."},"result":{"met":false,"quote":null},"vague":[{"phrase":"...","ask":"...?"}],"english":[{"quote":"...","better":"...","kind":"tense","why":"..."}],"stronger":"..."}`;

const Part = z.object({
  met: z.boolean().describe("true only when the candidate's own words say this part"),
  quote: z.string().nullable().describe("the candidate's words that show it, copied exactly; null when the part is missing"),
}).strict();

const FeedbackSchema = z.object({
  situation: Part,
  task: Part,
  action: Part,
  result: Part,
  vague: z.array(z.object({
    phrase: z.string().describe("a vague phrase, copied exactly from the candidate's answer"),
    ask: z.string().describe("the short question whose answer would make it concrete"),
  }).strict()),
  english: z.array(z.object({
    quote: z.string().describe("the few words with the mistake, copied exactly from the candidate's answer"),
    better: z.string().describe("the same words, corrected"),
    kind: z.enum(ENGLISH_KINDS),
    why: z.string().describe("one short sentence"),
  }).strict()),
  stronger: z.string().nullable().describe("a stronger version of the answer, from the candidate's words and the CV line only; or null"),
}).strict();
export type FeedbackOutput = z.infer<typeof FeedbackSchema>;

export const feedbackTask: Task<FeedbackInput, FeedbackOutput> = {
  name: "interview-feedback",
  prompt: {
    version: "interview-feedback.v1",
    instructions: INSTRUCTIONS,
    build(input) {
      return [
        `Interview: ${KIND_LABEL[input.kind]}.`,
        `English notes: ${input.english ? "on" : "off"}.`,
        "",
        "The job:",
        jobBlock(input),
        "The line of the candidate's CV the question is about:",
        cvBlock({ line: input.cvLine, role: input.cvRole, org: input.cvOrg }),
        "The question and the candidate's answers, oldest first:",
        transcriptBlock(input.exchange),
      ].join("\n");
    },
  },
  schema: FeedbackSchema,
  timeoutMs: 30_000,
};

export type Feedback = { feedback: InterviewFeedback; better: string | null };

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const sameWords = (a: string, b: string) => {
  const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return key(a) === key(b);
};
/** A long quote, shown up to a word's end: still the person's words. */
function shown(quote: string): string {
  if (quote.length <= QUOTE_SHOWN_MAX) return quote;
  const cut = quote.slice(0, QUOTE_SHOWN_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), QUOTE_SHOWN_MAX - 40)).trimEnd()}…`;
}
const numbersOf = (s: string) => numbersIn(spokenNumbers(s.normalize("NFKC"))).map((n) => numberKey(n.text));
/** What an interviewer's own line may not be: a question about private life, or a rude one. */
const unfit = (line: string) => asksAboutPrivateLife(line) || isRude(line);

/**
 * The model's feedback, as far as it holds. `problems` are what is worth one more answer from the
 * model: a part whose quote isn't the person's, a stronger answer with a fact from nowhere. The
 * rest (a vague phrase or a note that doesn't hold) is just left out.
 */
export function checkFeedback(o: FeedbackOutput, input: FeedbackInput): Checked<Feedback> {
  const answers = input.exchange.map((p) => p.answer).filter((a): a is string => a != null);
  const problems: string[] = [];

  const criteria: InterviewCriterion[] = [];
  for (const key of STAR) {
    if (!o[key].met) {
      criteria.push({ key, met: false, quote: null });
      continue;
    }
    const quote = o[key].quote ? findQuote(o[key].quote as string, answers) : null;
    // one word shows nothing: "Python" isn't an action
    if (quote && quote.trim().split(/\s+/).length >= 2) criteria.push({ key, met: true, quote: shown(quote) });
    else problems.push(`${key}.quote: not in the candidate's answers word for word; copy one continuous piece, or set "met" to false`);
  }

  const vague: InterviewFeedback["vague"] = [];
  for (const v of o.vague) {
    if (vague.length >= VAGUE_MAX) break;
    const phrase = findQuote(v.phrase, answers);
    const ask = oneLine(v.ask);
    if (!phrase || vague.some((x) => x.phrase === phrase)) continue;
    if (!ask.endsWith("?") || ask.length > 240 || unfit(ask)) continue;
    vague.push({ phrase: shown(phrase), ask });
  }

  const english: InterviewFeedback["english"] = [];
  for (const n of input.english ? o.english : []) {
    if (english.length >= ENGLISH_NOTES_MAX) break;
    const quote = findQuote(n.quote, answers);
    const better = oneLine(n.better).replace(/^["“”]+|["“”]+$/gu, "");
    const why = oneLine(n.why);
    if (!quote || english.some((x) => x.quote === quote)) continue;
    if (!better || sameWords(better, quote) || better.length > quote.length * 2 + 24) continue;
    // a note is about the English: it never changes a figure, and never speaks of how the person sounds
    const said = new Set(numbersOf(quote));
    if (numbersOf(better).some((k) => !said.has(k))) continue;
    if (/accent|pronounc|pronunciation/i.test(why) || why.length > 200 || isRude(why)) continue;
    english.push({ quote, better, kind: n.kind, ...(why ? { why } : {}) });
  }

  let better: string | null = null;
  let refused = false;
  const stronger = oneLine(o.stronger ?? "").replace(/^["“”]+|["“”]+$/gu, "").trim();
  if (stronger.length >= STRONGER_MIN_CHARS && !answers.some((a) => sameWords(a, stronger))) {
    const sources = [...input.exchange.map((p) => p.question), ...answers, input.cvLine, input.cvRole ?? "", input.cvOrg ?? "", input.role, input.company, input.requirement ?? ""];
    const invented = inventedFacts(stronger, sources);
    if (stronger.split(" ").length > STRONGER_MAX_WORDS) {
      refused = true;
      problems.push("stronger: too long; 140 words at most");
    } else if (invented.length) {
      refused = true;
      problems.push(`stronger: says ${invented.slice(0, 6).map((f) => `"${f}"`).join(", ")}, in neither the candidate's answers nor the CV line; write it without, or answer null`);
    } else {
      better = stronger;
    }
  }

  return {
    value: { feedback: { criteria, vague, english, ...(refused ? { strongerRefused: true } : {}), prompt: feedbackTask.prompt.version }, better },
    problems,
  };
}

/**
 * The feedback on one question's answers. Throws AiError when the model can't be reached or doesn't
 * answer in shape: the caller shows what the answer measured, and says the rest isn't there.
 */
export async function giveFeedback(model: TextModel, input: FeedbackInput): Promise<Feedback> {
  return runTask(model, feedbackTask, input, (o) => checkFeedback(o, input));
}
