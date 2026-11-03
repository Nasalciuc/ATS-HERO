// Tracker v2, data step (TRACKER-V2-DESIGN.md §7): the real Server Actions against the real
// migrations (PGlite). Each job keeps its history; the same link saved twice is one job; another
// owner sees and changes nothing; deleting a job or the account takes its history with it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import { makeTestDb } from "./setup";
import * as schema from "@/db/schema";
import { applications, applicationEvents, users } from "@/db/schema";

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

import {
  answerFollowUp, archiveApplication, createApplication, listApplicationEvents, listMyApplications,
  removeApplication, setCvSent, unarchiveApplication, updateApplicationDetails, updateStatus,
} from "@/app/actions/applications";
import { cvs } from "@/db/schema";
import { emptyCvData } from "@/lib/types";
import { deleteAccount } from "@/app/actions/users";

let db: Awaited<ReturnType<typeof makeTestDb>>;
beforeEach(async () => {
  db = await makeTestDb();
  holder.db = db;
  holder.owner = "u1";
  vi.spyOn(console, "log").mockImplementation(() => {});
});

const eventsOf = (applicationId: string) =>
  db.select().from(applicationEvents).where(eq(applicationEvents.applicationId, applicationId));

describe("Tracker v2: adding a job", () => {
  it("writes the job and its first history line together; an applied job gets its sending date", async () => {
    const row = await createApplication({ company: "Acme", role: "Data Analyst", url: "https://boards.greenhouse.io/acme/jobs/123" });
    expect(row.duplicate).toBe(false);
    expect(row.source).toBe("manual");
    expect(row.urlKey).toBe("boards.greenhouse.io/acme/jobs/123");
    expect(row.submittedAt).toBeTypeOf("number");
    const events = await eventsOf(row.id);
    expect(events.map((e) => [e.kind, e.fromStatus, e.toStatus, e.ownerId])).toEqual([["created", null, "applied", "u1"]]);
  });

  it("the same job saved again, under another form of its link, opens the job that exists", async () => {
    const first = await createApplication({ company: "Acme", role: "Data Analyst", url: "https://www.acme.com/careers/42/?utm_source=x&b=2&a=1" });
    const again = await createApplication({ company: "Acme Inc", role: "Analyst", url: "http://ACME.com/careers/42?a=1&b=2#apply" });
    expect(again.duplicate).toBe(true);
    expect(again.id).toBe(first.id);
    expect((await db.select().from(applications)).length).toBe(1);
    expect((await eventsOf(first.id)).length).toBe(1);
  });

  it("another owner can save the same link: duplicates are per owner", async () => {
    await createApplication({ company: "Acme", role: "PM", url: "https://acme.com/jobs/1" });
    holder.owner = "u2";
    const theirs = await createApplication({ company: "Acme", role: "PM", url: "https://acme.com/jobs/1" });
    expect(theirs.duplicate).toBe(false);
    expect((await db.select().from(applications)).length).toBe(2);
  });

  it("keeps two jobs whose links differ only in the job id in the query (Indeed's ?jk=)", async () => {
    const a = await createApplication({ company: "A", role: "R", url: "https://ro.indeed.com/viewjob?jk=111" });
    const b = await createApplication({ company: "B", role: "R", url: "https://ro.indeed.com/viewjob?jk=222" });
    expect(a.duplicate || b.duplicate).toBe(false);
    expect((await db.select().from(applications)).length).toBe(2);
  });

  it("refuses a link that isn't http(s), and keeps nothing", async () => {
    await expect(createApplication({ company: "Acme", role: "PM", url: "javascript:alert(1)" })).rejects.toThrow(/http/);
    await expect(createApplication({ company: "Acme", role: "PM", url: "https://user:pass@acme.com/jobs/1" })).rejects.toThrow(/http/);
    expect((await db.select().from(applications)).length).toBe(0);
    expect((await db.select().from(applicationEvents)).length).toBe(0);
  });

  it("refuses empty or too long fields, and a status we don't have", async () => {
    await expect(createApplication({ company: "  ", role: "PM" })).rejects.toThrow(/required/);
    await expect(createApplication({ company: "A".repeat(121), role: "PM" })).rejects.toThrow(/1–120/);
    await expect(createApplication({ company: "Acme", role: "PM", status: "hired" as never })).rejects.toThrow("Invalid status");
    expect((await db.select().from(applications)).length).toBe(0);
  });

  it("needs a signed-in owner", async () => {
    holder.owner = null;
    await expect(createApplication({ company: "Acme", role: "PM" })).rejects.toThrow("Not authenticated");
    expect(await listMyApplications()).toEqual([]);
  });
});

