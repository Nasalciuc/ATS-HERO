"use server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { applications, applicationEvents, cvs, type Application } from "@/db/schema";
import { and, eq, desc, asc, inArray } from "drizzle-orm";
import { getOwnerId } from "./_shared";
import { APPLICATION_STATUSES, type ApplicationStatus, type ArchiveReason } from "@/lib/types";
import { withLog } from "@/lib/log";
import { jobUrlKey, safeJobUrl, MAX_JOB_URL_CHARS } from "@/lib/job-url";
import { FOLLOW_UP_DAYS, MAX_DESCRIPTION_CHARS } from "@/lib/tracker";

const DAY_MS = 24 * 60 * 60 * 1000;
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function assertStatus(status: string): ApplicationStatus {
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) {
    throw new Error("Invalid status");
  }
  return status as ApplicationStatus;
}

async function requireOwner(): Promise<string> {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error("Not authenticated");
  return ownerId;
}

async function ownedRow(tx: Tx, id: string, ownerId: string): Promise<Application> {
  const row = await tx.query.applications.findFirst({
    where: and(eq(applications.id, id), eq(applications.ownerId, ownerId)),
  });
  if (!row) throw new Error("Not found");
  return row;
}

/** What the add form sends. Lengths match the form's own limits. */
const CreateInput = z.object({
  company: z.string().trim().max(120),
  role: z.string().trim().max(120),
  url: z.string().trim().max(MAX_JOB_URL_CHARS).optional(),
  notes: z.string().trim().max(400).optional(),
  location: z.string().trim().max(200).optional(),
  description: z.string().trim().max(MAX_DESCRIPTION_CHARS).optional(),
  status: z.string().optional(),
});

const DetailsInput = z.object({
  company: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().min(1).max(120).optional(),
  url: z.string().trim().max(MAX_JOB_URL_CHARS).optional(),
  notes: z.string().trim().max(400).optional(),
  location: z.string().trim().max(200).optional(),
  description: z.string().trim().max(MAX_DESCRIPTION_CHARS).optional(),
});

/**
 * The owner's jobs, newest first. `reachedInterview`: the history shows the job got to Interview or
 * Offer at some point (a rejection after an interview still counts as an interview).
 */
export async function listMyApplications() {
  const ownerId = await getOwnerId();
  if (!ownerId) return [];
  return withLog("apps.listMine", { ownerId }, async () => {
    const rows = await db.query.applications.findMany({
      where: eq(applications.ownerId, ownerId),
      orderBy: [desc(applications.appliedAt)],
    });
    const reached = new Set(
      (await db.select({ id: applicationEvents.applicationId }).from(applicationEvents)
        .where(and(eq(applicationEvents.ownerId, ownerId), inArray(applicationEvents.toStatus, ["interview", "offer"]))))
        .map((e) => e.id),
    );
    return rows.map((r) => ({ ...serialize(r), reachedInterview: reached.has(r.id) || r.status === "interview" || r.status === "offer" }));
  });
}

/** A job's history, oldest first. */
export async function listApplicationEvents(id: string) {
  const ownerId = await requireOwner();
  return withLog("apps.events", { ownerId, id }, async () => {
    const rows = await db.select().from(applicationEvents)
      .where(and(eq(applicationEvents.applicationId, id), eq(applicationEvents.ownerId, ownerId)))
      .orderBy(asc(applicationEvents.at));
    return rows.map((e) => ({ ...e, at: e.at.getTime() }));
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
  location?: string;
  description?: string;
  status?: ApplicationStatus;
}) {
  const ownerId = await requireOwner();
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) throw new Error("Company and role must be 1–120 characters, notes up to 400");
  const { company, role, notes, location, description } = parsed.data;
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
        location: location || null,
        description: description || null,
        status,
        source: "manual",
        submittedAt: status === "saved" ? null : now,
      }).returning();
      await tx.insert(applicationEvents).values({ applicationId: row.id, ownerId, kind: "created", toStatus: status, at: now });
      return { ...serialize(row), duplicate: false as const };
    });
  });
}

/** Edits what the person typed about a job. A new link must not be one of their other jobs. */
export async function updateApplicationDetails(id: string, input: z.input<typeof DetailsInput>) {
  const ownerId = await requireOwner();
  const parsed = DetailsInput.safeParse(input);
  if (!parsed.success) throw new Error("Company and role must be 1–120 characters, notes up to 400");
  const d = parsed.data;
  const patch: Partial<typeof applications.$inferInsert> = {};
  if (d.company !== undefined) patch.company = d.company;
  if (d.role !== undefined) patch.role = d.role;
  if (d.notes !== undefined) patch.notes = d.notes || null;
  if (d.location !== undefined) patch.location = d.location || null;
  if (d.description !== undefined) patch.description = d.description || null;
  if (d.url !== undefined) {
    const url = d.url ? safeJobUrl(d.url) : null;
    if (d.url && !url) throw new Error("Use a link that starts with http:// or https://");
    patch.url = url;
    patch.urlKey = jobUrlKey(url);
  }
  return withLog("apps.updateDetails", { ownerId, id }, async () => {
    return db.transaction(async (tx) => {
      await ownedRow(tx, id, ownerId);
      if (patch.urlKey) {
        const other = await tx.query.applications.findFirst({
          where: and(eq(applications.ownerId, ownerId), eq(applications.urlKey, patch.urlKey)),
        });
        if (other && other.id !== id) throw new Error("This link is already another job in your tracker");
      }
      if (!Object.keys(patch).length) return serialize(await ownedRow(tx, id, ownerId));
      const [row] = await tx.update(applications).set(patch)
        .where(and(eq(applications.id, id), eq(applications.ownerId, ownerId))).returning();
      return serialize(row);
    });
  });
}

