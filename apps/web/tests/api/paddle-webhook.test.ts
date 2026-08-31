import { beforeEach, describe, expect, it } from "vitest";
import { makeTestDb } from "../db/setup";
import { subscriptions, webhookEvents } from "@/db/schema";
import { applyPaddleWebhook } from "@/lib/paddle-webhook";

let db: Awaited<ReturnType<typeof makeTestDb>>;
beforeEach(async () => { db = await makeTestDb(); });

describe("paddle webhook event-type gate", () => {
  it("logs transaction.completed but does not write a subscription", async () => {
    const raw = JSON.stringify({
      event_id: "evt_tx_1",
      event_type: "transaction.completed",
      data: { id: "txn_1", status: "completed", customData: { userId: "user-a" } },
    });
    await applyPaddleWebhook(db, {
      eventId: "evt_tx_1",
      eventType: "transaction.completed",
      occurredAt: new Date().toISOString(),
      data: { id: "txn_1", status: "completed", customData: { userId: "user-a" } },
    }, raw);

    expect((await db.select().from(webhookEvents)).map((r) => r.eventId)).toEqual(["evt_tx_1"]);
    expect(await db.select().from(subscriptions)).toEqual([]);
  });

  it("applies subscription.activated into subscriptions as active", async () => {
    const data = {
      id: "sub_1",
      status: "active",
      customerId: "ctm_1",
      customData: { userId: "user-a" },
      items: [{ price: { id: "pri_1" } }],
    };
    const raw = JSON.stringify({ event_id: "evt_sub_1", event_type: "subscription.activated", data });
    await applyPaddleWebhook(db, {
      eventId: "evt_sub_1",
      eventType: "subscription.activated",
      occurredAt: new Date().toISOString(),
      data,
    }, raw);

    const rows = await db.select().from(subscriptions);
    expect(rows.length).toBe(1);
    expect(rows[0].ownerId).toBe("user-a");
    expect(rows[0].status).toBe("active");
    expect(rows[0].paddleSubscriptionId).toBe("sub_1");
  });
});
