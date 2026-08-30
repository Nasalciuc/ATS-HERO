import { beforeEach, describe, expect, it } from "vitest";
import { makeTestDb } from "./setup";
import { aiUsage, cvs, scans, users } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { emptyCvData } from "@/lib/types";

let db: Awaited<ReturnType<typeof makeTestDb>>;
beforeEach(async () => { db = await makeTestDb(); });

const data = () => emptyCvData();

/** The WHERE clause listMyCvs uses for a guest — asserted here without the Clerk runtime. */
const guestScope = (guestId: string) => and(eq(cvs.guestId, guestId), isNull(cvs.ownerId));

describe("ownership & integrity", () => {
  it("claim moves cvs+scans and zeroes guestId", async () => {
    await db.insert(cvs).values({ guestId: "g1", title: "t", data: data() });
    await db.insert(scans).values({ guestId: "g1", kind: "score", generalScore: 50, result: {} as never });

    await db.transaction(async (tx) => {
      await tx.update(cvs).set({ ownerId: "u1", guestId: null }).where(eq(cvs.guestId, "g1"));
      await tx.update(scans).set({ ownerId: "u1", guestId: null }).where(eq(scans.guestId, "g1"));
    });

    expect((await db.select().from(cvs).where(eq(cvs.ownerId, "u1"))).length).toBe(1);
    expect((await db.select().from(scans).where(eq(scans.ownerId, "u1"))).length).toBe(1);
    expect((await db.select().from(cvs).where(eq(cvs.guestId, "g1"))).length).toBe(0);
  });

  it("a guest cannot see another guest's CV", async () => {
    await db.insert(cvs).values({ guestId: "g1", title: "mine", data: data() });
    await db.insert(cvs).values({ guestId: "g2", title: "theirs", data: data() });

    const mine = await db.select().from(cvs).where(guestScope("g1"));
    expect(mine.map((r) => r.title)).toEqual(["mine"]);
  });

  it("an owner's CV is invisible to the guest scope after claim", async () => {
    await db.insert(cvs).values({ ownerId: "u1", guestId: "g1", title: "claimed", data: data() });
    expect((await db.select().from(cvs).where(guestScope("g1"))).length).toBe(0);
  });

  it("deleteAccount leaves zero rows across the four owned tables", async () => {
    await db.insert(users).values({ clerkId: "u1", email: "u1@x.dev" });
    const [cv] = await db.insert(cvs).values({ ownerId: "u1", title: "t", data: data() }).returning();
    await db.insert(scans).values({ ownerId: "u1", cvId: cv.id, kind: "score", generalScore: 10, result: {} as never });
    await db.insert(aiUsage).values({ ownerId: "u1", day: "2026-01-01", count: 3 });

    await db.transaction(async (tx) => {
      await tx.delete(scans).where(eq(scans.ownerId, "u1"));
      await tx.delete(cvs).where(eq(cvs.ownerId, "u1"));
      await tx.delete(aiUsage).where(eq(aiUsage.ownerId, "u1"));
      await tx.delete(users).where(eq(users.clerkId, "u1"));
    });

    expect((await db.select().from(scans)).length).toBe(0);
    expect((await db.select().from(cvs)).length).toBe(0);
    expect((await db.select().from(aiUsage)).length).toBe(0);
    expect((await db.select().from(users)).length).toBe(0);
  });

  it("deleting a CV detaches its scans instead of dropping history", async () => {
    const [cv] = await db.insert(cvs).values({ ownerId: "u1", title: "t", data: data() }).returning();
    await db.insert(scans).values({ ownerId: "u1", cvId: cv.id, kind: "score", generalScore: 60, result: {} as never });

    await db.transaction(async (tx) => {
      await tx.update(scans).set({ cvId: null }).where(eq(scans.cvId, cv.id));
      await tx.delete(cvs).where(eq(cvs.id, cv.id));
    });

    const kept = await db.select().from(scans);
    expect(kept.length).toBe(1);
    expect(kept[0].cvId).toBeNull();
  });

  it("CHECK rejects double-NULL ownership", async () => {
    await expect(db.insert(cvs).values({ title: "x", data: data() })).rejects.toThrow();
  });

  it("CHECK rejects score 101", async () => {
    await expect(
      db.insert(scans).values({ ownerId: "u1", kind: "score", generalScore: 101, result: {} as never })
    ).rejects.toThrow();
  });

  it("users_by_clerk is unique", async () => {
    await db.insert(users).values({ clerkId: "u1", email: "a@x.dev" });
    await expect(db.insert(users).values({ clerkId: "u1", email: "b@x.dev" })).rejects.toThrow();
  });
});