describe("Tracker v2: changing the status", () => {
  it("writes each change to the history, and the same status again writes nothing", async () => {
    const row = await createApplication({ company: "Acme", role: "PM" });
    await updateStatus(row.id, "interview");
    await updateStatus(row.id, "interview");
    await updateStatus(row.id, "rejected");
    const events = await eventsOf(row.id);
    expect(events.map((e) => [e.kind, e.fromStatus, e.toStatus])).toEqual([
      ["created", null, "applied"],
      ["status_changed", "applied", "interview"],
      ["status_changed", "interview", "rejected"],
    ]);
    // a rejection after an interview still counts as an interview: the history keeps it
    expect(events.some((e) => e.toStatus === "interview")).toBe(true);
  });

  it("sets the sending date the first time a job moves to applied, and never moves it after", async () => {
    const row = await createApplication({ company: "Acme", role: "PM", status: "saved" });
    expect(row.submittedAt).toBeNull();
    const applied = await updateStatus(row.id, "applied");
    expect(applied.submittedAt).toBeTypeOf("number");
    await updateStatus(row.id, "offer");
    const back = await updateStatus(row.id, "applied");
    expect(back.submittedAt).toBe(applied.submittedAt);
  });

  it("another owner can neither change a job nor write to its history", async () => {
    const row = await createApplication({ company: "Acme", role: "PM" });
    holder.owner = "u2";
    await expect(updateStatus(row.id, "offer")).rejects.toThrow("Not found");
    await expect(removeApplication(row.id)).rejects.toThrow("Not found");
    const [still] = await db.select().from(applications).where(eq(applications.id, row.id));
    expect(still.status).toBe("applied");
    expect((await eventsOf(row.id)).length).toBe(1);
  });
});

describe("Tracker v2: deleting", () => {
  it("deleting a job deletes its history, and nobody else's", async () => {
    const mine = await createApplication({ company: "Acme", role: "PM" });
    await updateStatus(mine.id, "interview");
    holder.owner = "u2";
    const theirs = await createApplication({ company: "Globex", role: "PM" });
    holder.owner = "u1";
    await removeApplication(mine.id);
    expect((await eventsOf(mine.id)).length).toBe(0);
    expect((await eventsOf(theirs.id)).length).toBe(1);
  });

  it("deleting the account leaves no job and no history line of that owner", async () => {
    await db.insert(users).values({ clerkId: "u1", email: "u1@x.dev" });
    const mine = await createApplication({ company: "Acme", role: "PM" });
    await updateStatus(mine.id, "offer");
    holder.owner = "u2";
    await createApplication({ company: "Globex", role: "PM" });
    holder.owner = "u1";
    await deleteAccount();
    expect(await db.select().from(applications).where(eq(applications.ownerId, "u1"))).toEqual([]);
    expect(await db.select().from(applicationEvents).where(eq(applicationEvents.ownerId, "u1"))).toEqual([]);
    expect((await db.select().from(applicationEvents)).length).toBe(1);
  });
});

