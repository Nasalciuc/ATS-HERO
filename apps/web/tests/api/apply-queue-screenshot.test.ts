// The filled form's picture, for "Check before sending": off unless the switch is on, only for a
// signed-in person, only for an id shaped like a queue row's, and only what the queue says is theirs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ owner: null as string | null, file: null as string | null, asked: [] as [string, string][] }));
vi.mock("@/app/actions/_shared", () => ({ getOwnerId: async () => holder.owner }));
vi.mock("@/lib/apply/queue", () => ({
  screenshotPath: async (ownerId: string, id: string) => {
    holder.asked.push([ownerId, id]);
    return holder.file;
  },
}));

import { GET } from "@/app/api/apply-queue/[id]/screenshot/route";

const call = (id: string) => GET(new Request("http://localhost/api/apply-queue/x/screenshot"), { params: Promise.resolve({ id }) });

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "ats-hero-shot-test-"));
  holder.owner = "u1";
  holder.file = null;
  holder.asked = [];
  vi.stubEnv("NEXT_PUBLIC_APPLY_AGENT_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("/api/apply-queue/[id]/screenshot", () => {
  it("isn't there while the apply agent is switched off", async () => {
    vi.stubEnv("NEXT_PUBLIC_APPLY_AGENT_ENABLED", "false");
    expect((await call("row1")).status).toBe(404);
    expect(holder.asked).toEqual([]);
  });

  it("needs a signed-in person", async () => {
    holder.owner = null;
    expect((await call("row1")).status).toBe(401);
    expect(holder.asked).toEqual([]);
  });

  it("refuses an id that can't be a queue row's, before anything is looked up", async () => {
    for (const bad of ["", "x".repeat(65)]) {
      expect((await call(bad)).status).toBe(404);
    }
    expect(holder.asked).toEqual([]);
  });

  it("answers 404 when the queue has no open form for this person and id", async () => {
    expect((await call("row1")).status).toBe(404);
    expect(holder.asked).toEqual([["u1", "row1"]]);
    // a form whose picture is gone from the disk
    holder.file = path.join(dir, "gone.png");
    expect((await call("row1")).status).toBe(404);
  });

  it("returns the picture, never cached, to the person the queue says it belongs to", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    holder.file = path.join(dir, "form.png");
    fs.writeFileSync(holder.file, png);
    const res = await call("queue-row-0000000001");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("no-store, private");
    expect(Buffer.from(await res.arrayBuffer()).equals(png)).toBe(true);
    expect(holder.asked).toEqual([["u1", "queue-row-0000000001"]]);
  });
});
