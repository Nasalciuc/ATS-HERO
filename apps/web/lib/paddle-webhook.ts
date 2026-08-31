import { eq } from "drizzle-orm";
import { webhookEvents, subscriptions, subscriptionEvents } from "@/db/schema";

export const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created",
  "subscription.activated",
  "subscription.updated",
  "subscription.canceled",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.trialing",
]);

const VALID: Record<string, string[]> = {
  active: ["past_due", "canceled"],
  trialing: ["active", "canceled"],
  past_due: ["active", "canceled"],
  canceled: [],
};

export type PaddleWebhookEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string | Date;
  data: unknown;
};

type SubscriptionPayload = {
  id?: string;
  status?: string;
  customerId?: string;
  customData?: { userId?: string };
  items?: { price?: { id?: string } }[];
  currentBillingPeriod?: { endsAt?: string };
};

/** Persist idempotency for every event; apply row changes only for subscription.* */
export async function applyPaddleWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  event: PaddleWebhookEvent,
  raw: string,
) {
  await db.transaction(async (tx: typeof db) => {
    const dup = await tx.select().from(webhookEvents).where(eq(webhookEvents.eventId, event.eventId));
    if (dup.length) return;
    await tx.insert(webhookEvents).values({ eventId: event.eventId, type: event.eventType });
    if (!SUBSCRIPTION_EVENTS.has(event.eventType)) return;

    const d = event.data as SubscriptionPayload;
    const ownerId = d?.customData?.userId;
    if (!ownerId || !d?.id) return;

    const status = d.status === "trialing" ? "trialing" : d.status === "past_due" ? "past_due"
      : ["canceled", "paused"].includes(d.status ?? "") ? "canceled" : "active";
    const [prev] = await tx.select().from(subscriptions).where(eq(subscriptions.ownerId, ownerId));
    if (prev && prev.status !== status && !VALID[prev.status]?.includes(status)) return;
    await tx.insert(subscriptions).values({
      ownerId, paddleCustomerId: d.customerId ?? null, paddleSubscriptionId: d.id,
      priceId: d.items?.[0]?.price?.id ?? null, status,
      currentPeriodEnd: d.currentBillingPeriod?.endsAt ? new Date(d.currentBillingPeriod.endsAt) : null,
    }).onConflictDoUpdate({
      target: subscriptions.ownerId,
      set: {
        status,
        paddleSubscriptionId: d.id,
        currentPeriodEnd: d.currentBillingPeriod?.endsAt ? new Date(d.currentBillingPeriod.endsAt) : null,
      },
    });
    await tx.insert(subscriptionEvents).values({
      ownerId, paddleSubscriptionId: d.id,
      eventId: event.eventId, source: "webhook", prevStatus: prev?.status ?? null,
      newStatus: status, rawPayload: JSON.parse(raw), occurredAt: new Date(event.occurredAt),
    });
  });
}
