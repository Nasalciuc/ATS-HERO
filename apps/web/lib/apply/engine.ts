/**
 * The apply agent's engine (APLICARE-CU-AGENT.md §4): open the posting, read the form, fill what the
 * plan allows, attach the CV, and stop. Only the person's approval, for this application and the
 * form they saw, sends it.
 *
 *   prepareApplication → "ready" (screenshot of the filled form, the items for the person)
 *                      | "refused" (LinkedIn, Workday, an unknown site: no browser was started)
 *                      | "handoff" (a CAPTCHA, an e-mailed code, a login, a field the agent can't
 *                        set: the browser closes and the person continues from the posting's link)
 *   submitApplication  → "blocked" (an item not gone through, or a new question: nothing was clicked)
 *                      | "sent" | "unconfirmed" | "handoff"
 *
 * What the engine never does (§5): press Submit without `confirmedByPerson` for this session and
 * this plan; answer a question itself; get past a CAPTCHA, a code or a login; leave the posting's
 * domains; read the posting's text for instructions (only the controls' own labels feed the plan).
 *
 * No route calls this yet: it runs in the apply lab only (tests/apply-lab), like the job search
 * engine in apps/ai before its screen.
 */
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { controlsOf, parseTree, type SnapshotNode } from "./snapshot";
import { cleanLabel, itemKey, missingAnswers, planApplication, type Answers, type ApplyPlan, type PersonItem, type PlanOptions } from "./plan";
import { postingTarget, type Refusal } from "./guard";
import type { ApplyProfile } from "./profile";
import { cliRunner, type Runner, type RunnerOptions } from "./runner";

export type Handoff = "captcha" | "email_code" | "login" | "no_form" | "unsupported_field";

// Read from the names of these nodes only, never from the posting's text: a job description that
// says "security check" doesn't stop the agent, and one can't hide a challenge in a paragraph. A
// posting's heading can still say it ("Background and security check"), so the phrase isn't one.
const BLOCKER_ROLES = new Set(["Iframe", "iframe", "dialog", "alertdialog", "heading", "checkbox", "button", "textbox"]);

// A challenge the person must pass. Greenhouse's invisible reCAPTCHA shows only a badge (an iframe
// named "reCAPTCHA") and is not one of these; its challenge frame is.
const BLOCKERS: [Handoff, RegExp][] = [
  ["captcha", /recaptcha challenge|hcaptcha|h-captcha|cloudflare security challenge|turnstile|i'?m not a robot|i am human|verify (that )?you(?:'re| are) (a )?human|human verification/i],
  ["email_code", /verification code|enter the code|one[- ]time (code|password)|code (we|that we) (sent|e-?mailed)|^(security |confirmation |access )?code$|check your (e-?mail|inbox)|verify your e-?mail/i],
  ["login", /sign in to apply|log ?in to apply|create an account to apply|log ?in to continue|sign in to continue/i],
];
const PASSWORD = /password|parol[ăa]|пароль/i;

const SENT = /thank you for (applying|your application)|application (has been |was )?(received|submitted|sent)|we('ve| have) received your application|mul[țtţ]umim pentru aplicare|спасибо за (отклик|заявку)/i;

/** What stops the agent on a page: a challenge, a code, a login. From a snapshot. */
export function blockerIn(snapshot: string): Handoff | null {
  const named: { role: string; name: string }[] = [];
  const walk = (n: SnapshotNode) => {
    if (BLOCKER_ROLES.has(n.role) && n.name) named.push({ role: n.role, name: n.name });
    n.children.forEach(walk);
  };
  parseTree(snapshot).forEach(walk);
  for (const [reason, re] of BLOCKERS) if (named.some((n) => re.test(n.name))) return reason;
  if (named.some((n) => n.role === "textbox" && PASSWORD.test(n.name))) return "login";
  return null;
}

/** The plan the person is shown, as the approval names it. */
export function planDigest(plan: ApplyPlan): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex").slice(0, 32);
}

