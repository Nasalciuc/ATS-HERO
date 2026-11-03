import { describe, expect, it } from "vitest";
import { jobUrlKey, safeJobUrl } from "@/lib/job-url";

describe("safeJobUrl: only http(s) links reach the Tracker's <a href>", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "ftp://acme.com/jobs",
    "https://user:pass@acme.com/jobs/1",
    "not a link",
    "",
    `https://acme.com/${"a".repeat(500)}`,
  ])("refuses %s", (raw) => {
    expect(safeJobUrl(raw)).toBeNull();
  });

  it("keeps an ordinary link", () => {
    expect(safeJobUrl("  https://jobs.lever.co/acme/123  ")).toBe("https://jobs.lever.co/acme/123");
  });
});

describe("jobUrlKey: one key per job", () => {
  it("ignores the scheme, the host's case, www, the trailing slash, the fragment and the query's order", () => {
    const a = jobUrlKey("https://www.Acme.com/careers/42/?b=2&a=1#apply");
    const b = jobUrlKey("http://acme.com/careers/42?a=1&b=2");
    expect(a).toBe("acme.com/careers/42?a=1&b=2");
    expect(b).toBe(a);
  });

  it("drops the tracking parameters and keeps the ones that name the job", () => {
    expect(jobUrlKey("https://ro.indeed.com/viewjob?jk=abc123&utm_source=x&gclid=1&from=serp"))
      .toBe("ro.indeed.com/viewjob?from=serp&jk=abc123");
    expect(jobUrlKey("https://boards.greenhouse.io/acme/jobs/123?gh_src=abc")).toBe("boards.greenhouse.io/acme/jobs/123");
  });

  it("keeps the port and tells different jobs apart", () => {
    expect(jobUrlKey("http://localhost:4100/greenhouse.html")).toBe("localhost:4100/greenhouse.html");
    expect(jobUrlKey("https://ro.indeed.com/viewjob?jk=1")).not.toBe(jobUrlKey("https://ro.indeed.com/viewjob?jk=2"));
  });

  it("has no key for a link it doesn't keep", () => {
    expect(jobUrlKey("javascript:alert(1)")).toBeNull();
    expect(jobUrlKey(null)).toBeNull();
  });
});
