// The page's client for POST /api/job-post (lib/api.ts): every failure comes back as a reason the
// page can explain, including a request that never got an answer.
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, JOB_POST_TIMEOUT_MS } from "@/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("api.jobPost", () => {
  it("a network failure is 'unreachable', not the browser's error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await api.jobPost("https://jobs.example.com/1")).toEqual({ ok: false, reason: "unreachable" });
  });

  it("a connection that never answers is given up at the deadline, so the button comes back", async () => {
    vi.useFakeTimers();
    // a fetch that hangs until it is aborted, as a real one does
    const hang = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    );
    vi.stubGlobal("fetch", hang);
    const result = api.jobPost("https://jobs.example.com/1");
    await vi.advanceTimersByTimeAsync(JOB_POST_TIMEOUT_MS);
    expect(await result).toEqual({ ok: false, reason: "unreachable" });
    expect(hang.mock.calls[0][1].signal?.aborted).toBe(true);
  });

  it("too many links is its own reason; a page's text comes back as text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    expect(await api.jobPost("https://jobs.example.com/1")).toEqual({ ok: false, reason: "too_many_requests" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true, text: "Game Designer" })));
    expect(await api.jobPost("https://jobs.example.com/1")).toEqual({ ok: true, text: "Game Designer" });
  });
});
