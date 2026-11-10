// Interview Trainer, step 5: the way to a model (lib/interview/model.ts), with a fake one. The answer
// must be in the task's shape and pass the task's check; what fails is asked for once more, then
// left out or failed; errors and log lines never hold the prompt or the model's words.
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AiError, MAX_CALLS, runTask, ShapeError, type ModelReply, type ModelRequest, type Task, type TextModel } from "@/lib/interview/model";

const task: Task<{ answer: string }, { ask: string | null }> = {
  name: "interview-follow-up",
  prompt: { version: "interview-follow-up.test", instructions: "RULES", build: (i) => `CASE ${i.answer}` },
  schema: z.object({ ask: z.string().nullable() }).strict(),
  timeoutMs: 1000,
};
const pass = (o: { ask: string | null }) => ({ value: o.ask, problems: [] });

/** A model that gives these replies in turn (an Error is thrown). */
function fake(...replies: (unknown | Error)[]) {
  const requests: ModelRequest[] = [];
  const model: TextModel = {
    id: "fake:model",
    async generate(req): Promise<ModelReply> {
      requests.push(req);
      const next = replies[Math.min(requests.length, replies.length) - 1];
      if (next instanceof Error) throw next;
      return { object: next, inputTokens: 100, outputTokens: 20 };
    },
  };
  return { model, requests };
}

let logged: string[];
beforeEach(() => {
  logged = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => void logged.push(line));
  vi.spyOn(console, "error").mockImplementation((line: string) => void logged.push(line));
});
afterEach(() => vi.restoreAllMocks());
const lines = () => logged.map((l) => JSON.parse(l) as Record<string, unknown>);

