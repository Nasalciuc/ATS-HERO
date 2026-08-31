import { afterEach, describe, expect, it } from "vitest";
import { allow, MAX_KEYS, resetRateLimitForTests } from "./ratelimit";

afterEach(() => resetRateLimitForTests());

describe("rate limiter hard cap", () => {
  it("rejects a new key once MAX_KEYS active windows are filled", () => {
    for (let i = 0; i < MAX_KEYS; i++) {
      expect(allow(`k${i}`, 5, 60_000)).toBe(true);
    }
    expect(allow("overflow", 5, 60_000)).toBe(false);
  });

  it("still increments an existing key when the map is full", () => {
    expect(allow("hot", 5, 60_000)).toBe(true);
    for (let i = 0; i < MAX_KEYS - 1; i++) {
      expect(allow(`k${i}`, 5, 60_000)).toBe(true);
    }
    expect(allow("hot", 5, 60_000)).toBe(true);
  });

  it("prunes expired keys and then admits a new one", () => {
    for (let i = 0; i < MAX_KEYS; i++) {
      expect(allow(`k${i}`, 5, 1)).toBe(true);
    }
    // let every window expire
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    expect(allow("after-prune", 5, 60_000)).toBe(true);
  });
});