describe("Tracker v2: the screen's actions", () => {
  it("a saved job has no sending date until it moves to applied", async () => {
    const row = await createApplication({ company: "Altamira", role: "Data Analyst", status: "saved", description: "SQL, Python", location: "Bucharest" });
    expect(row.status).toBe("saved");
    expect(row.submittedAt).toBeNull();
    expect(row.description).toBe("SQL, Python");
    const sent = await updateStatus(row.id, "applied");
    expect(sent.submittedAt).toBeTypeOf("number");
  });

  it("edits the details; a link that is another job of the owner is refused", async () => {
    const a = await createApplication({ company: "A", role: "R", url: "https://acme.com/jobs/1" });
    const b = await createApplication({ company: "B", role: "R" });
    const edited = await updateApplicationDetails(b.id, { notes: "Recruiter: Maria", role: "Senior R" });
    expect(edited.notes).toBe("Recruiter: Maria");
    expect(edited.role).toBe("Senior R");
    await expect(updateApplicationDetails(b.id, { url: "http://www.acme.com/jobs/1/" })).rejects.toThrow(/already another job/);
    await expect(updateApplicationDetails(b.id, { url: "javascript:alert(1)" })).rejects.toThrow(/http/);
    expect((await updateApplicationDetails(a.id, { url: "https://acme.com/jobs/1?utm_source=x" })).id).toBe(a.id);
    holder.owner = "u2";
    await expect(updateApplicationDetails(a.id, { notes: "mine now" })).rejects.toThrow("Not found");
  });

  it("archives and brings back, each written to the history", async () => {
    const row = await createApplication({ company: "Acme", role: "PM" });
    expect((await archiveApplication(row.id, "withdrawn")).archiveReason).toBe("withdrawn");
    expect((await unarchiveApplication(row.id)).archivedAt).toBeNull();
    expect((await listApplicationEvents(row.id)).map((e) => e.kind)).toEqual(["created", "archived", "unarchived"]);
  });

  it("answers Did you hear back: Interview moves it, Not yet asks again in 14 days, No reply archives it", async () => {
    const a = await createApplication({ company: "A", role: "R" });
    const b = await createApplication({ company: "B", role: "R" });
    const c = await createApplication({ company: "C", role: "R" });
    expect((await answerFollowUp(a.id, "interview")).status).toBe("interview");
    const snoozed = await answerFollowUp(b.id, "not_yet");
    expect(snoozed.followUpAt! - Date.now()).toBeGreaterThan(13.9 * 24 * 3600 * 1000);
    const archived = await answerFollowUp(c.id, "no_reply");
    expect(archived.archiveReason).toBe("no_response");
    const [listed] = (await listMyApplications()).filter((j) => j.id === a.id);
    expect(listed.reachedInterview).toBe(true);
  });

  it("keeps a rejection after an interview counted as an interview", async () => {
    const row = await createApplication({ company: "Acme", role: "PM" });
    await updateStatus(row.id, "interview");
    await updateStatus(row.id, "rejected");
    const [listed] = await listMyApplications();
    expect(listed.status).toBe("rejected");
    expect(listed.reachedInterview).toBe(true);
  });

  it("What did you send: one of the owner's CVs with its version, or another file; never another owner's CV", async () => {
    const [mine] = await db.insert(cvs).values({ ownerId: "u1", title: "Base", data: emptyCvData() }).returning();
    const [theirs] = await db.insert(cvs).values({ ownerId: "u2", title: "Theirs", data: emptyCvData() }).returning();
    const row = await createApplication({ company: "Acme", role: "PM" });
    const sent = await setCvSent(row.id, { cvId: mine.id });
    expect(sent.cvId).toBe(mine.id);
    expect(sent.cvHash).toMatch(/^[0-9a-f]{64}$/);
    await expect(setCvSent(row.id, { cvId: theirs.id })).rejects.toThrow("Not found");
    expect((await setCvSent(row.id, { other: true })).cvId).toBe("other");
  });

  it("the history of a job is its owner's only", async () => {
    const row = await createApplication({ company: "Acme", role: "PM" });
    holder.owner = "u2";
    expect(await listApplicationEvents(row.id)).toEqual([]);
  });
});

describe("Tracker v2: the migration", () => {
  it("gives v1 rows a sending date (the day they were added) and leaves them otherwise as they were", async () => {
    // a database at v1 (migrations 0000–0001), with a v1 row, then the v2 migration on top
    const folder = await mkdtemp(path.join(os.tmpdir(), "drizzle-v1-"));
    await cp("./drizzle", folder, { recursive: true });
    const journalPath = path.join(folder, "meta", "_journal.json");
    const journal = JSON.parse(await readFile(journalPath, "utf8"));
    journal.entries = journal.entries.filter((e: { tag: string }) => !e.tag.startsWith("0002_"));
    await writeFile(journalPath, JSON.stringify(journal));

    const client = new PGlite();
    const v1 = drizzle(client, { schema });
    await migrate(v1, { migrationsFolder: folder });
    await v1.execute(sql`INSERT INTO applications (id, owner_id, company, role, status, applied_at)
                         VALUES ('old', 'u1', 'Acme', 'PM', 'interview', '2026-09-15T10:00:00Z')`);

    await migrate(v1, { migrationsFolder: "./drizzle" });
    const [row] = await v1.select().from(applications).where(eq(applications.id, "old"));
    expect(row.submittedAt?.toISOString()).toBe("2026-09-15T10:00:00.000Z");
    expect(row.status).toBe("interview");
    expect(row.urlKey).toBeNull();
  });
});
