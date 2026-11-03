"use server";
import { z } from "zod";
import { db } from "@/db";
import { applications, applicationEvents, type Application } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { getOwnerId } from "./_shared";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";
import { withLog } from "@/lib/log";
import { jobUrlKey, safeJobUrl, MAX_JOB_URL_CHARS } from "@/lib/job-url";

const ms = (d: Date | null) => (d ? d.getTime() : null);

const serialize = (r: Application) => ({
  ...r,
  appliedAt: r.appliedAt.getTime(),
  createdAt: r.createdAt.getTime(),
  updatedAt: r.updatedAt.getTime(),
  submittedAt: ms(r.submittedAt),
  followUpAt: ms(r.followUpAt),
  archivedAt: ms(r.archivedAt),
});

function assertStatus(status: string): ApplicationStatus {
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) {
    throw new Error("Invalid status");
  }
  return status as ApplicationStatus;
}

/** What the add form sends. Lengths match the form's own limits (`app/app/tracker/page.tsx`). */
const CreateInput = z.object({
  company: z.string().trim().max(120),
  role: z.string().trim().max(120),
  url: z.string().trim().max(MAX_JOB_URL_CHARS).optional(),
  notes: z.string().trim().max(400).optional(),
  status: z.string().optional(),
});

export async function listMyApplications() {
  const ownerId = await getOwnerId();
  if (!ownerId) return [];
  return withLog("apps.listMine", { ownerId }, async () => {
    const rows = await db.query.applications.findMany({
      where: eq(applications.ownerId, ownerId),
      orderBy: [desc(applications.appliedAt)],
    });
    return rows.map(serialize);
  });
}

/**
 * Adds a job. The same link saved again returns the row that exists (`duplicate: true`) instead of
 * a second one. The row and its first history line are written together.
 */
export async function createApplication(input: {
  company: string;
  role: string;
  url?: string;
  notes?: string;
  status?: ApplicationStatus;
}) {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error("Not authenticated");
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) throw new Error("Company and role must be 1–120 characters, notes up to 400");
  const { company, role, notes } = parsed.data;
  if (!company || !role) throw new Error("Company and role are required");
  const url = parsed.data.url ? safeJobUrl(parsed.data.url) : null;
  if (parsed.data.url && !url) throw new Error("Use a link that starts with http:// or https://");
  const urlKey = jobUrlKey(url);
  const status = parsed.data.status ? assertStatus(parsed.data.status) : "applied";

  return withLog("apps.create", { ownerId }, async () => {
    return db.transaction(async (tx) => {
      if (urlKey) {
        const existing = await tx.query.applications.findFirst({
          where: and(eq(applications.ownerId, ownerId), eq(applications.urlKey, urlKey)),
        });
        if (existing) return { ...serialize(existing), duplicate: true as const };
      }
      const now = new Date();
      const [row] = await tx.insert(applications).values({
        ownerId,
        company,
        role,
        url,
        urlKey,
        notes: notes || null,
        status,
        source: "manual",
        submittedAt: status === "applied" ? now : null,
      }).returning();
      await tx.insert(applicationEvents).values({
        applicationId: row.id,
        ownerId,
        kind: "created",
        toStatus: status,
        at: now,
      });
      return { ...serialize(row), duplicate: false as const };
    });
  });
}

/**
 * Moves a job to another status and writes the change to its history. Moving to "applied" the
 * first time sets the sending date. The same status again changes nothing and writes nothing.
 */
export async function updateStatus(id: string, status: ApplicationStatus) {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error("Not authenticated");
  const next = assertStatus(status);
  return withLog("apps.updateStatus", { ownerId, id }, async () => {
    return db.transaction(async (tx) => {
      const current = await tx.query.applications.findFirst({
        where: and(eq(applications.id, id), eq(applications.ownerId, ownerId)),
      });
      if (!current) throw new Error("Not found");
      if (current.status === next) return serialize(current);
      const now = new Date();
      const [row] = await tx.update(applications)
        .set({
          status: next,
          ...(next === "applied" && !current.submittedAt ? { submittedAt: now } : {}),
        })
        .where(and(eq(applications.id, id), eq(applications.ownerId, ownerId)))
        .returning();
      if (!row) throw new Error("Not found");
      await tx.insert(applicationEvents).values({
        applicationId: id,
        ownerId,
        kind: "status_changed",
        fromStatus: current.status,
        toStatus: next,
        at: now,
      });
      return serialize(row);
    });
  });
}

/** Deletes a job and its history. */
export async function removeApplication(id: string) {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error("Not authenticated");
  return withLog("apps.remove", { ownerId, id }, async () => {
    return db.transaction(async (tx) => {
      const deleted = await tx.delete(applications)
        .where(and(eq(applications.id, id), eq(applications.ownerId, ownerId)))
        .returning({ id: applications.id });
      if (!deleted.length) throw new Error("Not found");
      await tx.delete(applicationEvents)
        .where(and(eq(applicationEvents.applicationId, id), eq(applicationEvents.ownerId, ownerId)));
      return { ok: true };
    });
  });
}
