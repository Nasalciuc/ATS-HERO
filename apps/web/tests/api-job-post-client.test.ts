// The page's client for POST /api/job-post (lib/api.ts): every failure comes back as a reason the
// page can explain, including a request that never got an answer.
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";

afterEach(() => vi.unstubAllGlobals());

describe("api.jobPost", () => {
  it("a network failure is 'unreachable', not the browser's error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await api.jobPost("https://jobs.example.com/1")).toEqual({ ok: false, reason: "unreachable" });
  });

  it("too many links is its own reason; a page's text comes back as text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    expect(await api.jobPost("https://jobs.example.com/1")).toEqual({ ok: false, reason: "too_many_requests" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true, text: "Game Designer" })));
    expect(await api.jobPost("https://jobs.example.com/1")).toEqual({ ok: true, text: "Game Designer" });
  });
});