export interface Session {
  name: string;
  /** the posting: where the person continues when the agent hands over */
  url: string;
  runner: Runner;
  /** where this application's screenshots are written */
  dir: string;
  profile: ApplyProfile;
  planOptions: PlanOptions;
  plan: ApplyPlan;
  digest: string;
  resumeAttached: boolean;
  state: "ready" | "sending" | "done";
}

export type Prepared =
  | { status: "refused"; reason: Refusal; host: string | null }
  | { status: "handoff"; reason: Handoff; url: string; screenshot: string }
  | { status: "ready"; session: Session; plan: ApplyPlan; digest: string; resumeAttached: boolean; screenshot: string };

export interface PrepareInput {
  url: string;
  profile: ApplyProfile;
  /** the chosen CV as a PDF, rendered by renderCvPdfBlob() (AGENTS.md rule 7) */
  cvPdfPath: string;
  /** localhost postings: the lab only */
  allowLocal?: boolean;
  plan?: PlanOptions;
  /** a runner for a session; the default runs the CLI on this machine */
  runner?: (session: string, opts: RunnerOptions) => Runner;
}

const snapshotOf = async (r: Runner) => String((await r.run(["--content-boundaries", "snapshot"])).snapshot ?? "");
const pageTextOf = async (r: Runner) => String((await r.run(["--content-boundaries", "get", "text", "body"])).text ?? "");

// Marks the CV's file input, so `upload` can name it: the file input is often hidden behind an
// "Attach" button, and agent-browser attaches files only to the input itself. An input is read by
// its own words only (its labels, its ARIA name, its name and id, the smallest block around it that
// holds no other field), so a heading over both inputs ("Resume and cover letter") decides nothing.
const MARK_RESUME_INPUT = `(() => {
  document.querySelectorAll('[data-ats-hero-resume]').forEach((el) => el.removeAttribute('data-ats-hero-resume'));
  const inputs = [...document.querySelectorAll('input[type=file]')];
  const text = (el) => ((el && el.textContent) || '').replace(/\\s+/g, ' ').trim();
  const own = (el) => {
    const parts = [...(el.labels || [])].map(text);
    parts.push(el.getAttribute('aria-label') || '');
    for (const id of (el.getAttribute('aria-labelledby') || '').split(/\\s+/).filter(Boolean)) parts.push(text(document.getElementById(id)));
    parts.push(el.name || '', el.id || '');
    let box = el.parentElement;
    for (let up = 0; box && up < 3; up++, box = box.parentElement) {
      if (box.querySelectorAll('input:not([type=hidden]), select, textarea').length > 1) break;
      const t = text(box);
      if (t) { parts.push(t.slice(0, 200)); break; }
    }
    return parts.join(' ');
  };
  const cv = /resume|\\bcv\\b|curriculum|résumé|резюме/i, cover = /cover|letter|scrisoare|сопроводит/i;
  const said = inputs.map(own);
  let i = said.findIndex((s) => cv.test(s) && !cover.test(s));
  if (i < 0 && inputs.length === 1 && !cover.test(said[0])) i = 0;
  if (i < 0) return false;
  inputs[i].setAttribute('data-ats-hero-resume', '');
  return true;
})()`;

async function close(r: Runner) {
  await r.run(["close"]).catch(() => undefined);
}

