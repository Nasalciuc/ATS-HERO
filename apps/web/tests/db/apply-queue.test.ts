// "Ready to send", data step: apply_queue and apply_settings on the real migrations (PGlite).
// One queue row per job, a daily limit of 1 to 10, and deleting a job or the account clears them.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "./setup";
import { applications, applyQueue, applySettings } from "@/db/schema";

const holder = vi.hoisted(() => ({ db: null as unknown, owner: null as string | null }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@/app/actions/_shared", () => ({ getOwnerId: async () => holder.owner }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: holder.owner }),
  clerkClient: async () => ({ users: { deleteUser: async () => undefined } }),
}));

import { removeApplication } from "@/app/actions/applications";
import { deleteAccount } from "@/app/actions/users";

let db: Awaited<ReturnType<typeof makeTestDb>>;
beforeEach(async () => {
  db = await makeTestDb();
  holder.db = db;
  holder.owner = "u1";
  vi.spyOn(console, "log").mockImplementation(() => {});
});

async function job(ownerId: string) {
  const [a] = await db.insert(applications).values({ ownerId, company: "Acme", role: "Data Analyst", status: "saved" }).returning();
  return a;
}
const queue = (ownerId: string, applicationId: string) =>
  db.insert(applyQueue).values({ ownerId, applicationId, cvId: "cv1" }).returning();

describe("apply_queue", () => {
  it("queues a job as waiting, once", async () => {
    const a = await job("u1");
    const [row] = await queue("u1", a.id);
    expect(row).toMatchObject({ status: "waiting", reason: null, readyUntil: null, sendingAt: null, sentAt: null, confirmation: null });
    await expect(queue("u1", a.id)).rejects.toThrow();
  });

  it("deleting the job takes it out of the queue", async () => {
    const a = await job("u1");
    await queue("u1", a.id);
    await removeApplication(a.id);
    expect(await db.select().from(applyQueue)).toEqual([]);
  });
});

describe("apply_settings", () => {
  it("a daily limit of 5 until the person changes it, never below 1 or above 10", async () => {
    const [s] = await db.insert(applySettings).values({ ownerId: "u1" }).returning();
    expect(s.dailyLimit).toBe(5);
    await expect(db.insert(applySettings).values({ ownerId: "u2", dailyLimit: 0 })).rejects.toThrow();
    await expect(db.insert(applySettings).values({ ownerId: "u3", dailyLimit: 11 })).rejects.toThrow();
    await expect(db.insert(applySettings).values({ ownerId: "u4", dailyLimit: 10 })).resolves.toBeDefined();
  });
});

describe("deleting the account", () => {
  it("deletes the person's queue and limit, and no one else's", async () => {
    const mine = await job("u1");
    const theirs = await job("u2");
    await queue("u1", mine.id);
    await queue("u2", theirs.id);
    await db.insert(applySettings).values([{ ownerId: "u1" }, { ownerId: "u2" }]);
    await deleteAccount();
    expect(await db.select().from(applyQueue).where(eq(applyQueue.ownerId, "u1"))).toEqual([]);
    expect(await db.select().from(applySettings).where(eq(applySettings.ownerId, "u1"))).toEqual([]);
    expect(await db.select().from(applyQueue)).toHaveLength(1);
    expect(await db.select().from(applySettings)).toHaveLength(1);
  });
});
