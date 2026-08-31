import { NextResponse } from "next/server";
import { db } from "@/db";
import { cvs, scans } from "@/db/schema";
import { and, isNotNull, lt, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({}, { status: 401 });
  const cutoff = sql`now() - interval '90 days'`;
  const s = await db.delete(scans).where(and(isNotNull(scans.guestId), lt(scans.createdAt, cutoff))).returning({ id: scans.id });
  const c = await db.delete(cvs).where(and(isNotNull(cvs.guestId), lt(cvs.updatedAt, cutoff))).returning({ id: cvs.id });
  return NextResponse.json({ purgedScans: s.length, purgedCvs: c.length });
}
