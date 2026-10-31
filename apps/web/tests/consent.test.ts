// The cookie banner (AGENTS.md rule 3 exception, rule 11, MARKETING-CE-FACEM M-1 and M-5):
// - it exists only on the public pages (the sitemap's list) and never in /app, /api or /dev;
// - nothing is on before the visitor chooses, and a choice can only ever grant analytics, never ads;
// - the choice is two equal buttons, no pre-ticked box;
// - the first layer asks in plain words and names no tool; the settings layer names the provider;
// - the banner's CSS is scoped to #cc-main and cannot restyle the rest of the site;
// - without a GTM container ID there is no banner at all.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NOINDEX_ROUTES, PUBLIC_ROUTES } from "@/lib/site";
import {
  CATEGORY_ANALYTICS,
  CATEGORY_NECESSARY,
  CONSENT_COOKIE,
  CONSENT_DAYS,
  CONSENT_MODE_DENIED,
  consentConfig,
  consentEnabled,
  consentModeFor,
  isConsentRoute,
} from "@/lib/consent";

const WEB = path.resolve(__dirname, "..");

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? filesUnder(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

describe("where the banner shows", () => {
  it("shows on every public route", () => {
    for (const route of PUBLIC_ROUTES) expect(isConsentRoute(route), route).toBe(true);
  });

  it("never shows in the app, the OAuth callback, the API or the dev pages", () => {
    const outside = [...NOINDEX_ROUTES, "/api/rewrite", "/api/health", "/dev/anything", "/app/create/step-2"];
    for (const route of outside) expect(isConsentRoute(route), route).toBe(false);
  });

  it("is imported by the root providers and by nothing under /app", () => {
    const importers = filesUnder(path.join(WEB, "app"))
      .filter((f) => /ConsentBanner|vanilla-cookieconsent/.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(WEB, f).replaceAll("\\", "/"));
    expect(importers).toEqual(["app/providers.tsx"]);
  });
});

describe("the banner's CSS", () => {
  const css = fs.readFileSync(path.join(WEB, "app/styles.css"), "utf8");
  const start = css.indexOf("COOKIE CONSENT (public pages only");
  const section = css.slice(css.lastIndexOf("/*", start)).replace(/\/\*[\s\S]*?\*\//g, "");

  it("exists, and is the last section of styles.css", () => {
    expect(start).toBeGreaterThan(0);
    expect(section).toContain("--cc-btn-border-radius");
  });

  it("only styles things inside #cc-main, so nothing else on the site changes", () => {
    const selectors = [...section.matchAll(/([^{};]+)\{/g)]
      .map((m) => m[1].trim())
      .filter((s) => s && !s.startsWith("@"))
      .flatMap((s) => s.split(",").map((x) => x.trim()));
    expect(selectors.length).toBeGreaterThan(20);
    const strays = selectors.filter((s) => !/^html(\.show--consent)? #cc-main\b/.test(s));
    expect(strays).toEqual([]);
  });
});

describe("no GTM container, no banner", () => {
  it("is off without an ID, with an empty ID and with a blank one", () => {
    expect(consentEnabled(undefined)).toBe(false);
    expect(consentEnabled("")).toBe(false);
    expect(consentEnabled("   ")).toBe(false);
  });
  it("is on once an ID is set", () => {
    expect(consentEnabled("GTM-ABC1234")).toBe(true);
  });
});

describe("Google Consent Mode v2", () => {
  it("starts with all four keys denied", () => {
    expect(Object.keys(CONSENT_MODE_DENIED).sort()).toEqual(
      ["ad_personalization", "ad_storage", "ad_user_data", "analytics_storage"],
    );
    expect(new Set(Object.values(CONSENT_MODE_DENIED))).toEqual(new Set(["denied"]));
  });

  it("stays denied after Reject", () => {
    expect(consentModeFor([CATEGORY_NECESSARY])).toEqual(CONSENT_MODE_DENIED);
    expect(consentModeFor([])).toEqual(CONSENT_MODE_DENIED);
  });

  it("grants only analytics after Accept: the site runs no ads", () => {
    expect(consentModeFor([CATEGORY_NECESSARY, CATEGORY_ANALYTICS])).toEqual({
      ...CONSENT_MODE_DENIED,
      analytics_storage: "granted",
    });
  });
});

describe("the banner's configuration", () => {
  const config = consentConfig();
  const en = config.language.translations.en as {
    consentModal: Record<string, string | undefined>;
    preferencesModal: { sections: { linkedCategory?: string }[] };
  };

  it("keeps the choice in a first-party cookie for 182 days", () => {
    expect(config.cookie).toMatchObject({ name: CONSENT_COOKIE, expiresAfterDays: CONSENT_DAYS });
    expect(CONSENT_COOKIE).toBe("cc_cookie");
    expect(CONSENT_DAYS).toBe(182);
  });

  it("offers two equal buttons, Allow and Decline, and nothing pre-ticked", () => {
    expect(config.guiOptions?.consentModal?.equalWeightButtons).toBe(true);
    expect(config.guiOptions?.preferencesModal?.equalWeightButtons).toBe(true);
    expect(en.consentModal.acceptAllBtn).toBe("Allow");
    expect(en.consentModal.acceptNecessaryBtn).toBe("Decline");
    expect(en.consentModal.showPreferencesBtn).toBeUndefined();
    expect(config.categories?.[CATEGORY_ANALYTICS]?.enabled).toBe(false);
    expect(config.categories?.[CATEGORY_NECESSARY]).toMatchObject({ enabled: true, readOnly: true });
  });

  it("asks in plain words on the first layer and names no tool there", () => {
    const first = [en.consentModal.title, en.consentModal.description, en.consentModal.acceptAllBtn, en.consentModal.acceptNecessaryBtn].join(" ");
    expect(first).not.toMatch(/google|analytics|tag manager|gtm|ga4|cookie/i);
    expect(en.consentModal.description).toMatch(/analyze your usage data to improve your experience/i);
    expect(en.consentModal.description).toMatch(/nothing is measured unless you allow it/i);
    expect(en.consentModal.description).toContain('href="/privacy"');
  });

  it("names the provider one layer down, in the settings (AGENTS.md rule 11)", () => {
    const sections = (config.language.translations.en as { preferencesModal: { sections: { description?: string }[] } }).preferencesModal.sections;
    expect(sections.map((s) => s.description).join(" ")).toMatch(/Google Analytics/);
  });

  it("explains both categories in the settings", () => {
    const linked = en.preferencesModal.sections.map((s) => s.linkedCategory).filter(Boolean);
    expect(linked).toEqual([CATEGORY_NECESSARY, CATEGORY_ANALYTICS]);
  });

  it("removes Google's cookies when analytics is rejected", () => {
    const cookies = config.categories?.[CATEGORY_ANALYTICS]?.autoClear?.cookies ?? [];
    const names = (n: string) => cookies.some((c) => (c.name instanceof RegExp ? c.name.test(n) : c.name === n));
    expect(names("_ga")).toBe(true);
    expect(names("_ga_ABC1234XYZ")).toBe(true);
    expect(names("_gid")).toBe(true);
    expect(names("cc_cookie")).toBe(false);
    expect(names("__session")).toBe(false);
  });
});
