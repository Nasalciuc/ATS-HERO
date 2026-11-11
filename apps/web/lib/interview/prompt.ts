/**
 * Interview Trainer: the pieces the two prompts share (follow-up.ts, feedback.ts). Everything that
 * comes from a person or from a job post goes in as data (lib/ai/data.ts): the job and what the
 * question asks about, the line of the CV, and the interview so far.
 *
 * What a prompt holds of a person (APPLY-COPILOT-DESIGN.md §5.4): the answers they gave, the
 * question, the one CV line it is about with its job's title and employer, and the job practised
 * for. Never the name, the contact details or the rest of the CV.
 */
import { asData } from "@/lib/ai/data";

/** One question and its answer, as the session has them. A null answer: the question was skipped. */
export type ExchangePart = { question: string; answer: string | null };

/** How much of one question's interview a prompt takes: a question, up to three follow-ups, and their answers. */
export const TRANSCRIPT_MAX_CHARS = 28_000;
const SKIPPED = "(skipped the question)";

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const short = (s: string, max: number) => oneLine(s).slice(0, max);

/** The job practised for, and what the question asks about (Job Fit's words for the post's requirement). */
export function jobBlock(job: { role: string; company: string; requirement: string | null }): string {
  const lines = [
    job.role.trim() && `Role: ${short(job.role, 120)}`,
    job.company.trim() && `Company: ${short(job.company, 120)}`,
    job.requirement?.trim() && `The question asks about: ${short(job.requirement, 200)}`,
  ].filter(Boolean);
  return asData("job_posting", lines.join("\n") || "(not given)", 600).block;
}

/** The CV line the question is tied to, with the job it comes from when the CV still has it. */
export function cvBlock(cv: { line: string; role?: string; org?: string }): string {
  const job = [cv.role?.trim() && short(cv.role, 120), cv.org?.trim() && short(cv.org, 120)].filter(Boolean).join(" at ");
  return asData("cv_data", [job && `Job: ${job}`, `Line: ${oneLine(cv.line)}`].filter(Boolean).join("\n"), 1200).block;
}

/**
 * One question's interview so far, oldest first, a line each. An answer's own line breaks are
 * folded, so every line starts with a name we wrote.
 */
export function transcriptBlock(exchange: ExchangePart[]): string {
  const lines = exchange.flatMap((p) => [`INTERVIEWER: ${oneLine(p.question)}`, `CANDIDATE: ${p.answer == null ? SKIPPED : oneLine(p.answer)}`]);
  return asData("user_text", lines.join("\n"), TRANSCRIPT_MAX_CHARS).block;
}
