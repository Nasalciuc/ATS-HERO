import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/purge-guests/route";

describe("purge-guests cron auth", () => {
  const prev = process.env.CRON_SECRET;
  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it("returns 500 when CRON_SECRET is unset (fail closed)", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(new Request("http://localhost/api/cron/purge-guests"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "CRON_SECRET not configured" });
  });

  it("returns 401 when the bearer token is wrong", async () => {
    process.env.CRON_SECRET = "correct-secret";
    const res = await GET(new Request("http://localhost/api/cron/purge-guests", {
      headers: { authorization: "Bearer wrong" },
    }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the authorization header is missing", async () => {
    process.env.CRON_SECRET = "correct-secret";
    const res = await GET(new Request("http://localhost/api/cron/purge-guests"));
    expect(res.status).toBe(401);
  });
});
