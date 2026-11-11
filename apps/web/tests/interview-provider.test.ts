// Interview Trainer, step 5: which model answers, and whether there is one (lib/interview/provider.ts).
// Off unless switched on and a model is named; in production only Amazon Bedrock, which isn't built
// yet; today's providers in development only (AG-1). The AI SDK's errors, which hold the prompt and
// the reply, never leave this file. No network: the SDK's own mock model.
import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { APICallError, RetryError } from "ai";
import { MockLanguageModelV1 } from "ai/test";
import { z } from "zod";
import { AiError, ShapeError, type ModelRequest } from "@/lib/interview/model";
import { interviewAi, PROVIDER_LABEL, PROVIDER_NAME, sdkModel } from "@/lib/interview/provider";

const ON = { AI_INTERVIEW_ENABLED: "true", AI_MODEL_INTERVIEW: "anthropic:some-small-model", ANTHROPIC_API_KEY: "set", NODE_ENV: "development" };

describe("interviewAi", () => {
  it("is off unless the switch is exactly true", () => {
    expect(interviewAi({})).toEqual({ ready: false, why: "off" });
    expect(interviewAi({ ...ON, AI_INTERVIEW_ENABLED: "TRUE" })).toEqual({ ready: false, why: "off" });
    expect(interviewAi({ ...ON, AI_INTERVIEW_ENABLED: "1" })).toEqual({ ready: false, why: "off" });
  });

  it("needs a model named as provider:model; there is no default", () => {
    expect(interviewAi({ ...ON, AI_MODEL_INTERVIEW: undefined })).toEqual({ ready: false, why: "no_model" });
    expect(interviewAi({ ...ON, AI_MODEL_INTERVIEW: "some-small-model" })).toEqual({ ready: false, why: "no_model" });
    expect(interviewAi({ ...ON, AI_MODEL_INTERVIEW: "anthropic:" })).toEqual({ ready: false, why: "no_model" });
    expect(interviewAi({ ...ON, AI_MODEL_INTERVIEW: "mistral:large" })).toEqual({ ready: false, why: "unknown_provider" });
    expect(interviewAi(ON)).toEqual({ ready: true, provider: "anthropic", modelId: "some-small-model" });
    // a model's name may have colons of its own
    expect(interviewAi({ ...ON, AI_MODEL_INTERVIEW: "openai:ft:small:acme", OPENAI_API_KEY: "set" }))
      .toEqual({ ready: true, provider: "openai", modelId: "ft:small:acme" });
  });

  it("says Bedrock isn't built yet, and refuses today's providers in production", () => {
    expect(interviewAi({ ...ON, AI_MODEL_INTERVIEW: "bedrock:us.some-profile-v1:0" })).toEqual({ ready: false, why: "bedrock_not_built" });
    expect(interviewAi({ ...ON, NODE_ENV: "production" })).toEqual({ ready: false, why: "production" });
    expect(interviewAi({ ...ON, NODE_ENV: "test" })).toMatchObject({ ready: true });
  });

  it("needs the provider's key to be set, and only looks whether it is", () => {
    expect(interviewAi({ ...ON, ANTHROPIC_API_KEY: "" })).toEqual({ ready: false, why: "no_key" });
    expect(interviewAi({ ...ON, AI_MODEL_INTERVIEW: "google:some-model" })).toEqual({ ready: false, why: "no_key" });
    expect(interviewAi({ ...ON, AI_MODEL_INTERVIEW: "google:some-model", GOOGLE_GENERATIVE_AI_API_KEY: "set" })).toMatchObject({ ready: true, provider: "google" });
    expect(JSON.stringify(interviewAi({ ...ON, ANTHROPIC_API_KEY: "SENTINEL-KEY" }))).not.toContain("SENTINEL");
  });

  it("names who the answers go to", () => {
    expect(PROVIDER_LABEL.bedrock).toBe("Amazon Bedrock (in the US)");
    expect(PROVIDER_NAME.bedrock).toBe("Amazon Bedrock");
    for (const p of ["openai", "anthropic", "google"] as const) expect(PROVIDER_LABEL[p]).toMatch(/development only/);
  });
});

const request: ModelRequest = {
  task: "interview-follow-up",
  instructions: "RULES-OF-THE-TASK",
  prompt: "CASE with SENTINEL-ANSWER",
  schema: z.object({ ask: z.string().nullable() }).strict(),
  timeoutMs: 2000,
};
type Call = Parameters<MockLanguageModelV1["doGenerate"]>[0];
const reply = (text: string) => ({
  rawCall: { rawPrompt: null, rawSettings: {} },
  finishReason: "stop" as const,
  usage: { promptTokens: 120, completionTokens: 15 },
  text,
});

