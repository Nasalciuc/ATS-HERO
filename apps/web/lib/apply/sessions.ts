/**
 * The forms the agent filled and keeps open for the person, by queue row. A live session is a
 * browser (agent-browser's named session) plus the plan the person is shown: it lives in this
 * server process only, never in the database, and closes after READY_MS or when the person sends,
 * cancels or leaves it.
 *
 * One process holds them: `next dev` or `next start` on a laptop. In production the agent will run
 * in a Vercel Sandbox, which keeps the browser between requests (APLICARE-CU-AGENT.md AA-3).
 *
 * A form's files (its screenshots, the CV's PDF) live as long as the form: dropForm deletes them, a
 * sweep every minute closes forms past their time, and folders a stopped server left are deleted.
 */
import { readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { abandonApplication, type Session } from "./engine";

/** As long as agent-browser keeps an idle browser open (runner.ts, idleTimeoutMs). */
export const READY_MS = 15 * 60 * 1000;

export interface LiveForm {
  ownerId: string;
  session: Session;
  /** the filled form as the page showed it, on this machine */
  screenshot: string;
  /** the CV's PDF the form holds: the browser may read it only at Send, so it goes when the form does */
  cvDir?: string;
  expiresAt: number;
}

const g = globalThis as unknown as { __atsHeroApplyForms?: Map<string, LiveForm>; __atsHeroApplySweep?: ReturnType<typeof setInterval> };
// one map for the process: `next dev` reloads modules, the browsers stay open
const forms: Map<string, LiveForm> = (g.__atsHeroApplyForms ??= new Map());

/** How often forms past their time are closed, whether or not their owner comes back. */
const SWEEP_MS = 60_000;
/** Folders the engine and the queue make for a form (its pictures, the CV's PDF). */
const DIR_PREFIXES = ["ats-hero-apply-", "ats-hero-cv-"];
/** A folder no open form holds and older than this is left from a form that closed without us. */
const DIR_MAX_AGE_MS = READY_MS + 5 * 60_000;

export async function putForm(queueId: string, form: LiveForm): Promise<void> {
  if (forms.get(queueId) !== form) await dropForm(queueId);
  forms.set(queueId, form);
  g.__atsHeroApplySweep ??= setInterval(() => void sweepForms(), SWEEP_MS);
  g.__atsHeroApplySweep.unref?.();
}

/** The form for this row and this owner, if it is still open. */
export async function getForm(queueId: string, ownerId: string, now = Date.now()): Promise<LiveForm | null> {
  const f = forms.get(queueId);
  if (!f || f.ownerId !== ownerId) return null;
  if (f.expiresAt <= now || f.session.state === "done") {
    await dropForm(queueId);
    return null;
  }
  return f;
}

/** Closes the browser (unless a send is closing it) and forgets the form, its pictures and the CV file. */
export async function dropForm(queueId: string): Promise<void> {
  const f = forms.get(queueId);
  if (!f) return;
  forms.delete(queueId);
  // a send in progress closes its own browser and still needs the CV: its folders go with the sweep
  if (f.session.state === "sending") return;
  await abandonApplication(f.session).catch(() => undefined);
  await Promise.all([f.session.dir, f.cvDir].filter((d): d is string => Boolean(d)).map((d) => rm(d, { recursive: true, force: true }).catch(() => undefined)));
}

/** Closes the forms of one person: their account is being deleted. */
export async function dropOwnerForms(ownerId: string): Promise<void> {
  for (const [id, f] of [...forms]) if (f.ownerId === ownerId) await dropForm(id);
}

/**
 * Closes every form past its time, whoever's it is, then deletes the folders no open form holds
 * that are older than any form lives: what a stopped server or a crashed prepare left behind.
 */
export async function sweepForms(now = Date.now()): Promise<void> {
  for (const [id, f] of [...forms]) {
    if (f.session.state === "sending") continue; // the send closes it, and needs its CV until then
    if (f.expiresAt <= now || f.session.state === "done") await dropForm(id);
  }
  const held = new Set([...forms.values()].flatMap((f) => [f.session.dir, f.cvDir].filter((d): d is string => Boolean(d))));
  const tmp = os.tmpdir();
  const names = await readdir(tmp).catch(() => [] as string[]);
  for (const name of names) {
    if (!DIR_PREFIXES.some((p) => name.startsWith(p))) continue;
    const dir = path.join(tmp, name);
    if (held.has(dir)) continue;
    // the folder's own age, on the real clock (a test's `now` may be anywhere)
    const st = await stat(dir).catch(() => null);
    if (!st?.isDirectory() || Date.now() - st.mtimeMs < DIR_MAX_AGE_MS) continue;
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** For tests: forget every form without touching a browser, and stop the sweep. */
export function clearForms(): void {
  forms.clear();
  if (g.__atsHeroApplySweep) clearInterval(g.__atsHeroApplySweep);
  g.__atsHeroApplySweep = undefined;
}
