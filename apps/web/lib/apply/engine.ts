/**
 * The apply agent's engine (APLICARE-CU-AGENT.md §4): open the posting, read the form, fill what the
 * plan allows, attach the CV, and stop. Only the person's approval, for this application, sends it.
 *
 *   prepareApplication → "ready" (screenshot of the filled form, the questions for the person)
 *                      | "refused" (LinkedIn, Workday, an unknown site: no browser was started)
 *                      | "handoff" (CAPTCHA, an e-mailed code, a login: the person continues)
 *   submitApplication  → "blocked" (a required answer is missing: nothing was clicked)
 *                      | "sent" | "unconfirmed" | "handoff"
 *
 * What the engine never does (§5): press Submit without `confirmedByPerson`; answer a sensitive
 * question itself; get past a CAPTCHA, a code or a login; leave the posting's domains; read the
 * posting's text for instructions (only the form's labels feed the plan).
 *
 * No route calls this yet: it runs in the apply lab only (tests/apply-lab), like the job search
 * engine in apps/ai before its screen.
 */
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { controlsOf } from "./snapshot";
import { missingAnswers, planApplication, type Answers, type ApplyPlan, type PersonItem, type PlanOptions } from "./plan";
import { postingTarget, type Refusal } from "./guard";
import type { ApplyProfile } from "./profile";
import { cliRunner, type Runner } from "./runner";

export type Handoff = "captcha" | "email_code" | "login" | "no_form";

// A challenge the person must pass. Greenhouse's invisible reCAPTCHA shows only a badge ("protected
// by reCAPTCHA") and is not one of these; its challenge frame is.
const BLOCKERS: [Handoff, RegExp][] = [
  ["captcha", /recaptcha challenge|hcaptcha challenge|i'?m not a robot|verify (that )?you(?:'re| are) (a )?human|human verification|security check/i],
  ["email_code", /verification code|enter the code|code (we|that we) (sent|e-?mailed)/i],
  ["login", /sign in to apply|log in to apply|create an account to apply|login to continue/i],
];

