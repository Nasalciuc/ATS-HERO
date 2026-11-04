/**
 * The forms the agent filled and keeps open for the person, by queue row. A live session is a
 * browser (agent-browser's named session) plus the plan the person is shown: it lives in this
 * server process only, never in the database, and closes after READY_MS or when the person sends,
 * cancels or leaves it.
 *
 * One process holds them: `next dev` or `next start` on a laptop. In production the agent will run
 * in a Vercel Sandbox, which keeps the browser between requests (APLICARE-CU-AGENT.md AA-3).
 */
import { rm } from "node:fs/promises";
import { abandonApplication, type Session } from "./engine";

/** As long as agent-browser keeps an idle browser open (runner.ts, idleTimeoutMs). */
export const READY_MS = 15 * 60 * 1000;

export interface LiveForm {
  ownerId: string;
  session: Session;
  /** the filled form as the page showed it, on this machine */
  screenshot: string;
  expiresAt: number;
}

const g = globalThis as unknown as { __atsHeroApplyForms?: Map<string, LiveForm> };
// one map for the process: `next dev` reloads modules, the browsers stay open
const forms: Map<string, LiveForm> = (g.__atsHeroApplyForms ??= new Map());

export function putForm(queueId: string, form: LiveForm): void {
  forms.set(queueId, form);
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

/** Closes the browser (unless a send is closing it) and forgets the form and its pictures. */
export async function dropForm(queueId: string): Promise<void> {
  const f = forms.get(queueId);
  if (!f) return;
  forms.delete(queueId);
  await abandonApplication(f.session).catch(() => undefined);
  await rm(f.session.dir, { recursive: true, force: true }).catch(() => undefined);
}

/** For tests: forget every form without touching a browser. */
export function clearForms(): void {
  forms.clear();
}
