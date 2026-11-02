// POST /api/job-post answers our own page only: JSON, and never a request the browser marks as
// coming from another site. Nothing here reaches the network: every request is refused before the
// link would be opened, or names LinkedIn, which is never opened.
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/job-post/route";

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
});