const SENT = /thank you for (applying|your application)|application (has been |was )?(received|submitted|sent)|we('ve| have) received your application|mul[țtţ]umim pentru aplicare|спасибо за (отклик|заявку)/i;

export function blockerIn(pageText: string): Handoff | null {
  return BLOCKERS.find(([, re]) => re.test(pageText))?.[0] ?? null;
}

export interface Session {
  name: string;
  run: Runner;
  /** where this application's screenshots are written */
  dir: string;
  plan: ApplyPlan;
  resumeAttached: boolean;
}

export type Prepared =
  | { status: "refused"; reason: Refusal; host: string | null }
  | { status: "handoff"; reason: Handoff; screenshot: string }
  | { status: "ready"; session: Session; plan: ApplyPlan; resumeAttached: boolean; screenshot: string };

export interface PrepareInput {
  url: string;
  profile: ApplyProfile;
  /** the chosen CV as a PDF, rendered by renderCvPdfBlob() (AGENTS.md rule 7) */
  cvPdfPath: string;
  /** localhost postings: the lab only */
  allowLocal?: boolean;
  plan?: PlanOptions;
  /** a runner for a session name; the default runs the CLI on this machine */
  runner?: (session: string) => Runner;
}

const snapshotOf = async (run: Runner) => String((await run(["--content-boundaries", "snapshot"])).snapshot ?? "");
const textOf = async (run: Runner) => String((await run(["--content-boundaries", "get", "text", "body"])).text ?? "");

// Marks the CV's file input, so `upload` can name it: the file input is often hidden behind an
// "Attach" button, and agent-browser attaches files only to the input itself.
const MARK_RESUME_INPUT = `(() => {
  const inputs = [...document.querySelectorAll('input[type=file]')];
  const said = (el) => [el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')?.textContent,
    el.getAttribute('aria-label'), el.name, el.accept, el.closest('label,fieldset,li,section,div')?.textContent].filter(Boolean).join(' ');
  const cv = /resume|\\bcv\\b|curriculum|résumé|резюме/i, cover = /cover|letter|scrisoare|сопроводит/i;
  const pick = inputs.find((el) => cv.test(said(el)) && !cover.test(said(el))) || (inputs.length === 1 ? inputs[0] : null);
  if (!pick) return false;
  pick.setAttribute('data-ats-hero-resume', '');
  return true;
})()`;

async function close(run: Runner) {
  await run(["close"]).catch(() => undefined);
}

export async function prepareApplication(input: PrepareInput): Promise<Prepared> {
  const target = postingTarget(input.url, { allowLocal: input.allowLocal });
  if (!target.ok) return { status: "refused", reason: target.reason, host: target.host };

  const name = `apply-${randomUUID().slice(0, 8)}`;
  const run = (input.runner ?? cliRunner)(name);
  const dir = await mkdtemp(path.join(os.tmpdir(), "ats-hero-apply-"));
  const shot = async (file: string) => {
    const p = path.join(dir, file);
    await run(["screenshot", p, "--full"]);
    return p;
  };

  try {
    await run(["--allowed-domains", target.allowedDomains.join(","), "open", target.url]);
    const snapshot = await snapshotOf(run);
    const blocker = blockerIn(snapshot);
    if (blocker) {
      const screenshot = await shot("0-blocked.png");
      await close(run);
      return { status: "handoff", reason: blocker, screenshot };
    }

    const plan = planApplication(controlsOf(snapshot), input.profile, input.plan);
    if (!plan.submit) {
      const screenshot = await shot("0-no-form.png");
      await close(run);
      return { status: "handoff", reason: "no_form", screenshot };
    }

    for (const f of plan.fill) await run(["fill", `@${f.ref}`, f.value]);
    for (const c of plan.choose) await run(["select", `@${c.ref}`, c.option]);
    let resumeAttached = false;
    if (plan.resume && (await run(["eval", MARK_RESUME_INPUT])).result === true) {
      await run(["upload", "[data-ats-hero-resume]", input.cvPdfPath]);
      resumeAttached = true;
    }

    const screenshot = await shot("1-filled.png");
    const session: Session = { name, run, dir, plan, resumeAttached };
    return { status: "ready", session, plan, resumeAttached, screenshot };
  } catch (e) {
    await close(run);
    throw e;
  }
}

/** The person's decision on the screen that shows the filled form: for this application only. */
export interface Approval {
  confirmedByPerson: true;
  answers: Answers;
}

export type Submitted =
  | { status: "blocked"; missing: PersonItem[] }
  | { status: "handoff"; reason: Handoff; screenshot: string }
  | { status: "sent"; screenshot: string; confirmation: string }
  | { status: "unconfirmed"; screenshot: string; pageText: string };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function submitApplication(session: Session, approval: Approval): Promise<Submitted> {
  if (approval?.confirmedByPerson !== true) throw new Error("An application is sent only on the person's approval");
  const { run, plan } = session;
  if (!plan.submit) throw new Error("This form has no submit button");

  // Nothing is clicked while a required answer is missing: the session stays open for the person.
  const missing = missingAnswers(plan, approval.answers);
  if (missing.length) return { status: "blocked", missing };

  try {
    for (const item of plan.person) {
      const a = approval.answers[item.id];
      if (a === undefined || a === "") continue;
      if (item.kind === "text" && typeof a === "string") await run(["fill", `@${item.refs[0]}`, a]);
      else if (item.kind === "choice" && typeof a === "string") {
        const option = item.options.find((o) => same(o, a)) ?? a;
        await run(["select", `@${item.refs[0]}`, option]);
      } else if (item.kind === "radio" && typeof a === "string") {
        const i = item.options.findIndex((o) => same(o, a));
        if (i >= 0) await run(["click", `@${item.refs[i]}`]);
      } else if (item.kind === "checkbox" && a === true) await run(["check", `@${item.refs[0]}`]);
    }

    await run(["click", `@${plan.submit.ref}`]);
    await run(["wait", "1500"]);
    const pageText = await textOf(run);
    const screenshot = path.join(session.dir, "2-after-submit.png");
    await run(["screenshot", screenshot, "--full"]);

    const blocker = blockerIn(pageText);
    if (blocker) return { status: "handoff", reason: blocker, screenshot };
    const sent = pageText.match(SENT);
    if (sent) return { status: "sent", screenshot, confirmation: sent[0] };
    return { status: "unconfirmed", screenshot, pageText: pageText.slice(0, 4000) };
  } finally {
    await close(run);
  }
}

/** The person said no, or left: the browser closes and nothing is sent. */
export async function abandonApplication(session: Session): Promise<void> {
  await close(session.run);
}
