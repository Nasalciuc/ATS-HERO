"use server";
import { db } from "@/db";
import { cvs, scans, type Cv } from "@/db/schema";
import { and, eq, desc, isNull } from "drizzle-orm";
import { getOwnerId, canRead } from "./_shared";
import { cvOwnershipPredicate } from "@/lib/ownership";
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
  const ownerId = await getOwnerId();
  const ownershipPredicate = cvOwnershipPredicate(id, ownerId, guestId);
  return withLog("cvs.update", { cvId: id, ownerId }, async () => {
    const [updated] = await db.update(cvs).set({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.data  !== undefined && { data: cvDataSchema.parse(patch.data) }),
      ...(patch.template !== undefined && { template: patch.template }),
      ...(patch.accent   !== undefined && { accent: patch.accent }),
    }).where(ownershipPredicate).returning();                    // updatedAt via $onUpdate
    if (!updated) throw new Error("Not found or forbidden");   // 0 rows affected = reject
    return serialize(updated);
  });
}

export async function removeCv(id: string, guestId?: string) {
  const ownerId = await getOwnerId();
  const ownershipPredicate = cvOwnershipPredicate(id, ownerId, guestId);
  return withLog("cvs.remove", { cvId: id, ownerId }, async () => {
    return db.transaction(async (tx) => {
      const [deleted] = await tx.delete(cvs).where(ownershipPredicate).returning({ id: cvs.id });
      if (!deleted) throw new Error("Not found or forbidden");
      await tx.update(scans).set({ cvId: null }).where(eq(scans.cvId, id));  // detach only if delete succeeded
      return { ok: true };
    });
  });
}

/** THE KPI. Set-based and atomic — two UPDATEs in one transaction. */
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