describe("sdkModel", () => {
  it("sends the instructions as the system text and the prompt as the user's, and returns the object with its token counts", async () => {
    const calls: Call[] = [];
    const mock = new MockLanguageModelV1({
      defaultObjectGenerationMode: "json",
      doGenerate: async (options) => {
        calls.push(options);
        return reply('{"ask":"What changed for the team?"}');
      },
    });
    const model = sdkModel("anthropic", "some-small-model", mock);
    expect(model.id).toBe("anthropic:some-small-model");
    expect(await model.generate(request)).toEqual({ object: { ask: "What changed for the team?" }, inputTokens: 120, outputTokens: 15 });
    expect(calls).toHaveLength(1);
    const [system, user] = calls[0].prompt;
    expect(system.role).toBe("system");
    expect(String(system.content)).toContain("RULES-OF-THE-TASK");
    expect(String(system.content)).not.toContain("SENTINEL-ANSWER");
    expect(user.role).toBe("user");
    expect(JSON.stringify(user.content)).toContain("CASE with SENTINEL-ANSWER");
    expect(calls[0].abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("says which field is wrong when the answer is out of shape, without the answer", async () => {
    const mock = new MockLanguageModelV1({ defaultObjectGenerationMode: "json", doGenerate: async () => reply('{"ask":42,"note":"SENTINEL-REPLY"}') });
    const thrown = await sdkModel("openai", "m", mock).generate(request).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(ShapeError);
    expect((thrown as ShapeError).issues.join("; ")).toMatch(/^ask: /);
    expect(inspect(thrown, { depth: 5 })).not.toMatch(/SENTINEL/);

    const notJson = new MockLanguageModelV1({ defaultObjectGenerationMode: "json", doGenerate: async () => reply("Sure! SENTINEL-REPLY") });
    const second = await sdkModel("openai", "m", notJson).generate(request).catch((e: unknown) => e);
    expect(second).toBeInstanceOf(ShapeError);
    expect((second as ShapeError).issues).toEqual(["answer: invalid JSON"]);
    expect(inspect(second, { depth: 5 })).not.toMatch(/SENTINEL/);
  });

  it("turns a provider's error into a code and a status, without the request or the response", async () => {
    const apiError = (statusCode: number) => new APICallError({
      message: "SENTINEL-ANSWER rejected", url: "https://provider.invalid/v1", requestBodyValues: { prompt: "SENTINEL-ANSWER" },
      statusCode, responseBody: "SENTINEL-REPLY", isRetryable: false,
    });
    let asked = 0;
    const refused = new MockLanguageModelV1({ defaultObjectGenerationMode: "json", doGenerate: async () => { asked++; throw apiError(400); } });
    const a = await sdkModel("google", "m", refused).generate(request).catch((e: unknown) => e);
    expect(a).toBeInstanceOf(AiError);
    expect(a).toMatchObject({ code: "ai.provider", status: 400, message: "interview-follow-up: provider error 400" });
    expect(inspect(a, { depth: 5 })).not.toMatch(/SENTINEL/);
    // not retryable: asked once
    expect(asked).toBe(1);

    const retried = new MockLanguageModelV1({
      defaultObjectGenerationMode: "json",
      doGenerate: async () => { throw new RetryError({ message: "SENTINEL-ANSWER", reason: "maxRetriesExceeded", errors: [apiError(503), apiError(529)] }); },
    });
    const b = await sdkModel("google", "m", retried).generate(request).catch((e: unknown) => e);
    expect(b).toMatchObject({ code: "ai.provider", status: 529 });
    expect(inspect(b, { depth: 5 })).not.toMatch(/SENTINEL/);

    const broken = new MockLanguageModelV1({ defaultObjectGenerationMode: "json", doGenerate: async () => { throw new TypeError("fetch failed: SENTINEL-ANSWER"); } });
    const c = await sdkModel("google", "m", broken).generate(request).catch((e: unknown) => e);
    expect(c).toMatchObject({ code: "ai.provider", status: undefined });
    expect(inspect(c, { depth: 5 })).not.toMatch(/SENTINEL/);
  });

  it("stops waiting at the task's time limit", async () => {
    // the mock has to respect the signal, as real providers do through fetch
    const slow = new MockLanguageModelV1({
      defaultObjectGenerationMode: "json",
      doGenerate: ({ abortSignal }) => new Promise((_, reject) => abortSignal?.addEventListener("abort", () => reject(abortSignal.reason))),
    });
    const thrown = await sdkModel("openai", "m", slow).generate({ ...request, timeoutMs: 30 }).catch((e: unknown) => e);
    expect(thrown).toMatchObject({ code: "ai.timeout", message: "interview-follow-up: timed out" });
  });
});
