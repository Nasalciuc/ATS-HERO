import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Auth-protected stub. Real reconciliation (Paddle subscriptions vs. our rows) lands with
 * billing; the route exists now so the Vercel cron entry has a target that returns 200.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({}, { status: 401 });
  return NextResponse.json({ ok: true, audited: 0 });
}
