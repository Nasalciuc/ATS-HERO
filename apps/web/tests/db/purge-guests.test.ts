// The privacy page promises that a guest CV is deleted GUEST_RETENTION_DAYS after its last edit.
// This runs the real cron route against the real migrations (PGlite) to hold it to that.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestDb } from "./setup";
import { cvs } from "@/db/schema";
import { emptyCvData } from "@/lib/types";
import { GUEST_RETENTION_DAYS } from "@/lib/retention";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

import { GET } from "@/app/api/cron/purge-guests/route";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

let db: Awaited<ReturnType<typeof makeTestDb>>;
const prevSecret = process.env.CRON_SECRET;

beforeEach(async () => {
  db = await makeTestDb();
  holder.db = db;
  process.env.CRON_SECRET = "test-secret";
});
afterEach(() => {
  if (prevSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = prevSecret;
});

describe("purge-guests cron", () => {
  it(`deletes guest CVs untouched for more than ${GUEST_RETENTION_DAYS} days, and nothing else`, async () => {
    await db.insert(cvs).values([
      { guestId: "guest-old", title: "old guest", data: emptyCvData(), updatedAt: daysAgo(GUEST_RETENTION_DAYS + 1) },
      { guestId: "guest-recent", title: "recent guest", data: emptyCvData(), updatedAt: daysAgo(GUEST_RETENTION_DAYS - 1) },
      { ownerId: "user-a", title: "account CV", data: emptyCvData(), updatedAt: daysAgo(GUEST_RETENTION_DAYS * 3) },
    ]);

    const res = await GET(
      new Request("http://localhost/api/cron/purge-guests", { headers: { authorization: "Bearer test-secret" } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ purgedScans: 0, purgedCvs: 1 });

    const left = (await db.select({ title: cvs.title }).from(cvs)).map((r) => r.title).sort();
    expect(left).toEqual(["account CV", "recent guest"]);
  });
});
