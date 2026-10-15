import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Auth-protected stub. Real reconciliation (Paddle subscriptions vs. our rows) lands with
 * billing; the route exists now so the Vercel cron entry has a target that returns 200.
 */
export async function GET(req: Request) {
  // Fail closed, as purge-guests: without the secret, `Bearer ${undefined}` would let
  // "Authorization: Bearer undefined" through.
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({}, { status: 401 });
  return NextResponse.json({ ok: true, audited: 0 });
}
