import { NextResponse } from "next/server";
import { purgeOldSessions } from "@/lib/interview/store";

export const runtime = "nodejs";

/** Interview practice sessions go INTERVIEW_RETENTION_DAYS after they started, with their turns (AG-10). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({}, { status: 401 });
  const { sessions, turns } = await purgeOldSessions();
  return NextResponse.json({ purgedSessions: sessions, purgedTurns: turns });
}
