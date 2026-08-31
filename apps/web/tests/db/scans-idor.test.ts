import { beforeEach, describe, expect, it } from "vitest";
import { makeTestDb } from "./setup";
import { cvs } from "@/db/schema";
import { emptyCvData } from "@/lib/types";
import { saveScanOn } from "@/lib/scans-write";

let db: Awaited<ReturnType<typeof makeTestDb>>;
beforeEach(async () => { db = await makeTestDb(); });

const report = { generalScore: 50, message: "", sections: [] };

describe("saveScan cvId ownership (IDOR)", () => {
  it("throws Forbidden when user B attaches a scan to user A's CV", async () => {
    const [cvA] = await db.insert(cvs).values({
      ownerId: "user-a", title: "A's CV", data: emptyCvData(),
    }).returning();

    await expect(saveScanOn(db, "user-b", {
      cvId: cvA.id, kind: "score", generalScore: 50, result: report,
    })).rejects.toThrow("Forbidden: cvId not accessible");
  });

  it("allows owner A to save a scan against their own CV", async () => {
    const [cvA] = await db.insert(cvs).values({
      ownerId: "user-a", title: "A's CV", data: emptyCvData(),
    }).returning();

    const row = await saveScanOn(db, "user-a", {
      cvId: cvA.id, kind: "score", generalScore: 50, result: report,
    });
    expect(row.cvId).toBe(cvA.id);
    expect(row.ownerId).toBe("user-a");
  });

  it("allows a scan with no cvId (Improve My Resume)", async () => {
    const row = await saveScanOn(db, "user-b", {
      kind: "score", generalScore: 40, result: report,
    });
    expect(row.cvId).toBeNull();
    expect(row.ownerId).toBe("user-b");
  });

  it("rejects a missing cvId document", async () => {
    await expect(saveScanOn(db, "user-a", {
      cvId: "does-not-exist", kind: "score", generalScore: 50, result: report,
    })).rejects.toThrow("Forbidden: cvId not accessible");
  });
});
