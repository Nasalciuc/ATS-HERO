// Daily search, data step: the job_searches table on the real migrations (PGlite). One search per
// owner, a sane daily number, and an account deletion takes the search with it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "./setup";
import { jobSearches } from "@/db/schema";

const holder = vi.hoisted(() => ({ db: null as unknown, owner: null as string | null }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: holder.owner }),
  clerkClient: async () => ({ users: { deleteUser: async () => undefined } }),
}));

import { deleteAccount } from "@/app/actions/users";

let db: Awaited<ReturnType<typeof makeTestDb>>;
beforeEach(async () => {
  db = await makeTestDb();
  holder.db = db;
  holder.owner = "u1";
  vi.spyOn(console, "log").mockImplementation(() => {});
});

const search = (ownerId: string, over: Partial<typeof jobSearches.$inferInsert> = {}) =>
  db.insert(jobSearches).values({ ownerId, searchTerm: "Data Analyst", country: "romania", boards: ["indeed"], ...over }).returning();

describe("job_searches", () => {
  it("keeps a search with its defaults: on, 10 a day, any remote, no run yet", async () => {
    const [row] = await search("u1", { city: "Bucharest", boards: ["indeed", "linkedin"] });
    expect(row).toMatchObject({
      ownerId: "u1", searchTerm: "Data Analyst", country: "romania", city: "Bucharest",
      boards: ["indeed", "linkedin"], perDay: 10, remoteOnly: false, enabled: true, cvId: null, lastRunAt: null,
    });
  });

  it("one search per owner", async () => {
    await search("u1");
    await expect(search("u1")).rejects.toThrow();
    await expect(search("u2")).resolves.toHaveLength(1);
  });

  it("a day brings 1 to 20 new jobs, never more", async () => {
    await expect(search("u1", { perDay: 0 })).rejects.toThrow();
    await expect(search("u2", { perDay: 21 })).rejects.toThrow();
    await expect(search("u3", { perDay: 20 })).resolves.toHaveLength(1);
  });

  it("deleting the account deletes its search, and no one else's", async () => {
    await search("u1");
    await search("u2");
    await deleteAccount();
    expect(await db.select().from(jobSearches).where(eq(jobSearches.ownerId, "u1"))).toEqual([]);
    expect(await db.select().from(jobSearches)).toHaveLength(1);
  });
});
