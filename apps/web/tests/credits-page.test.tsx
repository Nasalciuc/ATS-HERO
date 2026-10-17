// The Credits page names what we use from others (scripts/software-credits.mjs,
// components/icon-credits.ts). These checks keep it complete:
// - the open-source list matches package-lock.json (run `npm run credits` after changing dependencies);
// - it has the packages the app runs on and none of the build and test tools;
// - every icon set and the font appear with their licences, and every package with its licence;
// - no payment provider is named before one is chosen.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { HIDDEN, render, softwareCredits } from "@/scripts/software-credits.mjs";
import { SOFTWARE_CREDITS } from "@/components/software-credits";
import { ICON_CREDITS } from "@/components/icon-credits";
import { CreditsContent } from "@/views/CreditsPage";

// Client components with Clerk and router hooks; the page content is what is under test.
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const WEB = path.resolve(__dirname, "..");
const html = renderToStaticMarkup(<CreditsContent />);

describe("credits page", () => {
  it("lists the open-source packages package-lock.json installs to run (npm run credits)", () => {
    const lock = JSON.parse(fs.readFileSync(path.join(WEB, "package-lock.json"), "utf8"));
    const file = fs.readFileSync(path.join(WEB, "components/software-credits.ts"), "utf8");
    expect(file, "out of date: run `npm run credits`").toBe(render(softwareCredits(lock)));
  });

  it("keeps the packages the app runs on and leaves out the build and test tools", () => {
    const names = new Set(SOFTWARE_CREDITS.map((p) => p.name));
    for (const n of ["next", "react", "react-dom", "pdfjs-dist", "@react-pdf/renderer", "docx"]) expect(names, n).toContain(n);
    for (const n of ["vitest", "typescript", "playwright", "tailwindcss"]) expect(names, n).not.toContain(n);
  });

  it("credits every icon set and the font, with their licences", () => {
    for (const c of ICON_CREDITS) {
      expect(html, c.name).toContain(c.name);
      expect(html, c.name).toContain(c.license);
    }
    expect(html).toContain("Inter");
    expect(html).toContain("SIL Open Font License 1.1");
  });

  it("shows every package, and every licence they come under", () => {
    for (const p of SOFTWARE_CREDITS) expect(html, p.name).toContain(`>${p.name}</a>`);
    for (const licence of new Set(SOFTWARE_CREDITS.map((p) => p.license))) expect(html, licence).toContain(`<span>${licence}</span>`);
  });

  it("names no payment provider before one is chosen", () => {
    expect(html).not.toMatch(/paddle|stripe/i);
    // HIDDEN only covers packages that are installed but unused; it must not grow into a way to drop credits.
    expect([...HIDDEN]).toEqual(["@paddle/paddle-node-sdk"]);
  });
});
