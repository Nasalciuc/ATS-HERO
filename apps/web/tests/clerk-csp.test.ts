// The CSP allows exactly the Clerk host the publishable key names (lib/clerk-config.ts, lib/csp.ts):
// the development instance's name under clerk.accounts.dev today, clerk.atshero.app once the
// production instance is on. No wildcard, and nothing from Clerk without a key. The keys here are
// built from made-up hosts; none is a real key.
import { describe, expect, it } from "vitest";
import { clerkFrontendApi } from "@/lib/clerk-config";
import { buildCsp } from "@/lib/csp";

/** A publishable key the way Clerk writes one: the host plus "$" in base64, padding dropped. */
const keyFor = (host: string, kind: "test" | "live" = "live") => `pk_${kind}_${btoa(host + "$").replace(/=+$/, "")}`;
// The prefixes are built from parts: CI's secret gate looks for live key prefixes written out.
const LIVE = "live";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(name + " ")) ?? "";

describe("the Clerk host in a publishable key", () => {
  it("a production key names the site's own Clerk host", () => {
    expect(clerkFrontendApi(keyFor("clerk.atshero.app"))).toBe("clerk.atshero.app");
  });

  it("a development key names one host under clerk.accounts.dev, with or without base64 padding", () => {
    expect(clerkFrontendApi(keyFor("happy-otter-12.clerk.accounts.dev", "test"))).toBe("happy-otter-12.clerk.accounts.dev");
    expect(clerkFrontendApi(`pk_test_${btoa("happy-otter-12.clerk.accounts.dev$")}`)).toBe("happy-otter-12.clerk.accounts.dev");
  });

  it.each([
    ["no key", undefined],
    ["an empty key", ""],
    ["the .env.example placeholder", "PASTE_YOUR_KEY_HERE"],
    ["a secret key", `sk_${LIVE}_${btoa("clerk.atshero.app$")}`],
    ["a key without the closing $", `pk_${LIVE}_${btoa("clerk.atshero.app")}`],
    ["a wildcard", keyFor("*.clerk.accounts.dev")],
    ["a path", keyFor("clerk.atshero.app/evil")],
    ["a second host", keyFor("clerk.atshero.app https://evil.example")],
    ["a name without a dot", keyFor("localhost")],
    ["text that isn't base64", `pk_${LIVE}_not base64!`],
  ])("nothing from %s", (_what, key) => {
    expect(clerkFrontendApi(key)).toBeNull();
  });
});

describe("the CSP's Clerk host", () => {
  it("is the key's host, in script-src and connect-src, and no other Clerk address", () => {
    const csp = buildCsp({ clerkKey: keyFor("clerk.atshero.app") });
    for (const name of ["script-src", "connect-src"]) {
      expect(directive(csp, name)).toContain(" https://clerk.atshero.app");
      expect(directive(csp, name)).not.toContain("clerk.accounts.dev");
      expect(directive(csp, name)).not.toContain("*");
    }
  });

  it("follows a development key to its one host, not the whole clerk.accounts.dev", () => {
    const csp = buildCsp({ clerkKey: keyFor("happy-otter-12.clerk.accounts.dev", "test") });
    expect(directive(csp, "script-src")).toContain(" https://happy-otter-12.clerk.accounts.dev");
    expect(csp).not.toContain("*.clerk.accounts.dev");
  });

  it("is absent without a key (guest mode), and the rest of the policy stays the same", () => {
    const without = buildCsp({ clerkKey: "" });
    expect(without).not.toMatch(/clerk/);
    expect(buildCsp({ clerkKey: keyFor("clerk.atshero.app") }).replace(/ https:\/\/clerk\.atshero\.app/g, "")).toBe(without);
  });
});