async function moveStatus(tx: Tx, current: Application, ownerId: string, next: ApplicationStatus) {
  if (current.status === next) return current;
  const now = new Date();
  const [row] = await tx.update(applications)
    .set({
      status: next,
      ...(next === "applied" && !current.submittedAt ? { submittedAt: now } : {}),
    })
    .where(and(eq(applications.id, current.id), eq(applications.ownerId, ownerId)))
    .returning();
  if (!row) throw new Error("Not found");
  await tx.insert(applicationEvents).values({
    applicationId: current.id, ownerId, kind: "status_changed", fromStatus: current.status, toStatus: next, at: now,
  });
  return row;
}

/**
 * Moves a job to another status and writes the change to its history. Moving to "applied" the
 * first time sets the sending date. The same status again changes nothing and writes nothing.
 */
export async function updateStatus(id: string, status: ApplicationStatus) {
  const ownerId = await requireOwner();
  const next = assertStatus(status);
  return withLog("apps.updateStatus", { ownerId, id }, async () => {
    return db.transaction(async (tx) => serialize(await moveStatus(tx, await ownedRow(tx, id, ownerId), ownerId, next)));
  });
}

const ARCHIVE_REASONS: ArchiveReason[] = ["no_response", "withdrawn", "closed", "other"];

export async function archiveApplication(id: string, reason: ArchiveReason = "other") {
  const ownerId = await requireOwner();
  if (!ARCHIVE_REASONS.includes(reason)) throw new Error("Invalid reason");
  return withLog("apps.archive", { ownerId, id }, async () => {
    return db.transaction(async (tx) => {
      const current = await ownedRow(tx, id, ownerId);
      if (current.archivedAt) return serialize(current);
      const now = new Date();
      const [row] = await tx.update(applications).set({ archivedAt: now, archiveReason: reason })
        .where(and(eq(applications.id, id), eq(applications.ownerId, ownerId))).returning();
      await tx.insert(applicationEvents).values({ applicationId: id, ownerId, kind: "archived", at: now });
      return serialize(row);
    });
  });
}

export async function unarchiveApplication(id: string) {
  const ownerId = await requireOwner();
  return withLog("apps.unarchive", { ownerId, id }, async () => {
    return db.transaction(async (tx) => {
      const current = await ownedRow(tx, id, ownerId);
      if (!current.archivedAt) return serialize(current);
      const now = new Date();
      const [row] = await tx.update(applications).set({ archivedAt: null, archiveReason: null })
        .where(and(eq(applications.id, id), eq(applications.ownerId, ownerId))).returning();
      await tx.insert(applicationEvents).values({ applicationId: id, ownerId, kind: "unarchived", at: now });
      return serialize(row);
    });
  });
}

export type FollowUpAnswer = "interview" | "rejected" | "not_yet" | "no_reply";

/**
 * The answer to "Did you hear back?". Interview or Rejected move the job; Not yet asks again in
 * FOLLOW_UP_DAYS; No reply archives it, and "no reply" counts in the numbers.
 */
export async function answerFollowUp(id: string, answer: FollowUpAnswer) {
  const ownerId = await requireOwner();
  if (!["interview", "rejected", "not_yet", "no_reply"].includes(answer)) throw new Error("Invalid answer");
  return withLog("apps.followUp", { ownerId, id }, async () => {
    return db.transaction(async (tx) => {
      const current = await ownedRow(tx, id, ownerId);
      const now = new Date();
      if (answer === "interview" || answer === "rejected") return serialize(await moveStatus(tx, current, ownerId, answer));
      if (answer === "not_yet") {
        const [row] = await tx.update(applications).set({ followUpAt: new Date(now.getTime() + FOLLOW_UP_DAYS * DAY_MS) })
          .where(and(eq(applications.id, id), eq(applications.ownerId, ownerId))).returning();
        await tx.insert(applicationEvents).values({ applicationId: id, ownerId, kind: "follow_up_snoozed", at: now });
        return serialize(row);
      }
      const [row] = await tx.update(applications).set({ archivedAt: now, archiveReason: "no_response" })
        .where(and(eq(applications.id, id), eq(applications.ownerId, ownerId))).returning();
      await tx.insert(applicationEvents).values({ applicationId: id, ownerId, kind: "archived", at: now });
      return serialize(row);
    });
  });
}

/**
 * "What did you send?": one of the owner's CVs (its exact version is kept as a hash), or "other"
 * (a file made elsewhere). Nothing is chosen for the person.
 */
export async function setCvSent(id: string, choice: { cvId: string } | { other: true }) {
  const ownerId = await requireOwner();
  return withLog("apps.cvSent", { ownerId, id }, async () => {
    return db.transaction(async (tx) => {
      await ownedRow(tx, id, ownerId);
      let cvId: string;
      let cvHash: string | null = null;
      if ("cvId" in choice) {
        const cv = await tx.query.cvs.findFirst({ where: and(eq(cvs.id, choice.cvId), eq(cvs.ownerId, ownerId)) });
        if (!cv) throw new Error("Not found");
        cvId = cv.id;
        cvHash = createHash("sha256").update(JSON.stringify(cv.data)).digest("hex");
      } else {
        cvId = "other";
      }
      const [row] = await tx.update(applications).set({ cvId, cvHash })
        .where(and(eq(applications.id, id), eq(applications.ownerId, ownerId))).returning();
      await tx.insert(applicationEvents).values({ applicationId: id, ownerId, kind: "cv_sent", at: new Date() });
      return serialize(row);
    });
  });
}

/** Deletes a job and its history. */
export async function removeApplication(id: string) {
  const ownerId = await requireOwner();
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
