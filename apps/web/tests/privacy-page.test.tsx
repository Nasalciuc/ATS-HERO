// The privacy page quotes numbers and names that live in the code. These checks keep the two from
// drifting apart (AGENTS.md, rule 11, "Privacy page"):
// - the guest retention and the rate-limit window come from the constants the code runs on;
// - the "updated" date is a fixed constant (a computed date would announce a change on every build);
// - every local-storage key the code uses is named on the page, every session-storage key has the
//   ats_ prefix the page describes, and the app code sets no cookies itself (cc_cookie comes from the
//   consent library, and its lifetime matches the page);
// - no analytics or tracking package is installed, Google Analytics only arrives through the consent
//   banner (lib/consent.ts), and Clerk's telemetry is off ("0 ads", "analytics only if you click Allow");
// - the database logs slow statements without their values and errors without the failing row
//   ("never what your CV says"; withLog's half is in tests/db/log-no-cv-data.test.ts);
// - the database keeps its backups no longer than the page says (infra/data.yaml).
import { CONSENT_DAYS } from "@/lib/consent";
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { GUEST_RETENTION_DAYS } from "@/lib/retention";
import { RATE_LIMIT_WINDOW_MS } from "@/lib/ratelimit";
import { PrivacyContent, PRIVACY_UPDATED } from "@/views/PrivacyPage";

// Client components with Clerk and router hooks; the page content is what is under test.
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const WEB = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(WEB, rel), "utf8");

const html = renderToStaticMarkup(<PrivacyContent />);
const text = html
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ");

/** Every .ts/.tsx file the app runs (tests excluded). */
function appFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
    }
  };
  for (const dir of ["app", "components", "hooks", "lib", "store", "stores", "views"]) {
    if (fs.existsSync(path.join(WEB, dir))) walk(path.join(WEB, dir));
  }
  out.push(path.join(WEB, "proxy.ts"));
  return out;
}

type StorageUse = { storage: "local" | "session"; key: string; file: string };