export async function prepareApplication(input: PrepareInput): Promise<Prepared> {
  const target = postingTarget(input.url, { allowLocal: input.allowLocal });
  if (!target.ok) return { status: "refused", reason: target.reason, host: target.host };

  const name = `apply-${randomUUID().slice(0, 8)}`;
  const runner = (input.runner ?? cliRunner)(name, { allowedDomains: target.allowedDomains });
  const dir = await mkdtemp(path.join(os.tmpdir(), "ats-hero-apply-"));
  const shot = async (file: string) => {
    const p = path.join(dir, file);
    await runner.run(["screenshot", p, "--full"]);
    return p;
  };
  const handoff = async (reason: Handoff, file: string): Promise<Prepared> => {
    const screenshot = await shot(file);
    await close(runner);
    return { status: "handoff", reason, url: target.url, screenshot };
  };

  try {
    await runner.run(["open", target.url]);
    const snapshot = await snapshotOf(runner);
    const blocker = blockerIn(snapshot);
    if (blocker) return await handoff(blocker, "0-blocked.png");

    const planOptions = input.plan ?? {};
    const plan = planApplication(controlsOf(snapshot), input.profile, planOptions);
    if (!plan.submit) return await handoff("no_form", "0-no-form.png");
    if (plan.person.some((p) => p.kind === "manual")) return await handoff("unsupported_field", "0-unsupported.png");

    // values from the CV go on stdin, never on a command line
    await runner.batch([...plan.fill.map((f) => ["fill", `@${f.ref}`, f.value]), ...plan.choose.map((c) => ["select", `@${c.ref}`, c.option])]);
    let resumeAttached = false;
    if (plan.resume && (await runner.run(["eval", MARK_RESUME_INPUT])).result === true) {
      await runner.batch([["upload", "[data-ats-hero-resume]", input.cvPdfPath]]);
      resumeAttached = true;
    }

    const screenshot = await shot("1-filled.png");
    const digest = planDigest(plan);
    const session: Session = { name, url: target.url, runner, dir, profile: input.profile, planOptions, plan, digest, resumeAttached, state: "ready" };
    return { status: "ready", session, plan, digest, resumeAttached, screenshot };
  } catch (e) {
    await close(runner);
    throw e;
  }
}

/** The person's decision on the screen that shows the filled form: for this session and this plan only. */
export interface Approval {
  confirmedByPerson: true;
  /** `Session.name` */
  session: string;
  /** `planDigest` of the plan the person was shown */
  digest: string;
  answers: Answers;
}

export type Submitted =
  | { status: "blocked"; reason: "missing"; missing: PersonItem[] }
  /** the form asked something new after the answers went in: the person sees this plan and approves again */
  | { status: "blocked"; reason: "changed"; missing: PersonItem[]; plan: ApplyPlan; digest: string }
  | { status: "handoff"; reason: Handoff; url: string; screenshot: string | null }
  | { status: "sent"; screenshot: string; confirmation: string; pageText: string }
  | { status: "unconfirmed"; screenshot: string | null; pageText: string; error?: string };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The commands that put the person's answers into the form, the "leave it empty" ones included. */
function answerCommands(plan: ApplyPlan, answers: Answers): string[][] {
  const out: string[][] = [];
  for (const item of plan.person) {
    const a = answers[item.id];
    const ref = `@${item.refs[0]}`;
    if (item.kind === "checkbox") out.push([a === true ? "check" : "uncheck", ref]);
    else if (typeof a !== "string") continue;
    else if (item.kind === "text") {
      if (a !== "" || item.current) out.push(["fill", ref, a]);
    } else if (item.kind === "choice") {
      const option = a === "" ? item.placeholder : item.options.find((o) => same(o, a));
      if (option && !(a === "" && item.current === null)) out.push(["select", ref, option]);
    } else if (item.kind === "radio" && a !== "") {
      const i = item.options.findIndex((o) => same(o, a));
      if (i >= 0 && !same(String(item.current ?? ""), a)) out.push(["click", `@${item.refs[i]}`]);
    }
  }
  return out;
}

/** Does the form now hold what the person said? */
function holds(item: PersonItem, a: string | boolean | undefined): boolean {
  if (item.kind === "checkbox") return item.current === (a === true);
  if (typeof a !== "string") return false;
  if (item.kind === "text") return a === "" ? !item.current : !!item.current;
  if (a === "") return item.current === null;
  return same(String(item.current ?? ""), a);
}

/** The form read again after the answers went in, against the plan the person approved. */
function compare(before: ApplyPlan, now: ApplyPlan, answers: Answers) {
  const pool = new Map<string, PersonItem[]>();
  for (const item of before.person) pool.set(itemKey(item), [...(pool.get(itemKey(item)) ?? []), item]);
  const added: PersonItem[] = [];
  const wrong: PersonItem[] = [];
  for (const item of now.person) {
    const was = pool.get(itemKey(item))?.shift();
    if (!was) added.push(item);
    else if (!holds(item, answers[was.id])) wrong.push(item);
  }
  return { added, wrong };
}

