// "Ready to send" end to end: the queue (lib/apply/queue.ts) on the real migrations (PGlite), the real
// agent-browser on the lab's Greenhouse-style form, and Ana's CV rendered as the server renders it
// (renderCvPdfBlob, fonts from public/fonts). Never a real employer (AGENTS.md rule 11). Run with the
// rest of the apply lab: npm run apply-lab.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { makeTestDb } from "../db/setup";
import { applications, applyQueue, cvs } from "@/db/schema";
import type { CvData } from "@/lib/types";
import type { Answers, PersonItem } from "@/lib/apply/plan";
import { cliRunner, type RunnerOptions } from "@/lib/apply/runner";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

import { enqueue, prepare, QueueError, queueView, review, screenshotPath, send, sentToday, setDailyLimit, type QueueDeps } from "@/lib/apply/queue";
import { dropForm } from "@/lib/apply/sessions";

const FORMS = path.join(process.cwd(), "../../tools/apply-lab/forms");
const ana = (JSON.parse(fs.readFileSync(path.join(process.cwd(), "../../tools/ats-lab/fixtures/personas.json"), "utf8")) as Record<string, CvData>).ana;
const OWNER = "lab-owner";

let server: http.Server;
let base = "";
beforeAll(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(FORMS, path.basename(new URL(req.url ?? "/", "http://x").pathname));
    if (!file.startsWith(FORMS) || !fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": `${file.endsWith(".js") ? "text/javascript" : "text/html"}; charset=utf-8` }).end(fs.readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

let db: Awaited<ReturnType<typeof makeTestDb>>;
/** every page text agent-browser read: the employer's page after Send says what it received */
let texts: string[];
const opened: string[] = [];
const deps = (): QueueDeps => ({
  // the real CLI, recording what it read; the default renderPdf: renderCvPdfBlob, as on the server
  runner: (session: string, o: RunnerOptions) => {
    const real = cliRunner(session, o);
    const keep = (r: Record<string, unknown>) => (typeof r.text === "string" && texts.push(r.text), r);
    return { run: async (a) => keep(await real.run(a)), batch: async (c) => (await real.batch(c)).map(keep) };
  },
  allowLocal: true,
});

beforeEach(async () => {
  db = await makeTestDb();
  holder.db = db;
  texts = [];
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(async () => {
  await Promise.all(opened.splice(0).map((id) => dropForm(id)));
  vi.restoreAllMocks();
});

async function savedJob(form: string, company: string) {
  const [a] = await db.insert(applications).values({ ownerId: OWNER, company, role: "Data Analyst", url: `${base}/${form}`, status: "saved" }).returning();
  return a;
}
const rowOf = async (applicationId: string) => (await db.select().from(applyQueue).where(eq(applyQueue.applicationId, applicationId)))[0];

/** What Ana answers on "Check before sending", by label. */
function answersFor(items: PersonItem[], byLabel: Record<string, string>): Answers {
  const out: Answers = {};
  for (const i of items) {
    const key = Object.keys(byLabel).find((k) => i.label.toLowerCase().includes(k));
    if (key !== undefined) out[i.id] = byLabel[key];
  }
  return out;
}

function received(): Record<string, unknown> {
  const m = texts.join("\n").match(/RECEIVED (\{[\s\S]*?\}) END/);
  if (!m) throw new Error(`the page didn't say what it received: ${texts.at(-1)?.slice(0, 300)}`);
  return JSON.parse(m[1]);
}

describe("Ready to send, with the real browser", () => {
  it("queues, fills, waits for the person's answers, sends once, within the limit they set", async () => {
    const [cv] = await db.insert(cvs).values({ ownerId: OWNER, title: "Ana · Data", data: ana }).returning();
    const first = await savedJob("greenhouse.html", "Fintech Labs");
    const second = await savedJob("lever.html", "Northfield Group");
    expect((await queueView(OWNER, deps())).candidates.map((c) => c.company).sort()).toEqual(["Fintech Labs", "Northfield Group"]);
    await setDailyLimit(OWNER, 1);
    expect(await enqueue(OWNER, [first.id, second.id], cv.id, deps())).toBe(2);

    const row = await rowOf(first.id);
    expect(await prepare(OWNER, row.id, deps())).toBe("ready");
    opened.push(row.id);
    expect(fs.statSync((await screenshotPath(OWNER, row.id)) as string).size).toBeGreaterThan(10_000);

    const r = await review(OWNER, row.id, deps());
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.filled.map((f) => f.label)).toEqual(["First Name", "Last Name", "Email", "Phone", "LinkedIn Profile", "Website"]);
    expect(r.resume).toEqual({ label: expect.any(String), attached: true });
    expect(r.items.map((i) => i.label)).toContain("Will you now or in the future require visa sponsorship?");

    // half the answers: nothing is sent, nothing counts, the form stays open
    const some = answersFor(r.items, { "legally authorized": "Yes" });
    expect(await send(OWNER, row.id, { digest: r.digest, answers: some }, deps())).toMatchObject({ status: "missing" });
    expect(texts.join("\n")).not.toContain("RECEIVED");
    expect(await sentToday(OWNER, new Date())).toBe(0);

    // every item gone through: sent, and the page says what the employer got
    const all = answersFor(r.items, { "legally authorized": "Yes", sponsorship: "No", salary: "", "hear about": "Job board", gender: "" });
    expect(await send(OWNER, row.id, { digest: r.digest, answers: all }, deps())).toMatchObject({ status: "sent" });
    expect(received()).toMatchObject({
      first_name: "Ana", last_name: "Popescu", resume: "Ana_Popescu_CV.pdf", resume_starts: "%PDF-",
      work_auth: "Yes", sponsorship: "No", source: "Job board", salary: "", gender: "",
    });
    expect(await rowOf(first.id)).toMatchObject({ status: "sent" });
    expect((await db.select().from(applications).where(eq(applications.id, first.id)))[0]).toMatchObject({
      status: "applied", appliedVia: "agent", cvId: cv.id,
    });
    expect(await sentToday(OWNER, new Date())).toBe(1);

    // the limit Ana set: the second job waits for tomorrow, no browser opens
    await expect(prepare(OWNER, (await rowOf(second.id)).id, deps())).rejects.toBeInstanceOf(QueueError);
    expect(await rowOf(second.id)).toMatchObject({ status: "waiting" });
  }, 120_000);
});