describe("runTask", () => {
  it("gives the model the instructions and the prompt, and returns what the check makes of the answer", async () => {
    const { model, requests } = fake({ ask: "What changed for the team?" });
    expect(await runTask(model, task, { answer: "I wrote some Python." }, pass)).toBe("What changed for the team?");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ task: "interview-follow-up", instructions: "RULES", prompt: "CASE I wrote some Python.", timeoutMs: 1000 });
    expect(lines()).toEqual([expect.objectContaining({
      level: "info", action: "ai.call", task: "interview-follow-up", prompt: "interview-follow-up.test", model: "fake:model",
      call: 1, outcome: "ok", inputTokens: 100, outputTokens: 20,
    })]);
  });

  it("asks once more when the answer is out of shape, naming the field and not the answer", async () => {
    const { model, requests } = fake({ question: "SENTINEL-REPLY" }, { ask: null });
    expect(await runTask(model, task, { answer: "x" }, pass)).toBeNull();
    expect(requests).toHaveLength(2);
    expect(requests[1].prompt).toContain("CASE x");
    expect(requests[1].prompt).toContain("Your previous answer was not accepted. Problems: ask: Required");
    expect(requests[1].prompt).not.toContain("SENTINEL-REPLY");
    expect(lines().map((l) => [l.call, l.outcome, l.level])).toEqual([[1, "schema_rejected", "warn"], [2, "ok", "info"]]);
  });

  it("fails after two answers out of shape, without a third call", async () => {
    const { model, requests } = fake({ ask: 7 }, { ask: 8 }, { ask: null });
    await expect(runTask(model, task, { answer: "x" }, pass)).rejects.toMatchObject({ code: "ai.schema", message: "interview-follow-up: response did not match schema" });
    expect(requests).toHaveLength(MAX_CALLS);
    expect(lines().at(-1)).toMatchObject({ call: 2, outcome: "schema_rejected", level: "error" });
  });

  it("takes a provider's own shape error the same way", async () => {
    const { model, requests } = fake(new ShapeError(["ask: Expected string, received number"]), { ask: "And then?" });
    expect(await runTask(model, task, { answer: "x" }, pass)).toBe("And then?");
    expect(requests[1].prompt).toContain("Problems: ask: Expected string, received number");
    const twice = fake(new ShapeError(["answer: invalid JSON"]));
    await expect(runTask(twice.model, task, { answer: "x" }, pass)).rejects.toMatchObject({ code: "ai.schema" });
    expect(twice.requests).toHaveLength(2);
  });

  it("asks once more when the task's check finds problems, then keeps what holds", async () => {
    const check = (o: { ask: string | null }) =>
      o.ask?.endsWith("?") ? { value: o.ask as string | null, problems: [] } : { value: null, problems: ["ask: must be one question, ending with a question mark"] };
    const fixed = fake({ ask: "Tell me more." }, { ask: "What did you change?" });
    expect(await runTask(fixed.model, task, { answer: "x" }, check)).toBe("What did you change?");
    expect(fixed.requests[1].prompt).toContain("Problems: ask: must be one question, ending with a question mark");
    expect(lines().map((l) => l.outcome)).toEqual(["check_rejected", "ok"]);

    logged = [];
    const still = fake({ ask: "Tell me more." }, { ask: "Go on." }, { ask: "Never asked?" });
    expect(await runTask(still.model, task, { answer: "x" }, check)).toBeNull();
    expect(still.requests).toHaveLength(2);
    expect(lines().map((l) => [l.outcome, l.level])).toEqual([["check_rejected", "warn"], ["partial", "info"]]);
  });

  it("keeps the list of problems short", async () => {
    const many = Array.from({ length: 40 }, (_, i) => `english.${i}.quote: not in the answer word for word`);
    const { model, requests } = fake({ ask: "a" }, { ask: "b" });
    let n = 0;
    await runTask(model, task, { answer: "x" }, (o) => ({ value: o.ask, problems: n++ ? [] : many }));
    const said = requests[1].prompt.split("Problems: ")[1];
    expect(said.length).toBeLessThan(700);
    expect(said).toContain("english.0.quote");
    expect(said).not.toContain("english.39.quote");
  });

  it("passes on our own errors, and turns anything else into a provider error", async () => {
    await expect(runTask(fake(new AiError("ai.timeout", "interview-follow-up")).model, task, { answer: "x" }, pass))
      .rejects.toMatchObject({ code: "ai.timeout", message: "interview-follow-up: timed out" });
    await expect(runTask(fake(new AiError("ai.provider", "interview-follow-up", 503)).model, task, { answer: "x" }, pass))
      .rejects.toMatchObject({ code: "ai.provider", status: 503, message: "interview-follow-up: provider error 503" });
    const { model, requests } = fake(new TypeError("fetch failed"));
    await expect(runTask(model, task, { answer: "x" }, pass)).rejects.toMatchObject({ name: "AiError", code: "ai.provider" });
    expect(requests).toHaveLength(1);
    expect(lines().map((l) => [l.outcome, l.level, l.status])).toEqual([
      ["ai.timeout", "error", undefined], ["ai.provider", "error", 503], ["ai.provider", "error", undefined],
    ]);
  });

  it("lets nothing of the prompt or of the model's words into an error or a log line", async () => {
    const leaky = Object.assign(new Error("request failed: SENTINEL-ANSWER"), { requestBodyValues: { prompt: "SENTINEL-ANSWER" }, responseBody: "SENTINEL-REPLY" });
    const thrown = await runTask(fake(leaky).model, task, { answer: "SENTINEL-ANSWER" }, pass).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(AiError);
    expect(inspect(thrown, { depth: 5 })).not.toMatch(/SENTINEL/);

    const wrong = await runTask(fake({ ask: 1, note: "SENTINEL-REPLY" }).model, task, { answer: "SENTINEL-ANSWER" }, pass).catch((e: unknown) => e);
    expect(inspect(wrong, { depth: 5 })).not.toMatch(/SENTINEL/);

    await runTask(fake({ ask: "SENTINEL-REPLY?" }).model, task, { answer: "SENTINEL-ANSWER" }, pass);
    expect(logged.length).toBeGreaterThan(3);
    expect(logged.join("\n")).not.toMatch(/SENTINEL|RULES|CASE/);
  });
});
