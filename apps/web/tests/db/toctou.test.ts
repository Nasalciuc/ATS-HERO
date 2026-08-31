import { beforeEach, describe, expect, it } from "vitest";
import { makeTestDb } from "./setup";
import { cvs, scans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { emptyCvData } from "@/lib/types";
import { cvOwnershipPredicate } from "@/lib/ownership";

let db: Awaited<ReturnType<typeof makeTestDb>>;
beforeEach(async () => { db = await makeTestDb(); });

async function updateOwned(id: string, ownerId: string | null, title: string, guestId?: string) {
  const [updated] = await db.update(cvs).set({ title })
    .where(cvOwnershipPredicate(id, ownerId, guestId)).returning();
  if (!updated) throw new Error("Not found or forbidden");
  return updated;
}

describe("TOCTOU-safe CV mutations", () => {
  it("rejects an update whose ownership predicate does not match", async () => {
    const [cv] = await db.insert(cvs).values({
      ownerId: "user-a", title: "orig", data: emptyCvData(),
    }).returning();

    await expect(updateOwned(cv.id, "user-b", "stolen")).rejects.toThrow("Not found or forbidden");
    const [row] = await db.select().from(cvs).where(eq(cvs.id, cv.id));
    expect(row.title).toBe("orig");
    expect(row.ownerId).toBe("user-a");
  });

  it("concurrent A-update and B-update never persist B's patch", async () => {
    const [cv] = await db.insert(cvs).values({
      ownerId: "user-a", title: "orig", data: emptyCvData(),
    }).returning();

    const results = await Promise.allSettled([
      updateOwned(cv.id, "user-a", "from-A"),
      updateOwned(cv.id, "user-b", "from-B"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(/Not found or forbidden/);

    const [row] = await db.select().from(cvs).where(eq(cvs.id, cv.id));
    expect(row.title).toBe("from-A");
    expect(row.ownerId).toBe("user-a");
  });

  it("guest write after a concurrent claim is rejected (never writes the claimed row)", async () => {
    const [cv] = await db.insert(cvs).values({
      guestId: "g1", title: "guest", data: emptyCvData(),
    }).returning();

    const results = await Promise.allSettled([
      db.update(cvs).set({ ownerId: "user-a", guestId: null }).where(eq(cvs.guestId, "g1")).returning(),
      updateOwned(cv.id, null, "guest-write", "g1"),
    ]);

    const [row] = await db.select().from(cvs).where(eq(cvs.id, cv.id));
    expect(row.ownerId === "user-a" || row.guestId === "g1").toBe(true);
    expect(row.title === "guest" || row.title === "guest-write").toBe(true);
    if (row.ownerId === "user-a") {
      expect(row.guestId).toBeNull();
      // If claim won, a subsequent guest write must fail.
      await expect(updateOwned(cv.id, null, "after-claim", "g1")).rejects.toThrow("Not found or forbidden");
    }
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
  });

  it("does not detach scans when the delete predicate misses", async () => {
    const [cv] = await db.insert(cvs).values({
      ownerId: "user-a", title: "t", data: emptyCvData(),
    }).returning();
    await db.insert(scans).values({
      ownerId: "user-a", cvId: cv.id, kind: "score", generalScore: 60, result: {} as never,
    });

    await db.transaction(async (tx) => {
      const [deleted] = await tx.delete(cvs).where(cvOwnershipPredicate(cv.id, "user-b")).returning({ id: cvs.id });
      if (!deleted) throw new Error("Not found or forbidden");
      await tx.update(scans).set({ cvId: null }).where(eq(scans.cvId, cv.id));
    }).catch((err: Error) => {
      if (err.message !== "Not found or forbidden") throw err;
    });

    const [kept] = await db.select().from(scans);
    expect(kept.cvId).toBe(cv.id);
    expect((await db.select().from(cvs)).length).toBe(1);
  });
});
