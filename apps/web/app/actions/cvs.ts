"use server";
import { db } from "@/db";
import { cvs, scans, type Cv } from "@/db/schema";
import { and, eq, desc, isNull } from "drizzle-orm";
import { getOwnerId, canRead, assertCanWrite } from "./_shared";
import type { CvData, TemplateId } from "@/lib/types";
import { cvDataSchema } from "@/lib/validators";
import { withLog } from "@/lib/log";

const serialize = (r: Cv) => ({ ...r,
  createdAt: r.createdAt.getTime(), updatedAt: r.updatedAt.getTime() });

export async function listMyCvs(guestId?: string) {
  const ownerId = await getOwnerId();
  const where = ownerId ? eq(cvs.ownerId, ownerId)
              : guestId ? and(eq(cvs.guestId, guestId), isNull(cvs.ownerId))
              : null;
  if (!where) return [];
  return withLog("cvs.listMine", { ownerId, guestId }, async () => {
    const rows = await db.query.cvs.findMany({
      where, orderBy: [desc(cvs.updatedAt)],
      with: { scans: { limit: 1, orderBy: (s, { desc: d }) => [d(s.createdAt)] } }, // latest score, no N+1
    });
    return rows.map((r) => ({ ...serialize(r),
      scans: r.scans.map((s) => ({ ...s, createdAt: s.createdAt.getTime() })) }));
  });
}

export async function getCvById(id: string, guestId?: string) {
  const row = await db.query.cvs.findFirst({ where: eq(cvs.id, id) });
  if (!row || !(await canRead(row, guestId))) return null;
  return serialize(row);
}

export async function createCv(input: { title: string; data: CvData; guestId?: string }) {
  const ownerId = await getOwnerId();
  if (!ownerId && !input.guestId) throw new Error("guestId required for guests");
  const data = cvDataSchema.parse(input.data);
  return withLog("cvs.create", { ownerId, guestId: input.guestId }, async () => {
    const [row] = await db.insert(cvs).values({
      title: input.title, data,
      ownerId: ownerId ?? null, guestId: ownerId ? null : input.guestId!,
    }).returning();
    return serialize(row);
  });
}

export async function updateCv(id: string, patch: {
  title?: string; data?: CvData; template?: TemplateId; accent?: string;
}, guestId?: string) {
  const row = await db.query.cvs.findFirst({ where: eq(cvs.id, id) });
  if (!row) throw new Error("Not found");
  await assertCanWrite(row, guestId);
  return withLog("cvs.update", { cvId: id, ownerId: row.ownerId }, async () => {
    const [updated] = await db.update(cvs).set({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.data  !== undefined && { data: cvDataSchema.parse(patch.data) }),
      ...(patch.template !== undefined && { template: patch.template }),
      ...(patch.accent   !== undefined && { accent: patch.accent }),
    }).where(eq(cvs.id, id)).returning();                    // updatedAt via $onUpdate
    return serialize(updated);
  });
}

export async function removeCv(id: string, guestId?: string) {
  const row = await db.query.cvs.findFirst({ where: eq(cvs.id, id) });
  if (!row) return { ok: true };
  await assertCanWrite(row, guestId);
  return withLog("cvs.remove", { cvId: id, ownerId: row.ownerId }, async () => {
    await db.transaction(async (tx) => {                     // today's semantics: detach scans, keep history
      await tx.update(scans).set({ cvId: null }).where(eq(scans.cvId, id));
      await tx.delete(cvs).where(eq(cvs.id, id));
    });
    return { ok: true };
  });
}

/** THE KPI. Set-based, atomic — simpler than today's Convex loop. */
export async function claimGuest(guestId: string) {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error("Not authenticated");
  return withLog("cvs.claimGuest", { ownerId, guestId }, async () =>
    db.transaction(async (tx) => {
      const movedCvs = await tx.update(cvs)
        .set({ ownerId, guestId: null })
        .where(eq(cvs.guestId, guestId)).returning({ id: cvs.id });
      const movedScans = await tx.update(scans)
        .set({ ownerId, guestId: null })
        .where(eq(scans.guestId, guestId)).returning({ id: scans.id });
      return { cvs: movedCvs.length, scans: movedScans.length };
    }));
}
