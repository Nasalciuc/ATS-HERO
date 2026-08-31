import { describe, expect, it } from "vitest";
import { Paddle } from "@paddle/paddle-node-sdk";

/**
 * No Paddle account yet, so the only thing worth asserting is the guard the route relies on:
 * a forged signature must never unmarshal into an event. The route turns that into a 401.
 */
describe("paddle webhook signature", () => {
  it("rejects a forged signature", async () => {
    const paddle = new Paddle("pdl_test_key");
    const raw = JSON.stringify({ event_id: "evt_1", event_type: "subscription.created", data: { id: "sub_1" } });

    await expect(
      paddle.webhooks.unmarshal(raw, "whsec_test_secret", "ts=1;h1=deadbeef")
    ).rejects.toThrow();
  });
});
