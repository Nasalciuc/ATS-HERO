/**
 * Interview Trainer: the interviewer's follow-up question (ANTRENOR-INTERVIU-VOCE.md B1; IV-11).
 *
 * After an answer, the model may ask one more question that starts from what the person said: what
 * exactly they did, how, or what came of it. The style sets how many a question gets (Friendly 1,
 * Neutral up to 2, Tough up to 3) and how hard they push. Tough insists; it never insults.
 *
 * The model proposes; the code decides (checkFollowUp): one short question, in plain words, not
 * asked before, never about private life (age, health, family, religion, origin…), even when the
 * answer went there, and never rude. A question that fails is asked for once more, then dropped: no
 * follow-up is always a safe answer. A skipped question isn't followed up.
 */
import { z } from "zod";
import { DATA_RULE } from "@/lib/ai/data";
import type { InterviewKind, InterviewStyle } from "@/lib/types";
import { asksAboutPrivateLife, isRude } from "./guard";
import { runTask, type Checked, type Task, type TextModel } from "./model";
import { cvBlock, jobBlock, transcriptBlock, type ExchangePart } from "./prompt";
import { KIND_LABEL } from "./report";

/** The most follow-ups one question gets, by the interviewer's style (B1). */
export const FOLLOW_UPS: Record<InterviewStyle, number> = { friendly: 1, neutral: 2, tough: 3 };

/** A follow-up is one short question: about 30 words. */
export const FOLLOW_UP_MAX_WORDS = 40;
export const FOLLOW_UP_MAX_CHARS = 280;

export type FollowUpInput = {
  kind: InterviewKind;
  style: InterviewStyle;
  /** the job practised for, from the Tracker */
  role: string;
  company: string;
  /** what the question asks about, in Job Fit's words; null when it asks about the CV line alone */
  requirement: string | null;
  cvLine: string;
  /** the question and its answer, then each follow-up with its answer */
  exchange: ExchangePart[];
};

const INSTRUCTIONS = `You are the interviewer in a practice job interview. The candidate knows you are an AI. They have just answered a question; you read the interview on that question so far.

Decide whether to ask ONE follow-up question, as a good interviewer would, or to move on to the next question.

A follow-up:
- starts from what the candidate said in their last answer and asks for what is still missing: what exactly they did, how, with whom, or what came of it;
- is one short question in plain English, 30 words at most, with no praise, comment or preamble;
- stays on the work: the candidate's answers and the line of their CV. It never brings in something they did not mention;
- is not a question already asked.

Move on (answer null) when the answers already say what the candidate did and what came of it, when the last answer says there is nothing to add, or when the follow-ups allowed for this question are used up.

Never ask about the candidate's private life, and never follow it up when they mention it: age, health, illness, disability, pregnancy, family, marriage, children, religion, nationality, ethnic origin, race, sexual orientation, gender identity, politics, union membership, criminal record, or the reason for a leave or a gap. If the answer mentions such a thing, ask about the work instead, or move on.

Never mock, insult or judge the candidate, their English or their accent. Never say whether an answer was good or bad.

The prompt names the interviewer's style:
- friendly: warm and encouraging. One gentle follow-up that helps the candidate say more.
- neutral: polite and brief, like most real interviews. Follow up when something that matters is missing.
- tough: demanding and direct, never rude. Ask for numbers. When an answer stays vague, ask again for the concrete thing.

${DATA_RULE}

Answer with JSON only: {"ask": "<your follow-up question>"} or {"ask": null}.`;

const FollowUpSchema = z.object({
  ask: z.string().nullable().describe("One short follow-up question, or null to move on to the next question"),
}).strict();

export const followUpTask: Task<FollowUpInput, z.infer<typeof FollowUpSchema>> = {
  name: "interview-follow-up",
  prompt: {
    version: "interview-follow-up.v1",
    instructions: INSTRUCTIONS,
    build(input) {
      const asked = input.exchange.length - 1;
      return [
        `Interview: ${KIND_LABEL[input.kind]}.`,
        `Style: ${input.style}.`,
        `Follow-ups asked for this question so far: ${asked} of at most ${FOLLOW_UPS[input.style]}.`,
        "",
        "The job:",
        jobBlock(input),
        "The line of the candidate's CV the question is about:",
        cvBlock({ line: input.cvLine }),
        "The interview on this question so far, oldest first:",
        transcriptBlock(input.exchange),
      ].join("\n");
    },
  },
  schema: FollowUpSchema,
  // the person is waiting between two questions
  timeoutMs: 15_000,
};

const sameQuestion = (a: string, b: string) => {
  const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return key(a) === key(b);
};

/** The model's follow-up as the interviewer may say it, or null with what is wrong with it. */
export function checkFollowUp(ask: string | null, input: Pick<FollowUpInput, "exchange">): Checked<string | null> {
  const text = (ask ?? "").replace(/\s+/g, " ").trim().replace(/^["“”‘’«»]+|["“”‘’«»]+$/gu, "").trim();
  if (!text) return { value: null, problems: [] };
  const problems: string[] = [];
  if (text.length > FOLLOW_UP_MAX_CHARS || text.split(" ").length > FOLLOW_UP_MAX_WORDS) problems.push("ask: too long; one short question, 30 words at most");
  if (!/\?$/.test(text) || (text.match(/\?/g) ?? []).length > 2) problems.push("ask: must be one question, ending with a question mark");
  if (/https?:|www\.|[<>{}[\]@\\]/i.test(text)) problems.push("ask: plain words only");
  if (asksAboutPrivateLife(text)) problems.push("ask: asks about private life (health, family, age, religion, origin, a leave); ask about the work, or answer null");
  if (isRude(text)) problems.push("ask: not respectful; ask for the same thing politely, or answer null");
  if (input.exchange.some((p) => sameQuestion(p.question, text))) problems.push("ask: already asked; ask for something else, or answer null");
  return { value: problems.length ? null : text, problems };
}

/**
 * The interviewer's next question on this answer, or null to move on. No model is asked when the
 * question was skipped or the style's follow-ups are used up. Throws AiError when the model can't
 * be reached: the caller moves on without a follow-up.
 */
export async function askFollowUp(model: TextModel, input: FollowUpInput): Promise<string | null> {
  const last = input.exchange.at(-1);
  if (!last || last.answer == null) return null;
  if (input.exchange.length - 1 >= FOLLOW_UPS[input.style]) return null;
  return runTask(model, followUpTask, input, (o) => checkFollowUp(o.ask, input));
}
