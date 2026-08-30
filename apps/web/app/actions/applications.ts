"use server";
import { db } from "@/db";
import { applications, type Application } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { getOwnerId } from "./_shared";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";
import { withLog } from "@/lib/log";

const serialize = (r: Application) => ({
  ...r,
  appliedAt: r.appliedAt.getTime(),
  createdAt: r.createdAt.getTime(),
  updatedAt: r.updatedAt.getTime(),
});

function assertStatus(status: string): ApplicationStatus {
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) {
    throw new Error("Invalid status");
  }
  return status as ApplicationStatus;
}

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

export async function createApplication(input: {
  company: string;
  role: string;
  url?: string;
  notes?: string;
  status?: ApplicationStatus;
}) {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error("Not authenticated");
  const company = input.company.trim();
  const role = input.role.trim();
  if (!company || !role) throw new Error("Company and role are required");
  const status = input.status ? assertStatus(input.status) : "applied";
  return withLog("apps.create", { ownerId }, async () => {
    const [row] = await db.insert(applications).values({
      ownerId,
      company,
      role,
      url: input.url?.trim() || null,
      notes: input.notes?.trim() || null,
      status,
    }).returning();
    return serialize(row);
  });
}

export async function updateStatus(id: string, status: ApplicationStatus) {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error("Not authenticated");
  const next = assertStatus(status);
  return withLog("apps.updateStatus", { ownerId, id }, async () => {
    const [row] = await db.update(applications)
      .set({ status: next })
      .where(and(eq(applications.id, id), eq(applications.ownerId, ownerId)))
      .returning();
    if (!row) throw new Error("Not found");
    return serialize(row);
  });
}

export async function removeApplication(id: string) {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error("Not authenticated");
  return withLog("apps.remove", { ownerId, id }, async () => {
    const deleted = await db.delete(applications)
      .where(and(eq(applications.id, id), eq(applications.ownerId, ownerId)))
      .returning({ id: applications.id });
    if (!deleted.length) throw new Error("Not found");
    return { ok: true };
  });
}