function newLines(before: string, after: string): string {
  const seen = new Set(before.split("\n").map((l) => l.trim()));
  return after
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !seen.has(l))
    .join("\n");
}

export async function submitApplication(session: Session, approval: Approval): Promise<Submitted> {
  if (approval?.confirmedByPerson !== true) throw new Error("An application is sent only on the person's approval");
  if (approval.session !== session.name || approval.digest !== session.digest)
    throw new Error("This approval is for another application, or for a form the person hasn't seen");
  if (session.state !== "ready") throw new Error(`This application is ${session.state === "sending" ? "being sent" : "closed"}`);
  const { runner, plan } = session;

  // Nothing is typed or clicked while an item isn't gone through: the session stays open for the person.
  const missing = missingAnswers(plan, approval.answers);
  if (missing.length) return { status: "blocked", reason: "missing", missing };

  session.state = "sending";
  const handoff = async (reason: Handoff): Promise<Submitted> => {
    const screenshot = path.join(session.dir, "2-handoff.png");
    const ok = await runner.run(["screenshot", screenshot, "--full"]).then(() => true, () => false);
    session.state = "done";
    await close(runner);
    return { status: "handoff", reason, url: session.url, screenshot: ok ? screenshot : null };
  };

  // Before the click: the answers go in, and the form is read again. An error here sends nothing.
  let submit: { ref: string; label: string };
  let before: string;
  try {
    await runner.batch(answerCommands(plan, approval.answers));
    const snapshot = await snapshotOf(runner);
    const blocker = blockerIn(snapshot);
    if (blocker) return await handoff(blocker);
    const now = planApplication(controlsOf(snapshot), session.profile, session.planOptions);
    const { added, wrong } = compare(plan, now, approval.answers);
    if (added.length) {
      // a question that depends on an answer: shown to the person, approved again
      session.plan = now;
      session.digest = planDigest(now);
      session.state = "ready";
      return { status: "blocked", reason: "changed", missing: added, plan: now, digest: session.digest };
    }
    // an answer the form didn't take, or no button left to press: the person finishes on their own
    if (wrong.length || !now.submit) return await handoff("unsupported_field");
    submit = now.submit;
    before = await pageTextOf(runner);
  } catch (e) {
    session.state = "done";
    await close(runner);
    throw e;
  }

  // The click. From here nothing throws: whatever happened is reported, as it happened.
  let screenshot: string | null = null;
  let pageText = "";
  try {
    await runner.run(["click", `@${submit.ref}`]);
    await runner.run(["wait", "1500"]);
    const after = await snapshotOf(runner);
    pageText = await pageTextOf(runner);
    const file = path.join(session.dir, "2-after-submit.png");
    await runner.run(["screenshot", file, "--full"]);
    screenshot = file;

    const blocker = blockerIn(after);
    if (blocker) return { status: "handoff", reason: blocker, url: session.url, screenshot };
    // what the page said after the click: the person's proof, kept with the screenshot
    const said = pageText.slice(0, 4000);
    // a confirmation counts only if it is new (not the posting's own words) and the form is gone
    const stillThere = controlsOf(after).some((c) => c.role === "button" && same(cleanLabel(c.name), submit.label));
    const sent = stillThere ? null : newLines(before, pageText).match(SENT);
    if (sent) return { status: "sent", screenshot, confirmation: sent[0], pageText: said };
    return { status: "unconfirmed", screenshot, pageText: said };
  } catch (e) {
    return { status: "unconfirmed", screenshot, pageText: pageText.slice(0, 4000), error: String((e as Error).message).slice(0, 300) };
  } finally {
    session.state = "done";
    await close(runner);
  }
}

/** The person said no, or left: the browser closes and nothing is sent. */
export async function abandonApplication(session: Session): Promise<void> {
  if (session.state === "sending") return; // the send in progress closes it
  session.state = "done";
  await close(session.runner);
}
