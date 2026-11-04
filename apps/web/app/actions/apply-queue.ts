"use server";
/**
 * "Ready to send" (canvas "ATS Hero Tracker v2", page "Search & agent"): the person's queue for the
 * apply agent. Each action resolves the owner and calls lib/apply/queue.ts. Expected failures come
 * back as { ok: false, message }: Next.js hides a thrown message in production.
 */
import { z } from "zod";
import { getOwnerId } from "./_shared";
import { applyAgentEnabled } from "@/lib/features";
import { withLog } from "@/lib/log";
import {
  cancel, dequeue, enqueue, MAX_DAILY_LIMIT, prepare, queueView, QueueError, review, send, setDailyLimit,
  type QueueDeps, type QueueView, type Review, type SendOutcome,
} from "@/lib/apply/queue";
import type { QueueStatus } from "@/lib/types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

const OFF = { ok: false as const, message: "The apply agent isn’t available yet." };
const SIGNED_OUT = { ok: false as const, message: "Sign in to use the apply agent." };

/** The lab's synthetic forms on localhost: on a developer's machine only, never in production. */
const deps = (): QueueDeps => ({ allowLocal: process.env.NODE_ENV !== "production" });

async function owner(): Promise<string | { ok: false; message: string }> {
  if (!applyAgentEnabled()) return OFF;
  return (await getOwnerId()) ?? SIGNED_OUT;
}

const FAILED = "Something went wrong. Try again.";

/** The owner, the action in the log, and an expected failure as its message; any other as `failed`. */
async function guarded<T extends object>(action: string, fn: (ownerId: string) => Promise<T>, failed = FAILED): Promise<Result<T>> {
  const o = await owner();
  if (typeof o !== "string") return o;
  try {
    return { ok: true, ...(await withLog(`applyQueue.${action}`, { ownerId: o }, () => fn(o))) };
  } catch (e) {
    if (e instanceof QueueError) return { ok: false, message: e.message };
    return { ok: false, message: failed };
  }
}

const Id = z.string().min(1).max(64);

export async function getMyQueue(): Promise<Result<{ view: QueueView }>> {
  return guarded("view", async (ownerId) => ({ view: await queueView(ownerId, deps()) }));
}

export async function addToQueue(applicationIds: string[], cvId?: string | null): Promise<Result<{ added: number }>> {
  const ids = z.array(Id).max(50).safeParse(applicationIds);
  const cv = Id.nullable().optional().safeParse(cvId);
  if (!ids.success || !cv.success) return { ok: false, message: "Choose the jobs again." };
  return guarded("add", async (ownerId) => ({ added: await enqueue(ownerId, ids.data, cv.data ?? null, deps()) }));
}

export async function removeFromQueue(id: string): Promise<Result> {
  if (!Id.safeParse(id).success) return { ok: false, message: "Choose the job again." };
  return guarded("remove", async (ownerId) => {
    await dequeue(ownerId, id);
    return {};
  });
}

export async function setMyDailyLimit(limit: number): Promise<Result<{ limit: number }>> {
  const n = z.number().int().min(1).max(MAX_DAILY_LIMIT).safeParse(limit);
  if (!n.success) return { ok: false, message: `Choose a limit from 1 to ${MAX_DAILY_LIMIT} a day.` };
  return guarded("limit", async (ownerId) => ({ limit: await setDailyLimit(ownerId, n.data) }));
}

/** The agent fills the form; about a minute. Nothing is sent here. */
export async function prepareQueued(id: string): Promise<Result<{ status: QueueStatus }>> {
  if (!Id.safeParse(id).success) return { ok: false, message: "Choose the job again." };
  return guarded("prepare", async (ownerId) => ({ status: await prepare(ownerId, id, deps()) }),
    "Something went wrong. Nothing was sent. Try again.");
}

export async function getReview(id: string): Promise<Result<{ review: Review | null }>> {
  if (!Id.safeParse(id).success) return { ok: false, message: "Choose the job again." };
  return guarded("review", async (ownerId) => ({ review: await review(ownerId, id, deps()) }));
}

const Approval = z.object({
  digest: z.string().min(8).max(64),
  answers: z.record(z.string().max(64), z.union([z.string().max(5000), z.boolean()])),
});

/** Send, on the person's approval of the form they saw, with their answers (never stored). */
export async function sendQueued(id: string, approval: { digest: string; answers: Record<string, string | boolean> }): Promise<Result<{ outcome: SendOutcome }>> {
  const a = Approval.safeParse(approval);
  if (!Id.safeParse(id).success || !a.success) return { ok: false, message: "Check your answers and press Send again." };
  // after the click an error can't say whether the application went out
  return guarded("send", async (ownerId) => ({ outcome: await send(ownerId, id, a.data, deps()) }),
    "Something went wrong while sending. Check Ready to send and your e-mail before you try again.");
}

/** "Cancel, send nothing": the form closes, the job waits in the queue again. */
export async function cancelQueued(id: string): Promise<Result> {
  if (!Id.safeParse(id).success) return { ok: false, message: "Choose the job again." };
  return guarded("cancel", async (ownerId) => {
    await cancel(ownerId, id);
    return {};
  });
}
