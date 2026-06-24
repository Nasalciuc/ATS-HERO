// Tier 3 endpoint — POST /api/rewrite
// Takes weak bullets (typically the lines behind /score findings) and returns
// AI-generated WEAK->STRONG rewrites. This is the paid tier; gate it with your
// Clerk subscription check before calling rewriteBullets.

import { NextResponse } from "next/server";
import { rewriteBullets } from "@/lib/ai/rewriter";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // TODO: gate on an active Tier 3 subscription (Clerk + Convex) before proceeding.
  let payload: { bullets?: unknown; role?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bullets = Array.isArray(payload.bullets)
    ? payload.bullets.filter((b): b is string => typeof b === "string" && b.trim().length > 0)
    : [];
  const role = typeof payload.role === "string" ? payload.role : undefined;

  if (bullets.length === 0) {
    return NextResponse.json({ error: "Provide a non-empty 'bullets' array" }, { status: 400 });
  }
  if (bullets.length > 25) {
    return NextResponse.json({ error: "Too many bullets (max 25 per request)" }, { status: 413 });
  }

  try {
    const rewrites = await rewriteBullets({ bullets, role });
    return NextResponse.json({ rewrites });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rewrite failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
