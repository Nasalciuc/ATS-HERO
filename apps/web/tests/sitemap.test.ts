// The sitemap, robots.txt and the noindex metadata are read by crawlers, not by people, so nothing
// else in the test suite would notice a mistake. These checks keep them honest:
// - every app/**/page.tsx route is classified: public (in the sitemap) or noindex, nothing forgotten;
// - the sitemap lists exactly the public routes, with lastModified only where a page owns a date;
// - robots.txt blocks only the API and dev pages, never a page that must be read: a noindex page
//   blocked in robots.txt keeps its noindex unseen (Google: "must not be blocked by a robots.txt
//   file"); on Vercel previews it blocks everything;
// - noindex sits on the /app layout and on the callback, and never on the root layout.
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// The legal views import these client components (Clerk, router hooks); the existing
// privacy/terms tests mock them the same way. Only the exported constants are needed here.
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

import { NOINDEX_ROUTES, PUBLIC_ROUTES, SITE_URL } from "@/lib/site";
import { PRIVACY_UPDATED } from "@/views/PrivacyPage";
import { TERMS_UPDATED } from "@/views/TermsPage";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { metadata as appLayoutMetadata } from "@/app/app/layout";

const WEB = path.resolve(__dirname, "..");
const APP = path.join(WEB, "app");

/** Every route that has a page.tsx under app/, as the URL path a browser would request. */
function pageRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name === "page.tsx") {
        const rel = path.relative(APP, path.dirname(p)).split(path.sep).filter((seg) => !/^\(.*\)$/.test(seg));
        out.push("/" + rel.join("/"));
      }
    }
  };
  walk(APP);
  return out.map((r) => (r === "/" ? r : r.replace(/\/$/, ""))).sort();
}

/** Google's robots.txt matching: a rule is a URL-path prefix; "*" matches anything; "$" ends the URL. */
function blocks(rule: string, url: string): boolean {
  const anchored = rule.endsWith("$");
  const body = anchored ? rule.slice(0, -1) : rule;
  const pattern = body.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${pattern}${anchored ? "$" : ""}`).test(url);
}

afterEach(() => {
  delete process.env.VERCEL_ENV;
  vi.resetModules();
});

describe("route inventory", () => {
  it("classifies every page route as public or noindex", () => {
    const known = new Set<string>([...PUBLIC_ROUTES, ...NOINDEX_ROUTES]);
    for (const route of pageRoutes()) {
      expect(known.has(route), `${route} is neither in PUBLIC_ROUTES nor in NOINDEX_ROUTES (lib/site.ts)`).toBe(true);
    }
  });

  it("has no route listed twice", () => {
    const all = [...PUBLIC_ROUTES, ...NOINDEX_ROUTES];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("sitemap.xml", () => {
  const entries = sitemap();

  it("lists exactly the public routes, on the public origin", () => {
    expect(entries.map((e) => e.url).sort()).toEqual([...PUBLIC_ROUTES].map((r) => `${SITE_URL}${r}`).sort());
    for (const e of entries) expect(e.url.startsWith(SITE_URL)).toBe(true);
  });

  it("dates only the pages that own an updated date", () => {
    const byUrl = Object.fromEntries(entries.map((e) => [e.url.slice(SITE_URL.length), e]));
    expect(new Date(byUrl["/privacy"].lastModified as Date).toISOString().slice(0, 10)).toBe(PRIVACY_UPDATED.iso);
    expect(new Date(byUrl["/terms"].lastModified as Date).toISOString().slice(0, 10)).toBe(TERMS_UPDATED.iso);
    expect(byUrl["/"].lastModified).toBeUndefined();
    expect(byUrl["/credits"].lastModified).toBeUndefined();
  });

  it("carries no priority or changeFrequency", () => {
    for (const e of entries) {
      expect("priority" in e).toBe(false);
      expect("changeFrequency" in e).toBe(false);
    }
  });
});

describe("robots.txt", () => {
  const productionDisallow = () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    return { r, rules, disallow: ([] as string[]).concat(rules.disallow ?? []) };
  };

  it("in production allows the site, blocks only the API and dev pages, and names the sitemap", () => {
    const { r, rules, disallow } = productionDisallow();
    expect(rules.userAgent).toBe("*");
    expect(rules.allow).toBe("/");
    expect(disallow).toEqual(["/api/", "/dev/"]);
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("never blocks a page crawlers must read: public pages, noindex pages, icons", () => {
    const { disallow } = productionDisallow();
    const mustBeCrawlable = [...PUBLIC_ROUTES, ...NOINDEX_ROUTES, "/apple-icon.png", "/icon.svg", "/favicon.ico"];
    for (const url of mustBeCrawlable) {
      for (const rule of disallow) {
        expect(blocks(rule, url), `robots.txt rule "${rule}" blocks ${url}`).toBe(false);
      }
    }
  });

  it("blocks the API routes", () => {
    const { disallow } = productionDisallow();
    for (const url of ["/api/rewrite", "/api/webhooks/paddle", "/api/cron/purge-guests"]) {
      expect(disallow.some((rule) => blocks(rule, url)), url).toBe(true);
    }
  });

  it("on a Vercel preview lets crawlers in to read the noindex header, and names no sitemap", async () => {
    process.env.VERCEL_ENV = "preview";
    vi.resetModules();
    const { default: previewRobots } = await import("@/app/robots");
    const r = previewRobots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toBeUndefined();
    expect(r.sitemap).toBeUndefined();
    // What keeps the preview out of the index is the header every response carries there.
    const { securityHeaders } = await import("@/lib/csp");
    const robotsHeader = securityHeaders({ consent: false }).at(0)?.headers.find((h) => h.key === "X-Robots-Tag");
    expect(robotsHeader?.value).toBe("noindex, nofollow");
  });
});

describe("noindex", () => {
  it("is set on the /app layout and on the OAuth callback, never on the root layout", () => {
    expect(appLayoutMetadata.robots).toEqual({ index: false, follow: false });
    const sso = fs.readFileSync(path.join(APP, "sso-callback", "page.tsx"), "utf8");
    expect(sso).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    const root = fs.readFileSync(path.join(APP, "layout.tsx"), "utf8");
    expect(root).not.toMatch(/robots\s*:/);
  });

  it("the /app layout renders no DOM of its own", () => {
    const layout = fs.readFileSync(path.join(APP, "app", "layout.tsx"), "utf8");
    expect(layout).toMatch(/return <>\{children\}<\/>;/);
  });
});
