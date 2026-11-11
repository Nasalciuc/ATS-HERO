/**
 * "My answers and my CV may go to the AI provider": the person's agreement, kept with the version of
 * the text they agreed to (APPLY-COPILOT-DESIGN.md §5.2; rule 11: explicit consent before a real
 * person's CV reaches a third party). Server code: the caller resolves the owner and passes it in.
 *
 * - The agreement is asked in the first action that sends something to a model, never on its own page.
 * - A text that changes gets a new version here, and is asked again.
 * - Without it, what needs a model doesn't start; the rest of the app works.
 * - It goes with the account. Taking it back from a settings page comes with that page.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiConsents } from "@/db/schema";

/**
 * The Interview Trainer's text: "Before your first session" in views/interview/TrainerSetup.tsx (the
 * interviewer is an AI; the answers go to the provider with the question, the CV line and what the job
 * asks for; kept 180 days). Change what the text promises, change the version.
 */
export const INTERVIEW_CONSENT = "interview.v1";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Has the owner agreed to this version of the text? */
export async function hasAiConsent(ownerId: string, version: string): Promise<boolean> {
  const [row] = await db.select({ version: aiConsents.version }).from(aiConsents)
    .where(and(eq(aiConsents.ownerId, ownerId), eq(aiConsents.version, version)));
  return Boolean(row);
}

/**
 * The owner agrees to this version. Agreeing twice keeps the first date. Given a transaction, the
 * agreement is written in it: kept if what it was given for is kept (the session it starts), and
 * gone with it otherwise.
 */
export async function giveAiConsent(ownerId: string, version: string, on: Pick<Tx, "insert"> = db): Promise<void> {
  await on.insert(aiConsents).values({ ownerId, version }).onConflictDoNothing();
}

/** Every agreement of the owner goes, inside the caller's transaction (deleteAccount). */
export async function removeAiConsents(tx: Tx, ownerId: string): Promise<void> {
  await tx.delete(aiConsents).where(eq(aiConsents.ownerId, ownerId));
}
