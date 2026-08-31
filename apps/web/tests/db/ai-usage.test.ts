import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { positiveIntEnv } from "@/lib/env";
import { consumeAiQuotaOn } from "@/lib/ai-quota";
import { makeTestDb } from "./setup";

let db: Awaited<ReturnType<typeof makeTestDb>>;
beforeEach(async () => { db = await makeTestDb(); });

describe("positiveIntEnv", () => {
  afterEach(() => {
    delete process.env.AI_REWRITE_DAILY_LIMIT;
  });

  it("returns fallback when unset or empty", () => {
    delete process.env.AI_REWRITE_DAILY_LIMIT;
    expect(positiveIntEnv("AI_REWRITE_DAILY_LIMIT", 5)).toBe(5);
    process.env.AI_REWRITE_DAILY_LIMIT = "";
    expect(positiveIntEnv("AI_REWRITE_DAILY_LIMIT", 5)).toBe(5);
  });

  it("falls back and logs on non-integer env (never NaN)", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.AI_REWRITE_DAILY_LIMIT = "abc";
    expect(positiveIntEnv("AI_REWRITE_DAILY_LIMIT", 5)).toBe(5);
    expect(err).toHaveBeenCalled();
    expect(String(err.mock.calls[0]?.[0])).toContain("Invalid AI_REWRITE_DAILY_LIMIT");
    err.mockRestore();
  });

  it("falls back on zero or negative", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.AI_REWRITE_DAILY_LIMIT = "0";
    expect(positiveIntEnv("AI_REWRITE_DAILY_LIMIT", 5)).toBe(5);
    process.env.AI_REWRITE_DAILY_LIMIT = "-3";
    expect(positiveIntEnv("AI_REWRITE_DAILY_LIMIT", 5)).toBe(5);
    err.mockRestore();
  });

  it("accepts a positive integer", () => {
    process.env.AI_REWRITE_DAILY_LIMIT = "12";
    expect(positiveIntEnv("AI_REWRITE_DAILY_LIMIT", 5)).toBe(12);
  });
});

describe("consumeAiQuota", () => {
  const uid = "user-quota";

  it("throws on dailyLimit 0", async () => {
    await expect(consumeAiQuotaOn(db, uid, 0)).rejects.toThrow(/invalid dailyLimit=0/);
  });

  it("throws on dailyLimit NaN", async () => {
    await expect(consumeAiQuotaOn(db, uid, Number.NaN)).rejects.toThrow(/invalid dailyLimit/);
  });

  it("the 6th consume at limit 5 returns < 0", async () => {
    let last = 0;
    for (let i = 0; i < 6; i++) last = await consumeAiQuotaOn(db, uid, 5);
    expect(last).toBeLessThan(0);
  });
});
