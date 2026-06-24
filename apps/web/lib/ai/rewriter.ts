// Tier 3 — AI WEAK->STRONG bullet rewriting via the Vercel AI SDK (multi-provider).
// Consumes the deterministic findings from /score (Tier 2) and turns flagged weak bullets
// into strong, quantified ones. Detection is free (Tier 1/2); this rewriting is the paid tier.
//
// Requires: ai, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, zod.
// Provider/model via env: AI_PROVIDER = openai | anthropic | google ; AI_MODEL optional.

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { z } from "zod";

function model() {
  const provider = process.env.AI_PROVIDER ?? "openai";
  const name = process.env.AI_MODEL;
  switch (provider) {
    case "anthropic":
      return anthropic(name ?? "claude-sonnet-4-6");
    case "google":
      return google(name ?? "gemini-1.5-pro");
    default:
      return openai(name ?? "gpt-4o-mini");
  }
}

export const RewriteSchema = z.object({
  rewrites: z.array(
    z.object({
      original: z.string(),
      improved: z.string(),
      rationale: z.string(),
    }),
  ),
});

export type Rewrite = z.infer<typeof RewriteSchema>["rewrites"][number];

const SYSTEM = [
  "You are an expert technical resume editor.",
  "Rewrite each weak CV bullet into a strong one using the pattern: strong action verb + scope + method + measurable result.",
  "Rules:",
  "- Lead with a strong action verb (Built, Shipped, Led, Reduced, Automated, Scaled).",
  "- Replace passive/duty phrasing ('Responsible for', 'Helped with') with ownership.",
  "- Quantify impact. If the user did NOT provide a number, insert a clearly marked placeholder like [X%] or [N] for them to fill — NEVER invent specific figures.",
  "- Keep each bullet to one concise line. Stay truthful to the original meaning.",
  "- 'rationale' briefly explains what you changed and why.",
].join("\n");

export async function rewriteBullets(input: {
  bullets: string[];
  role?: string;
}): Promise<Rewrite[]> {
  if (!input.bullets.length) return [];
  const roleLine = input.role ? `Target role: ${input.role}.\n` : "";
  const list = input.bullets.map((b, i) => `${i + 1}. ${b}`).join("\n");

  const { object } = await generateObject({
    model: model(),
    schema: RewriteSchema,
    system: SYSTEM,
    prompt: `${roleLine}Rewrite these CV bullets:\n${list}`,
  });
  return object.rewrites;
}
