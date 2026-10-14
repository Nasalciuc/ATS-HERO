import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/billing-audit/route";

// Same rules as purge-guests. Before, the route compared the header with `Bearer ${CRON_SECRET}`
// even when CRON_SECRET was unset, so "Authorization: Bearer undefined" got a 200.
describe("billing-audit cron auth", () => {
  const prev = process.env.CRON_SECRET;
  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  const call = (authorization?: string) =>
    GET(new Request("http://localhost/api/cron/billing-audit", authorization ? { headers: { authorization } } : undefined));

  it("returns 500 when CRON_SECRET is unset (fail closed), whatever the header says", async () => {
    delete process.env.CRON_SECRET;
    for (const header of [undefined, "Bearer undefined", "Bearer "]) {
      const res = await call(header);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "CRON_SECRET not configured" });
    }
  });

  it("returns 401 when the bearer token is wrong or missing", async () => {
    process.env.CRON_SECRET = "correct-secret";
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call()).status).toBe(401);
  });

  it("runs with the right token", async () => {
    process.env.CRON_SECRET = "correct-secret";
    const res = await call("Bearer correct-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, audited: 0 });
  });
});
