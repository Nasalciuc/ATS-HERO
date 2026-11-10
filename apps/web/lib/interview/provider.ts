/**
 * Interview Trainer: which model answers, and whether there is one (ANTRENOR-INTERVIU-CONSTRUCTIE.md,
 * step 5). The only file of the trainer that imports the AI SDK.
 *
 * - AI_INTERVIEW_ENABLED is the kill-switch: off unless exactly "true", like AI_REWRITE_ENABLED. Off,
 *   the trainer works as it does without a model: the pack's questions and what an answer measured.
 * - AI_MODEL_INTERVIEW names the model as "provider:model" (AG-2: the model is configuration, not
 *   code). There is no default: no model named, no AI.
 * - In production the provider is Amazon Bedrock, through Vercel's OIDC role and no keys (AG-1). That
 *   path waits for the AWS account (F0, F4b) and isn't built: "bedrock:…" answers "not built yet".
 *   Until then openai, anthropic and google work in development only, with synthetic personas
 *   (AG-1): a production build refuses them, so no real person's answers reach a provider the
 *   Privacy page doesn't name.
 */
import { APICallError, generateObject, LoadAPIKeyError, NoObjectGeneratedError, RetryError, TypeValidationError, type LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { AiError, ShapeError, type TextModel } from "./model";

export type AiProvider = "bedrock" | "openai" | "anthropic" | "google";
type DevProvider = Exclude<AiProvider, "bedrock">;

/** Who the answers go to, as the consent says it. */
export const PROVIDER_LABEL: Record<AiProvider, string> = {
  bedrock: "Amazon Bedrock (in the US)",
  openai: "OpenAI (development only)",
  anthropic: "Anthropic (development only)",
  google: "Google (development only)",
};
/** The same, short: "…my answers go to Amazon Bedrock". */
export const PROVIDER_NAME: Record<AiProvider, string> = {
  bedrock: "Amazon Bedrock",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

/** Where each development provider's SDK reads its key. We only ever look whether one is set. */
const KEY_ENV: Record<DevProvider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

export type AiSetup =
  | { ready: true; provider: DevProvider; modelId: string }
  | { ready: false; why: "off" | "no_model" | "unknown_provider" | "bedrock_not_built" | "production" | "no_key" };

type Env = Record<string, string | undefined>;

/** Is there a model for the trainer right now, and which. Read at each call: a test or a redeploy can change it. */
export function interviewAi(env: Env = process.env): AiSetup {
  if (env.AI_INTERVIEW_ENABLED !== "true") return { ready: false, why: "off" };
  const [provider, ...rest] = (env.AI_MODEL_INTERVIEW ?? "").trim().split(":");
  const modelId = rest.join(":").trim();
  if (!provider || !modelId) return { ready: false, why: "no_model" };
  if (provider === "bedrock") return { ready: false, why: "bedrock_not_built" };
  if (provider !== "openai" && provider !== "anthropic" && provider !== "google") return { ready: false, why: "unknown_provider" };
  if (env.NODE_ENV === "production") return { ready: false, why: "production" };
  if (!env[KEY_ENV[provider]]) return { ready: false, why: "no_key" };
  return { ready: true, provider, modelId };
}

function languageModel(provider: DevProvider, modelId: string): LanguageModel {
  if (provider === "anthropic") return anthropic(modelId);
  if (provider === "google") return google(modelId);
  return openai(modelId);
}

/** A provider's error as ours: a code and, at most, an HTTP status. Their errors hold the prompt and the reply. */
function translate(e: unknown, task: string): AiError | ShapeError {
  if (e instanceof AiError || e instanceof ShapeError) return e;
  if (NoObjectGeneratedError.isInstance(e)) {
    const zod = TypeValidationError.isInstance(e.cause) ? (e.cause.cause as { issues?: unknown } | undefined) : undefined;
    const issues = Array.isArray(zod?.issues)
      ? (zod.issues as { path?: unknown[]; message?: unknown }[]).map((i) => `${(i.path ?? []).join(".") || "answer"}: ${String(i.message ?? "invalid")}`)
      : ["answer: invalid JSON"];
    return new ShapeError(issues);
  }
  const name = (e as { name?: unknown } | null)?.name;
  if (name === "TimeoutError" || name === "AbortError") return new AiError("ai.timeout", task);
  if (RetryError.isInstance(e)) return translate(e.lastError, task);
  if (APICallError.isInstance(e)) return new AiError("ai.provider", task, e.statusCode);
  if (LoadAPIKeyError.isInstance(e)) return new AiError("ai.config", task);
  return new AiError("ai.provider", task);
}

/** The AI SDK as a TextModel. `model` is for tests (the SDK's mock); otherwise the provider's own. */
export function sdkModel(provider: DevProvider, modelId: string, model?: LanguageModel): TextModel {
  return {
    id: `${provider}:${modelId}`,
    async generate(req) {
      try {
        const r = await generateObject({
          model: model ?? languageModel(provider, modelId),
          schema: req.schema,
          schemaName: req.task.replace(/-/g, "_"),
          system: req.instructions,
          prompt: req.prompt,
          // one more try on a provider's 5xx or 429; a second answer for a wrong shape is runTask's
          maxRetries: 1,
          abortSignal: AbortSignal.timeout(req.timeoutMs),
        });
        return { object: r.object, inputTokens: r.usage.promptTokens, outputTokens: r.usage.completionTokens };
      } catch (e) {
        throw translate(e, req.task);
      }
    },
  };
}

/** The trainer's model, or null when there is none (the switch is off, no model named, not allowed here). */
export function interviewModel(): TextModel | null {
  const ai = interviewAi();
  return ai.ready ? sdkModel(ai.provider, ai.modelId) : null;
}
