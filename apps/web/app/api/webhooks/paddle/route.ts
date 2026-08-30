import { NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEvents, subscriptions, subscriptionEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Paddle } from "@paddle/paddle-node-sdk";

export const runtime = "nodejs";

const VALID: Record<string, string[]> = { active: ["past_due","canceled"], trialing: ["active","canceled"], past_due: ["active","canceled"], canceled: [] };

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("paddle-signature") ?? "";
  let event;
  try { event = await new Paddle(process.env.PADDLE_API_KEY!).webhooks.unmarshal(raw, process.env.PADDLE_WEBHOOK_SECRET!, sig); }
  catch { return NextResponse.json({ error: "bad signature" }, { status: 401 }); }
  if (!event) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  // Paddle's union covers every notification type; we only read the subscription fields and
  // store-and-skip anything that doesn't carry them.
  type SubscriptionPayload = {
    id?: string; status?: string; customerId?: string;
    customData?: { userId?: string };
    items?: { price?: { id?: string } }[];
    currentBillingPeriod?: { endsAt?: string };
  };
  const d = event.data as unknown as SubscriptionPayload;
  const ownerId = d?.customData?.userId;
  await db.transaction(async (tx) => {
    const dup = await tx.select().from(webhookEvents).where(eq(webhookEvents.eventId, event.eventId));
    if (dup.length) return;                                  // idempotent
    await tx.insert(webhookEvents).values({ eventId: event.eventId, type: event.eventType });
    if (!ownerId || !d?.id) return;                          // store-and-skip unknowns
    const status = d.status === "trialing" ? "trialing" : d.status === "past_due" ? "past_due"
                 : ["canceled","paused"].includes(d.status ?? "") ? "canceled" : "active";
    const [prev] = await tx.select().from(subscriptions).where(eq(subscriptions.ownerId, ownerId));
    if (prev && prev.status !== status && !VALID[prev.status]?.includes(status)) return; // guard tranziții
    await tx.insert(subscriptions).values({
      ownerId, paddleCustomerId: d.customerId ?? null, paddleSubscriptionId: d.id,
      priceId: d.items?.[0]?.price?.id ?? null, status,
      currentPeriodEnd: d.currentBillingPeriod?.endsAt ? new Date(d.currentBillingPeriod.endsAt) : null,
    }).onConflictDoUpdate({ target: subscriptions.ownerId, set: { status, paddleSubscriptionId: d.id,
      currentPeriodEnd: d.currentBillingPeriod?.endsAt ? new Date(d.currentBillingPeriod.endsAt) : null } });
    await tx.insert(subscriptionEvents).values({ ownerId, paddleSubscriptionId: d.id,
      eventId: event.eventId, source: "webhook", prevStatus: prev?.status ?? null,
      newStatus: status, rawPayload: JSON.parse(raw), occurredAt: new Date(event.occurredAt) });
  });
  return NextResponse.json({ ok: true });
}