/** Keys passed to localStorage / sessionStorage, literals or same-file string constants. */
function storageUses(): StorageUse[] {
  const uses: StorageUse[] = [];
  for (const file of appFiles()) {
    const src = fs.readFileSync(file, "utf8");
    const rel = path.relative(WEB, file);
    const consts = new Map(
      [...src.matchAll(/const\s+(\w+)\s*=\s*(["'`])([^"'`]+)\2/g)].map((m) => [m[1], m[3]] as const),
    );
    for (const m of src.matchAll(/\b(local|session)Storage\.(?:get|set|remove)Item\(\s*(?:(["'`])([^"'`]*)\2|(\w+))/g)) {
      const key = m[3] ?? consts.get(m[4]);
      if (key === undefined) throw new Error(`${rel}: storage key ${m[4]} is not a string constant in that file`);
      uses.push({ storage: m[1] as StorageUse["storage"], key, file: rel });
    }
  }
  return uses;
}

describe("privacy page", () => {
  it("quotes the guest retention the purge cron deletes by", () => {
    expect(text).toContain(`${GUEST_RETENTION_DAYS} days after your last edit`);
    const cron = read("app/api/cron/purge-guests/route.ts");
    expect(cron).toContain("GUEST_RETENTION_DAYS");
    expect(cron).not.toMatch(/interval '\d/);
  });

  it("quotes the rate-limit window proxy.ts counts in", () => {
    expect(text).toContain(`${RATE_LIMIT_WINDOW_MS / 1000} seconds`);
    expect(read("proxy.ts")).toMatch(/allow\([^)]*RATE_LIMIT_WINDOW_MS\)/);
  });

  it("shows a fixed date that matches its label, never one computed on each build", () => {
    expect(html).toMatch(new RegExp(`<time datetime="${PRIVACY_UPDATED.iso}">${PRIVACY_UPDATED.label}</time>`, "i"));
    const label = new Date(`${PRIVACY_UPDATED.iso}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    expect(PRIVACY_UPDATED.label).toBe(label);
    for (const rel of ["views/PrivacyPage.tsx", "app/privacy/page.tsx", "app/terms/page.tsx"]) {
      expect(read(rel), rel).not.toMatch(/new Date\(|Date\.now\(/);
    }
  });

  it("names every local-storage key the code uses", () => {
    const local = [...new Set(storageUses().filter((u) => u.storage === "local").map((u) => u.key))];
    expect(local).toEqual(expect.arrayContaining(["ats_hero_guest_id", "ats_hero_cv_id"])); // the scan works
    for (const key of local) expect(text, `local-storage key ${key}`).toContain(key);
  });

  it("covers every session-storage key with its ats_ row", () => {
    const session = storageUses().filter((u) => u.storage === "session");
    expect(session.length).toBeGreaterThan(0); // the scan works
    for (const use of session) expect(use.key, use.file).toMatch(/^ats_/);
    expect(text).toContain("the other ats_ keys");
  });

  it("sets no cookies from the app code itself: cc_cookie comes from the consent library", () => {
    for (const file of appFiles()) {
      expect(fs.readFileSync(file, "utf8"), path.relative(WEB, file)).not.toMatch(
        /document\.cookie\s*=|cookies\(\)\)?\.set\(|\.cookies\.set\(/,
      );
    }
  });

  it("has no analytics or tracking package: Google Analytics comes only through the consent banner, and Clerk's telemetry is off", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };
    const trackers = /^(@vercel\/(analytics|speed-insights)|posthog-|@sentry\/|mixpanel|@segment\/|react-ga|react-gtm|@next\/third-parties|@amplitude\/|logrocket|@datadog\/browser|@hotjar\/|@fullstory\/|plausible|@microsoft\/clarity)/;
    expect(Object.keys(pkg.dependencies ?? {}).filter((d) => trackers.test(d))).toEqual([]);
    expect(text).toContain("0 ads");
    expect(text).toContain("analytics only if you click Allow");
    // Development instances (the live site runs on one) send SDK telemetry unless told not to.
    expect(read("app/layout.tsx")).toMatch(/<ClerkProvider[^>]*telemetry=\{false\}/);
    const connectSrc = read("lib/csp.ts").split("\n").filter((line) => line.includes('"connect-src'));
    expect(connectSrc).toHaveLength(1);
    expect(connectSrc[0]).not.toContain("clerk-telemetry");
  });

  it("names the consent cookie with the lifetime the banner gives it, and the Google Analytics cookies", () => {
    expect(text).toContain("cc_cookie");
    expect(text).toContain(`for ${CONSENT_DAYS} days`);
    expect(text).toContain(`${CONSENT_DAYS} days, then the banner asks again`);
    expect(text).toMatch(/_ga and _ga_(<|&lt;)ID(>|&gt;)/);
    expect(text).toMatch(/Google Analytics/);
  });

  it("keeps CV data out of the database logs it promises are free of it", () => {
    expect(text).toContain("never what your CV says");
    const data = fs.readFileSync(path.join(WEB, "../../infra/data.yaml"), "utf8");
    expect(data).toMatch(/log_parameter_max_length: "0"/); // slow statements without their values
    expect(data).toMatch(/log_error_verbosity: terse/); // errors without DETAIL (the failing row)
  });

  it("keeps database backups no longer than it says", () => {
    expect(text).toContain("Daily backups: 14 days");
    expect(text).toContain("The copy taken before a database update: up to 30 days");
    const data = fs.readFileSync(path.join(WEB, "../../infra/data.yaml"), "utf8");
    expect(data).toMatch(/BackupRetentionPeriod: 14\s*$/m);
    // The snapshot cleanup runs once a day: a snapshot KEEP_DAYS old goes on the next run, or on
    // the one after that if a run fails.
    expect(data).toMatch(/ScheduleExpression: cron\(\d+ \d+ \* \* \? \*\)/);
    const keep = data.match(/KEEP_DAYS: "(\d+)"/);
    expect(keep, "KEEP_DAYS of the snapshot cleanup").not.toBeNull();
    expect(Number(keep![1]) + 2).toBeLessThanOrEqual(30);
  });
});
