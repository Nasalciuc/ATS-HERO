// "Ready to send", the service: the real migrations (PGlite), a fake agent-browser that answers like a
// Greenhouse-style form, a fake PDF. Only the owner's Saved jobs on ATSs the agent may go to are
// queued; nothing is sent without the approval of the form shown and the person's answers; the daily
// limit holds, even for two sends at once; a closed form waits again; answers are never stored.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { makeTestDb } from "./setup";
import { applicationEvents, applications, applyQueue, cvs } from "@/db/schema";
import type { CvData } from "@/lib/types";
import type { Answers } from "@/lib/apply/plan";
import type { Runner, RunnerOptions } from "@/lib/apply/runner";

const holder = vi.hoisted(() => ({ db: null as unknown, owner: null as string | null }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@/app/actions/_shared", () => ({ getOwnerId: async () => holder.owner }));

import {
  cancel, dequeue, enqueue, prepare, QueueError, queueView, review, screenshotPath, send, sentToday, setDailyLimit,
  type QueueDeps,
} from "@/lib/apply/queue";
import { clearForms, getForm, READY_MS } from "@/lib/apply/sessions";
import { getMyQueue } from "@/app/actions/apply-queue";
import { removeApplication } from "@/app/actions/applications";

const ana = (JSON.parse(fs.readFileSync(path.join(process.cwd(), "../../tools/ats-lab/fixtures/personas.json"), "utf8")) as Record<string, CvData>).ana;

const FORM = `
- textbox "First Name *" [required, ref=e1]
- textbox "Last Name *" [required, ref=e2]
- textbox "Email *" [required, ref=e3]
- button "Resume/CV *" [ref=e4]: No file chosen
- combobox "Will you now or in the future require visa sponsorship? *" [expanded=false, required, ref=e5]: Select…
  - option "Select…" [selected, ref=e9]
  - option "Yes" [ref=e10]
  - option "No" [ref=e11]
- checkbox "I agree to the privacy notice" [checked=false, required, ref=e7]
- button "Submit application" [ref=e8]
`;
const ANSWERED = FORM.replace("ref=e5]: Select…", "ref=e5]: No").replace("checked=false, required, ref=e7", "checked=true, required, ref=e7");
const CAPTCHA = `- Iframe "reCAPTCHA challenge" [ref=e1]\n${FORM}`;

/**
 * A fake agent-browser per session: answers like the form, writes screenshots, records commands.
 * `afterClick`: the page after Submit; `onOpen`: runs when the agent opens the posting.
 */
function fakeBrowser(first = FORM, opts: { afterClick?: string; onOpen?: () => Promise<unknown> } = {}) {
  const log: { session: string; args: string[] }[] = [];
  const runner = (session: string, _o: RunnerOptions): Runner => {
    let clicked = false;
    let snapshots = 0;
    const one = (args: string[]): Record<string, unknown> => {
      log.push({ session, args });
      const cmd = args.find((a) => !a.startsWith("--")) ?? "";
      if (cmd === "snapshot") return { snapshot: clicked ? (opts.afterClick ?? "") : snapshots++ === 0 ? first : ANSWERED };
      if (cmd === "get") return { text: clicked ? "Data Analyst\nThank you for applying! We'll be in touch." : "Data Analyst" };
      if (cmd === "eval") return { result: true };
      if (cmd === "screenshot") fs.writeFileSync(args[1], "png");
      if (cmd === "click" && args.includes("@e8")) clicked = true;
      return {};
    };
    return {
      run: async (a) => {
        if (a[0] === "open") await opts.onOpen?.();
        return one(a);
      },
      batch: async (cmds) => cmds.map(one),
    };
  };
  const clicks = () => log.filter((l) => l.args[0] === "click").length;
  const closes = () => log.filter((l) => l.args[0] === "close").length;
  return { runner, log, clicks, closes };
}

let db: Awaited<ReturnType<typeof makeTestDb>>;
let now: Date;
let browser: ReturnType<typeof fakeBrowser>;
const deps = (): QueueDeps => ({
  runner: browser.runner, renderPdf: async () => new Uint8Array([37, 80, 68, 70]), now: () => now, allowLocal: true,
});

beforeEach(async () => {
  db = await makeTestDb();
  holder.db = db;
  holder.owner = "u1";
  now = new Date("2026-11-04T10:00:00Z");
  browser = fakeBrowser();
  clearForms();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

async function cvOf(ownerId: string) {
  const [cv] = await db.insert(cvs).values({ ownerId, title: "Base", data: ana }).returning();
  return cv;
}
async function saved(ownerId: string, url: string | null, company = "Acme") {
  const [a] = await db.insert(applications).values({ ownerId, company, role: "Data Analyst", url, status: "saved" }).returning();
  return a;
}
const rowOf = async (applicationId: string) => (await db.select().from(applyQueue).where(eq(applyQueue.applicationId, applicationId)))[0];

/** The answers a person gives on the review screen: no sponsorship, consent given. */
function answersFor(items: { id: string; kind: string }[]): Answers {
  const out: Answers = {};
  for (const i of items) out[i.id] = i.kind === "checkbox" ? true : "No";
  return out;
}

async function readyJob(ownerId = "u1", url = "https://boards.greenhouse.io/acme/jobs/1", company = "Acme") {
  const job = await saved(ownerId, url, company);
  expect(await enqueue(ownerId, [job.id], null, deps())).toBe(1);
  const row = await rowOf(job.id);
  expect(await prepare(ownerId, row.id, deps())).toBe("ready");
  return { job, row };
}

describe("queueing", () => {
  it("offers only Saved jobs the agent may go to, and counts the rest", async () => {
    await cvOf("u1");
    await saved("u1", "https://boards.greenhouse.io/acme/jobs/1", "Greenhouse Co");
    await saved("u1", "https://jobs.lever.co/acme/2", "Lever Co");
    await saved("u1", "https://acme.wd3.myworkdayjobs.com/x/job/3", "Workday Co");
    await saved("u1", "https://www.linkedin.com/jobs/view/4", "LinkedIn Co");
    await saved("u1", null, "No link Co");
    await saved("u2", "https://jobs.ashbyhq.com/other/5", "Not mine");
    const v = await queueView("u1", deps());
    expect(v.candidates.map((c) => c.company).sort()).toEqual(["Greenhouse Co", "Lever Co"]);
    expect(v.notForAgent).toBe(3);
    expect(v).toMatchObject({ rows: [], sentToday: 0, dailyLimit: 5 });
  });

  it("needs one of the person's CVs, and queues only their own agent jobs, once", async () => {
    const mine = await saved("u1", "https://boards.greenhouse.io/acme/jobs/1");
    const workday = await saved("u1", "https://acme.wd3.myworkdayjobs.com/x/job/3");
    const theirs = await saved("u2", "https://boards.greenhouse.io/acme/jobs/9");
    await expect(enqueue("u1", [mine.id], null, deps())).rejects.toBeInstanceOf(QueueError);
    const other = await cvOf("u2");
    await expect(enqueue("u1", [mine.id], other.id, deps())).rejects.toBeInstanceOf(QueueError);
    await cvOf("u1");
    expect(await enqueue("u1", [mine.id, workday.id, theirs.id], null, deps())).toBe(1);
    expect(await enqueue("u1", [mine.id], null, deps())).toBe(0);
    expect(await db.select().from(applyQueue)).toHaveLength(1);
  });
});

describe("preparing and checking", () => {
  it("fills the form and keeps it open for the person, with what's theirs to answer", async () => {
    await cvOf("u1");
    const { row } = await readyJob();
    const r = await review("u1", row.id, deps());
    expect(r).not.toBeNull();
    expect(r?.filled).toEqual(expect.arrayContaining([{ label: "Email", value: ana.personalInfo.email }]));
    expect(r?.items.map((i) => i.label)).toEqual(["Will you now or in the future require visa sponsorship?", "I agree to the privacy notice"]);
    expect(r?.items[0].sensitive).toBe(true);
    expect(r?.resume).toEqual({ label: expect.any(String), attached: true });
    expect(r?.readyUntil).toBe(now.getTime() + READY_MS);
    expect(await screenshotPath("u1", row.id, now.getTime())).toMatch(/\.png$/);
    expect(browser.clicks()).toBe(0);
    // another owner sees nothing
    expect(await review("u2", row.id, deps())).toBeNull();
    expect(await screenshotPath("u2", row.id, now.getTime())).toBeNull();
  });

  it("a CAPTCHA hands the job to the person, nothing filled stays open", async () => {
    await cvOf("u1");
    browser = fakeBrowser(CAPTCHA);
    const job = await saved("u1", "https://boards.greenhouse.io/acme/jobs/1");
    await enqueue("u1", [job.id], null, deps());
    const row = await rowOf(job.id);
    expect(await prepare("u1", row.id, deps())).toBe("handoff");
    expect(await rowOf(job.id)).toMatchObject({ status: "handoff", reason: "captcha", readyUntil: null });
    expect(await review("u1", row.id, deps())).toBeNull();
  });

  it("a form left past its time closes and the job waits again", async () => {
    await cvOf("u1");
    const { job, row } = await readyJob();
    now = new Date(now.getTime() + READY_MS + 1);
    expect(await review("u1", row.id, deps())).toBeNull();
    expect(await rowOf(job.id)).toMatchObject({ status: "waiting", reason: "expired" });
    expect(browser.closes()).toBeGreaterThan(0);
  });

  it("Cancel and Remove close the form and send nothing", async () => {
    await cvOf("u1");
    const a = await readyJob("u1", "https://boards.greenhouse.io/acme/jobs/1", "A");
    await cancel("u1", a.row.id);
    expect(await rowOf(a.job.id)).toMatchObject({ status: "waiting" });
    const b = await readyJob("u1", "https://boards.greenhouse.io/acme/jobs/2", "B");
    await dequeue("u1", b.row.id);
    expect(await rowOf(b.job.id)).toBeUndefined();
    expect(browser.clicks()).toBe(0);
    expect(browser.closes()).toBe(2);
  });

  it("keeps the CV file while the form is open (a board may read it only at Send), and drops it with the form", async () => {
    await cvOf("u1");
    const { row } = await readyJob();
    const upload = browser.log.find((l) => l.args[0] === "upload");
    const pdf = upload?.args.at(-1) as string;
    expect(pdf).toMatch(/Ana_Popescu_CV\.pdf$/);
    expect(fs.existsSync(pdf)).toBe(true);
    await cancel("u1", row.id);
    expect(fs.existsSync(pdf)).toBe(false);
  });

  it("fills one form at a time for a person", async () => {
    await cvOf("u1");
    const a = await saved("u1", "https://boards.greenhouse.io/acme/jobs/1", "A");
    const b = await saved("u1", "https://boards.greenhouse.io/acme/jobs/2", "B");
    await enqueue("u1", [a.id, b.id], null, deps());
    const outcomes = await Promise.allSettled([prepare("u1", (await rowOf(a.id)).id, deps()), prepare("u1", (await rowOf(b.id)).id, deps())]);
    expect(outcomes.filter((o) => o.status === "fulfilled").map((o) => o.value)).toEqual(["ready"]);
    expect(outcomes.find((o) => o.status === "rejected")?.reason).toMatchObject({ message: expect.stringMatching(/filling another form/) });
  });

  it("a form filled for a job taken out of the queue meanwhile closes, with its CV", async () => {
    await cvOf("u1");
    const job = await saved("u1", "https://boards.greenhouse.io/acme/jobs/1");
    await enqueue("u1", [job.id], null, deps());
    const row = await rowOf(job.id);
    browser = fakeBrowser(FORM, { onOpen: () => dequeue("u1", row.id) });
    expect(await prepare("u1", row.id, deps())).toBe("waiting");
    expect(await getForm(row.id, "u1", now.getTime())).toBeNull();
    const pdf = browser.log.find((l) => l.args[0] === "upload")?.args.at(-1) as string;
    expect(fs.existsSync(pdf)).toBe(false);
    expect(browser.closes()).toBe(1);
  });

  it("doesn't prepare a job that left Saved after it was queued", async () => {
    await cvOf("u1");
    const job = await saved("u1", "https://boards.greenhouse.io/acme/jobs/1");
    await enqueue("u1", [job.id], null, deps());
    await db.update(applications).set({ status: "applied" }).where(eq(applications.id, job.id));
    expect(await prepare("u1", (await rowOf(job.id)).id, deps())).toBe("refused");
    expect(await rowOf(job.id)).toMatchObject({ status: "refused", reason: "not_saved" });
    expect(browser.log).toHaveLength(0);
  });

  it("closes a form past its time even if its owner never comes back", async () => {
    await cvOf("u1");
    await readyJob();
    const pdf = browser.log.find((l) => l.args[0] === "upload")?.args.at(-1) as string;
    now = new Date(now.getTime() + READY_MS + 1);
    await queueView("u2", deps()); // someone else's visit
    expect(browser.closes()).toBe(1);
    expect(fs.existsSync(pdf)).toBe(false);
  });
});

describe("sending", () => {
  it("sends on the approval of the form shown, moves the job to Applied with the CV, keeps no answer", async () => {
    const cv = await cvOf("u1");
    const { job, row } = await readyJob();
    const r = await review("u1", row.id, deps());
    const outcome = await send("u1", row.id, { digest: r!.digest, answers: answersFor(r!.items) }, deps());
    expect(outcome).toEqual({ status: "sent", confirmation: expect.stringMatching(/thank you for applying/i) });
    expect(await rowOf(job.id)).toMatchObject({ status: "sent", sentAt: now, readyUntil: null });
    const [after] = await db.select().from(applications).where(eq(applications.id, job.id));
    expect(after).toMatchObject({ status: "applied", appliedVia: "agent", cvId: cv.id, submittedAt: now });
    const events = await db.select().from(applicationEvents).where(eq(applicationEvents.applicationId, job.id));
    expect(events.map((e) => [e.kind, e.toStatus])).toEqual([["status_changed", "applied"], ["cv_sent", null]]);
    expect(await sentToday("u1", now)).toBe(1);
    // nothing the person answered is in the database
    const dump = JSON.stringify(await db.select().from(applyQueue)) + JSON.stringify(await db.select().from(applicationEvents));
    expect(dump).not.toMatch(/sponsorship|"No"/);
  });

  it("an item not gone through sends nothing and keeps the form open", async () => {
    await cvOf("u1");
    const { job, row } = await readyJob();
    const r = await review("u1", row.id, deps());
    const outcome = await send("u1", row.id, { digest: r!.digest, answers: {} }, deps());
    expect(outcome).toMatchObject({ status: "missing" });
    expect(await rowOf(job.id)).toMatchObject({ status: "ready", sendingAt: null });
    expect(browser.clicks()).toBe(0);
    expect(await sentToday("u1", now)).toBe(0);
  });

  it("an approval for another form sends nothing and doesn't count", async () => {
    await cvOf("u1");
    const { job, row } = await readyJob();
    const r = await review("u1", row.id, deps());
    expect(await send("u1", row.id, { digest: "0".repeat(32), answers: answersFor(r!.items) }, deps())).toEqual({ status: "closed" });
    expect(browser.clicks()).toBe(0);
    expect(await rowOf(job.id)).toMatchObject({ status: "failed", sendingAt: null });
    expect(await sentToday("u1", now)).toBe(0);
  });

  it("a challenge after the click counts as sent, and the job isn't prepared again", async () => {
    await cvOf("u1");
    browser = fakeBrowser(FORM, { afterClick: CAPTCHA });
    const { job, row } = await readyJob();
    const r = await review("u1", row.id, deps());
    expect(await send("u1", row.id, { digest: r!.digest, answers: answersFor(r!.items) }, deps())).toEqual({ status: "unconfirmed", reason: "captcha" });
    expect(await rowOf(job.id)).toMatchObject({ status: "unconfirmed", reason: "captcha" });
    expect(await sentToday("u1", now)).toBe(1);
    await expect(prepare("u1", row.id, deps())).rejects.toThrow(/already prepared or sent/);
  });

  it("another owner can't send someone's form", async () => {
    await cvOf("u1");
    const { row } = await readyJob();
    const r = await review("u1", row.id, deps());
    await expect(send("u2", row.id, { digest: r!.digest, answers: answersFor(r!.items) }, deps())).rejects.toBeInstanceOf(QueueError);
    expect(browser.clicks()).toBe(0);
  });
});

describe("the daily limit", () => {
  it("stops preparing and sending at the limit the person set", async () => {
    await cvOf("u1");
    await setDailyLimit("u1", 1);
    await expect(setDailyLimit("u1", 11)).rejects.toBeInstanceOf(QueueError);
    const a = await readyJob("u1", "https://boards.greenhouse.io/acme/jobs/1", "A");
    const b = await readyJob("u1", "https://boards.greenhouse.io/acme/jobs/2", "B");
    const ra = await review("u1", a.row.id, deps());
    const rb = await review("u1", b.row.id, deps());
    expect((await send("u1", a.row.id, { digest: ra!.digest, answers: answersFor(ra!.items) }, deps())).status).toBe("sent");
    expect(await send("u1", b.row.id, { digest: rb!.digest, answers: answersFor(rb!.items) }, deps())).toEqual({ status: "limit", sent: 1, limit: 1 });
    expect(await rowOf(b.job.id)).toMatchObject({ status: "ready" });
    const c = await saved("u1", "https://boards.greenhouse.io/acme/jobs/3", "C");
    await enqueue("u1", [c.id], null, deps());
    await expect(prepare("u1", (await rowOf(c.id)).id, deps())).rejects.toThrow(/1 of 1 today/);
    expect(browser.clicks()).toBe(1);
  });

  it("taking a sent job out of the queue, or deleting it, doesn't give the day's send back", async () => {
    await cvOf("u1");
    await setDailyLimit("u1", 1);
    const a = await readyJob("u1", "https://boards.greenhouse.io/acme/jobs/1", "A");
    const ra = await review("u1", a.row.id, deps());
    expect((await send("u1", a.row.id, { digest: ra!.digest, answers: answersFor(ra!.items) }, deps())).status).toBe("sent");
    await dequeue("u1", a.row.id);
    expect(await sentToday("u1", now)).toBe(1);
    await removeApplication(a.job.id);
    expect(await sentToday("u1", now)).toBe(1);
    const b = await saved("u1", "https://boards.greenhouse.io/acme/jobs/2", "B");
    await enqueue("u1", [b.id], null, deps());
    await expect(prepare("u1", (await rowOf(b.id)).id, deps())).rejects.toThrow(/1 of 1 today/);
  });

  it("two sends at once can't both pass the limit", async () => {
    await cvOf("u1");
    await setDailyLimit("u1", 1);
    const a = await readyJob("u1", "https://boards.greenhouse.io/acme/jobs/1", "A");
    const b = await readyJob("u1", "https://boards.greenhouse.io/acme/jobs/2", "B");
    const ra = await review("u1", a.row.id, deps());
    const rb = await review("u1", b.row.id, deps());
    const outcomes = await Promise.all([
      send("u1", a.row.id, { digest: ra!.digest, answers: answersFor(ra!.items) }, deps()),
      send("u1", b.row.id, { digest: rb!.digest, answers: answersFor(rb!.items) }, deps()),
    ]);
    expect(outcomes.map((o) => o.status).sort()).toEqual(["limit", "sent"]);
    expect(browser.clicks()).toBe(1);
  });

  it("tomorrow starts again", async () => {
    await cvOf("u1");
    await setDailyLimit("u1", 1);
    const a = await readyJob("u1", "https://boards.greenhouse.io/acme/jobs/1", "A");
    const ra = await review("u1", a.row.id, deps());
    await send("u1", a.row.id, { digest: ra!.digest, answers: answersFor(ra!.items) }, deps());
    now = new Date("2026-11-05T08:00:00Z");
    expect(await sentToday("u1", now)).toBe(0);
    const b = await readyJob("u1", "https://boards.greenhouse.io/acme/jobs/2", "B");
    expect(b.row).toBeDefined();
  });
});

describe("the actions", () => {
  it("are off unless switched on, and need a signed-in person", async () => {
    vi.stubEnv("NEXT_PUBLIC_APPLY_AGENT_ENABLED", "false");
    expect(await getMyQueue()).toEqual({ ok: false, message: "The apply agent isn’t available yet." });
    vi.stubEnv("NEXT_PUBLIC_APPLY_AGENT_ENABLED", "true");
    holder.owner = null;
    expect(await getMyQueue()).toEqual({ ok: false, message: "Sign in to use the apply agent." });
    holder.owner = "u1";
    expect(await getMyQueue()).toMatchObject({ ok: true, view: { rows: [], dailyLimit: 5 } });
  });
});
