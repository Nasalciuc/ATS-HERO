// POST /api/job-post answers our own page only: JSON, and never a request the browser marks as
// coming from another site. Nothing here reaches the network: every request is refused before the
// link would be opened, or names LinkedIn, which is never opened.
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/job-post/route";
import proxy from "@/proxy";

const post = (headers: Record<string, string>, body: unknown = { url: "https://www.linkedin.com/jobs/view/1" }) =>
  POST(new Request("http://localhost/api/job-post", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("POST /api/job-post", () => {
  it("refuses a form or plain text body, which another site's page could send without asking", async () => {
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
      expect((await post({ "content-type": type })).status).toBe(415);
    }
    expect((await post({})).status).toBe(415);
  });

  it("refuses a request the browser marks as coming from another site", async () => {
    for (const site of ["cross-site", "same-site", "none"]) {
      expect((await post({ "content-type": "application/json", "sec-fetch-site": site })).status).toBe(403);
    }
  });

  it("answers our own page: JSON from the same origin (or a client that sends no such mark)", async () => {
    const ours: Record<string, string>[] = [{ "content-type": "application/json", "sec-fetch-site": "same-origin" }, { "content-type": "application/json; charset=utf-8" }];
    for (const headers of ours) {
      const res = await post(headers);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: false, reason: "linkedin" });
    }
  });

  it("refuses a body that isn't a link", async () => {
    expect((await post({ "content-type": "application/json" }, "not json")).status).toBe(400);
    expect((await post({ "content-type": "application/json" }, { url: "" })).status).toBe(400);
  });

  it("the proxy refuses another site's requests before they count toward the visitor's ten a minute", async () => {
    // no Clerk keys in tests: the proxy is the plain rate-limit function
    const send = (headers: Record<string, string>) =>
      (proxy as unknown as (req: NextRequest) => Promise<Response> | Response)(
        new NextRequest("http://localhost/api/job-post", { method: "POST", headers: { "x-forwarded-for": "203.0.113.77", ...headers }, body: "{}" }),
      );
    for (let i = 0; i < 12; i++) expect((await send({ "content-type": "text/plain" })).status).toBe(415);
    expect((await send({ "content-type": "application/json", "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await send({ "content-type": "application/json", "sec-fetch-site": "same-origin" })).status).not.toBe(429);
  });
});
