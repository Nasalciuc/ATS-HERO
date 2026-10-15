// A save that fails must not copy the CV into the logs. Drizzle puts every bound parameter in
// its error message and Postgres puts the failing row in `detail`; withLog keeps neither, in the
// line it logs and in the error it rethrows (Next.js logs what a Server Action throws).
import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeTestDb } from "./setup";
import { cvs } from "@/db/schema";
import { emptyCvData } from "@/lib/types";
import { withLog } from "@/lib/log";

const SECRET = "Ana Popescu, +40 721 234 567";

afterEach(() => vi.restoreAllMocks());

describe("withLog and a failed query", () => {
  it("logs and rethrows the database's message, never the CV", async () => {
    const db = await makeTestDb();
    const data = emptyCvData();
    data.personalInfo = { ...data.personalInfo, name: SECRET };
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    // No owner and no guest code: the cvs_ownership check rejects the row.
    const thrown = await withLog("cvs.create", { cvId: "x" }, () =>
      db.insert(cvs).values({ title: SECRET, data }).returning(),
    ).catch((e: unknown) => e);

    const line = String(logged.mock.calls.at(-1)?.[0]);
    expect(line).not.toContain(SECRET);
    expect(JSON.parse(line)).toMatchObject({ level: "error", action: "cvs.create", cvId: "x" });
    expect(JSON.parse(line).err).toMatch(/23514.*cvs_ownership/);

    expect(thrown).toBeInstanceOf(Error);
    expect(inspect(thrown, { depth: 5 })).not.toContain(SECRET);
    expect((thrown as Error).message).toMatch(/cvs_ownership/);
  });

  it("passes any other error through unchanged", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const original = new Error("Forbidden: cvId not accessible");
    await expect(withLog("scans.save", {}, () => Promise.reject(original))).rejects.toBe(original);
  });
});
