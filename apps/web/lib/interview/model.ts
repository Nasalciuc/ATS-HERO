/**
 * Interview Trainer: the way to a text model (ANTRENOR-INTERVIU-CONSTRUCTIE.md, step 5).
 *
 * The trainer asks a model for two things: a follow-up question, and the feedback on an answer
 * (follow-up.ts, feedback.ts). Each is a task: instructions with a version, a prompt built from data
 * only (lib/ai/data.ts), and the shape of the answer. runTask() is the one way they reach a model:
 * - the answer is checked against the task's schema, then by the task's own check (a quote that is
 *   in the answer word for word, a fact that is in the CV line…);
 * - what fails is asked for once more, with the problems named. After that, what still fails is left
 *   out, or the task fails. A run is at most two calls;
 * - an error carries a code and a fixed message, and a log line carries counts: never the prompt,
 *   the answer or the model's words (rule 11: our logs don't hold what a CV or an answer says).
 *
 * The model is an object with one function (TextModel), so the tests give a fake one and the provider
 * lives in one file (provider.ts). This is SPEC-01-AI-TASKS.md's callTask in small (claude.ai
 * Project "App Builder"): when that foundation is built, runTask becomes a call to it and the two
 * tasks move to its registry.
 */
import type { z } from "zod";

export type AiCode = "ai.config" | "ai.schema" | "ai.provider" | "ai.timeout" | "ai.disabled" | "ai.quota";

const REASON: Record<AiCode, string> = {
  "ai.config": "not configured",
  "ai.schema": "response did not match schema",
  "ai.provider": "provider error",
  "ai.timeout": "timed out",
  "ai.disabled": "switched off",
  "ai.quota": "daily limit reached",
};

/** A run that failed: the task, a fixed reason, and the provider's HTTP status when there is one. Nothing else. */
export class AiError extends Error {
  constructor(public readonly code: AiCode, task: string, public readonly status?: number) {
    super(`${task}: ${REASON[code]}${status ? ` ${status}` : ""}`);
    this.name = "AiError";
  }
}

/** The provider itself saw that the answer isn't in shape. `issues` name fields ("ask: Required"), never the answer. */
export class ShapeError extends Error {
  constructor(public readonly issues: string[]) {
    super("answer not in shape");
    this.name = "ShapeError";
  }
}

export type ModelRequest = {
  task: string;
  /** the role and the rules: ours, the same for every call of a prompt version */
  instructions: string;
  /** the case: text from people only inside asData() blocks */
  prompt: string;
  /** the shape of the answer, for a provider that can hold a model to one */
  schema: z.ZodTypeAny;
  timeoutMs: number;
};
export type ModelReply = { object: unknown; inputTokens?: number; outputTokens?: number };
/** A model that answers one request with one JSON object. Throws AiError, or ShapeError. */
export type TextModel = {
  /** "provider:model", for the log */
  id: string;
  generate(req: ModelRequest): Promise<ModelReply>;
};

export type Task<I, O> = {
  name: "interview-follow-up" | "interview-feedback";
  prompt: {
    /** "interview-feedback.v1": kept with what the prompt made, so a later version can be told apart */
    version: string;
    instructions: string;
    build(input: I): string;
  };
  /** structure only: lengths and counts are the check's, which trims instead of asking again */
  schema: z.ZodType<O>;
  timeoutMs: number;
};

/** What a task's check makes of an answer: the part that holds, and what to ask the model to fix. */
export type Checked<R> = { value: R; problems: string[] };

/** A run is the first call and, when the answer has problems, one more. */
export const MAX_CALLS = 2;
const PROBLEMS_MAX_CHARS = 500;

const issuesOf = (error: z.ZodError) => error.issues.map((i) => `${i.path.join(".") || "answer"}: ${i.message}`);

function again(problems: string[]): string {
  let list = "";
  for (const p of problems) {
    const next = list ? `${list}; ${p}` : p;
    if (next.length > PROBLEMS_MAX_CHARS) break;
    list = next;
  }
  return `Your previous answer was not accepted. Problems: ${list || "not in the required shape"}. Answer again with valid JSON only, with these fixed.`;
}

/**
 * One task, run: the model's answer in the task's shape, passed through `check`. Throws AiError when
 * the model can't be reached, takes too long, or answers out of shape twice.
 */
export async function runTask<I, O, R>(model: TextModel, task: Task<I, O>, input: I, check: (output: O) => Checked<R>): Promise<R> {
  const base = task.prompt.build(input);
  let problems: string[] = [];
  for (let call = 1; ; call++) {
    const last = call === MAX_CALLS;
    const t0 = Date.now();
    /** one line a call: what ran and how it ended, in counts ("ok", "partial": some of it left out; the rest end or repeat the run) */
    const log = (outcome: string, more: Record<string, unknown> = {}) => {
      const done = outcome === "ok" || outcome === "partial";
      const failed = outcome.startsWith("ai.") || (outcome === "schema_rejected" && last);
      (failed ? console.error : console.log)(JSON.stringify({
        level: failed ? "error" : done ? "info" : "warn",
        action: "ai.call", task: task.name, prompt: task.prompt.version, model: model.id, call, outcome, ms: Date.now() - t0, ...more,
      }));
    };
    let reply: ModelReply;
    try {
      reply = await model.generate({
        task: task.name,
        instructions: task.prompt.instructions,
        prompt: call === 1 ? base : `${base}\n\n${again(problems)}`,
        schema: task.schema,
        timeoutMs: task.timeoutMs,
      });
    } catch (e) {
      if (e instanceof ShapeError) {
        log("schema_rejected");
        if (last) throw new AiError("ai.schema", task.name);
        problems = e.issues;
        continue;
      }
      // whatever a provider threw may hold the prompt or the reply: only our own error goes on
      const err = e instanceof AiError ? e : new AiError("ai.provider", task.name);
      log(err.code, err.status ? { status: err.status } : {});
      throw err;
    }
    const tokens = { inputTokens: reply.inputTokens ?? null, outputTokens: reply.outputTokens ?? null };
    const parsed = task.schema.safeParse(reply.object);
    if (!parsed.success) {
      log("schema_rejected", tokens);
      if (last) throw new AiError("ai.schema", task.name);
      problems = issuesOf(parsed.error);
      continue;
    }
    const checked = check(parsed.data);
    if (!checked.problems.length || last) {
      log(checked.problems.length ? "partial" : "ok", tokens);
      return checked.value;
    }
    log("check_rejected", tokens);
    problems = checked.problems;
  }
}
