// The Terms quote facts that live in the code and on the Privacy Policy. These checks keep them in
// step (AGENTS.md, rule 11, "Terms page"):
// - the guest retention, the minimum age and the way to delete an account match the Privacy Policy;
// - who runs ATS Hero and the addresses come from lib/legal.ts, as on the Privacy Policy;
// - the "updated" date is a fixed constant;
// - the page says ATS Hero is free, and no page opens the plan window yet;
// - no payment provider is named before one is chosen.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { GUEST_RETENTION_DAYS } from "@/lib/retention";
import { OPERATOR, PRIVACY_EMAIL, SUPPORT_EMAIL } from "@/lib/legal";
import { TermsContent, TERMS_UPDATED } from "@/views/TermsPage";
import { PrivacyContent } from "@/views/PrivacyPage";

// Client components with Clerk and router hooks; the page content is what is under test.
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const WEB = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(WEB, rel), "utf8");
const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

const termsHtml = renderToStaticMarkup(<TermsContent />);
const terms = plain(termsHtml);
const privacy = plain(renderToStaticMarkup(<PrivacyContent />));

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
  return out;
}

describe("terms page", () => {
  it("quotes the guest retention the purge cron deletes by", () => {
    expect(terms).toContain(`${GUEST_RETENTION_DAYS} days after its last edit`);
  });

  it("sets the same minimum age as the Privacy Policy", () => {
    expect(privacy).toContain("aged 16 and over");
    expect(terms).toContain("You must be 16 or older");
  });

  it("names the same operator and addresses as the Privacy Policy", () => {
    for (const s of [OPERATOR.name, OPERATOR.address]) {
      expect(terms, s).toContain(s);
      expect(privacy, s).toContain(s);
    }
    expect(terms).toContain(SUPPORT_EMAIL);
    expect(terms).toContain(PRIVACY_EMAIL);
  });

  it("explains deleting an account the way the Privacy Policy does", () => {
    const steps = "Your CVs → type DELETE → Delete my account";
    expect(privacy).toContain(steps);
    expect(terms).toContain(steps);
  });

  it("shows a fixed date that matches its label, never one computed on each build", () => {
    expect(termsHtml).toMatch(new RegExp(`<time datetime="${TERMS_UPDATED.iso}">${TERMS_UPDATED.label}</time>`, "i"));
    const label = new Date(`${TERMS_UPDATED.iso}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    expect(TERMS_UPDATED.label).toBe(label);
    expect(read("views/TermsPage.tsx")).not.toMatch(/new Date\(|Date\.now\(/);
  });

  it("says ATS Hero is free, and no page opens the plan window yet", () => {
    expect(terms).toContain("ATS Hero is free while it is in beta");
    // The day a page opens the plan window, payments start: the price and the payment and refund
    // terms go on this page first.
    const opened = appFiles().filter((f) => /<PlanModal\b/.test(fs.readFileSync(f, "utf8")));
    expect(opened.map((f) => path.relative(WEB, f))).toEqual([]);
  });

  it("names no payment provider before one is chosen", () => {
    expect(terms).not.toMatch(/paddle|stripe/i);
    expect(privacy).not.toMatch(/paddle|stripe/i);
  });
});
