"use server";
import { db } from "@/db";
import { cvs, scans } from "@/db/schema";
import { and, eq, desc, isNull } from "drizzle-orm";
import { getOwnerId, canRead } from "./_shared";
import { saveScanOn } from "@/lib/scans-write";
import type { ScanKind, ScoreReport, JobFitReport } from "@/lib/types";
import { withLog } from "@/lib/log";

export async function listMyScans(guestId?: string) {
  const ownerId = await getOwnerId();
  const where = ownerId ? eq(scans.ownerId, ownerId)
              : guestId ? and(eq(scans.guestId, guestId), isNull(scans.ownerId)) : null;
  if (!where) return [];
  const rows = await db.query.scans.findMany({ where, orderBy: [desc(scans.createdAt)] });
  return rows.map((s) => ({ ...s, createdAt: s.createdAt.getTime() }));
}

export async function getScanById(id: string, guestId?: string) {
  const row = await db.query.scans.findFirst({ where: eq(scans.id, id) });
  if (!row || !(await canRead(row, guestId))) return null;
  return { ...row, createdAt: row.createdAt.getTime() };
}

export async function saveScan(input: {
  cvId?: string; kind: ScanKind; engine?: "client" | "python" | "ai";
  generalScore: number; result: ScoreReport | JobFitReport; guestId?: string;
}) {
  const ownerId = await getOwnerId();
  if (!ownerId && !input.guestId) throw new Error("guestId required for guests");

  if (input.cvId) {                                    // authorize before insert
    const cv = await db.query.cvs.findFirst({ where: eq(cvs.id, input.cvId) });
    if (!cv || !(await canRead(cv, input.guestId))) throw new Error("Forbidden: cvId not accessible");
  }

  return withLog("scans.save", { ownerId, kind: input.kind }, async () => {
    return saveScanOn(db, ownerId, input);
  });
}
