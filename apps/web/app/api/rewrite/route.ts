// Tier 3 endpoint — POST /api/rewrite
// Takes weak bullets (typically the lines behind /score findings) and returns
// AI-generated WEAK->STRONG rewrites. Gate order: kill-switch, account, quota, input.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { consumeAiQuota } from "@/app/actions/ai-usage";
import { rewriteBullets } from "@/lib/ai/rewriter";
import { positiveIntEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (process.env.AI_REWRITE_ENABLED !== "true")
    return NextResponse.json({ error: "Rewrite is temporarily unavailable" }, { status: 503 });

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const dailyLimit = positiveIntEnv("AI_REWRITE_DAILY_LIMIT", 5);
  const remaining = await consumeAiQuota(userId, dailyLimit);
  if (remaining < 0)
    return NextResponse.json({ error: "Daily limit reached. Try again tomorrow." }, { status: 429 });

  let payload: { bullets?: unknown; role?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bullets = Array.isArray(payload.bullets)
    ? payload.bullets.filter((b): b is string => typeof b === "string" && b.trim().length > 0)
    : [];
  if (bullets.length === 0 || bullets.length > 25)
    return NextResponse.json({ error: "1–25 bullets required" }, { status: 400 });

  const role = typeof payload.role === "string" ? payload.role : undefined;

  try {
    // rewriter wraps content in <cv_data> delimiters (prompt-injection boundary)
    const result = await rewriteBullets({ bullets, role });
    return NextResponse.json({ result, remaining });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rewrite failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
