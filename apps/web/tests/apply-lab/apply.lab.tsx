// The apply lab: the apply engine (lib/apply) in a real browser, through agent-browser, on synthetic
// application forms (tools/apply-lab/forms) served on localhost, with the ATS lab's synthetic persona.
// Never a real employer (AGENTS.md rule 11). Run: npm run apply-lab (it needs agent-browser and Chrome,
// see vitest.apply-lab.config.ts). CI: .github/workflows/apply-lab.yml.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { getTemplate } from "@/components/cv/templates";
import { resolveTheme } from "@/components/cv/templates/theme";
import { hyphenationCallback, resetGlyphCache } from "@/components/cv/templates/fonts";
import { printableCv } from "@/lib/cv-print";
import { applyProfile } from "@/lib/apply/profile";
import { prepareApplication, submitApplication, type Prepared } from "@/lib/apply/engine";
import type { Answers, ApplyPlan } from "@/lib/apply/plan";
import type { CvData } from "@/lib/types";

const FORMS = path.join(process.cwd(), "../../tools/apply-lab/forms");
const personas = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "../../tools/ats-lab/fixtures/personas.json"), "utf8"),
) as Record<string, CvData>;
const ana = personas.ana;
const profile = applyProfile(ana);

let server: http.Server;
let base = "";
let cvPdfPath = "";

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(FORMS, path.basename(new URL(req.url ?? "/", "http://x").pathname));
    if (!file.startsWith(FORMS) || !fs.existsSync(file)) return res.writeHead(404).end();
    const type = file.endsWith(".js") ? "text/javascript" : "text/html";
    res.writeHead(200, { "content-type": `${type}; charset=utf-8` }).end(fs.readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // Ana's CV as the app renders it (renderCvPdfBlob's steps: printableCv, the template, its theme, a
  // fresh glyph cache), to a buffer, with the fonts from disk as every test that renders a PDF does.
  Font.register({ family: "CvSans", src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf") });
  Font.register({ family: "CvSansBold", src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf") });
  Font.registerHyphenationCallback(hyphenationCallback);
  resetGlyphCache();
  const { component: Template } = getTemplate("classic");
  const pdf = await renderToBuffer(<Template data={printableCv(ana)} theme={resolveTheme("classic", 1)} />);
  cvPdfPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ats-hero-apply-cv-")), "Ana_Popescu.pdf");
  fs.writeFileSync(cvPdfPath, pdf);
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const prepare = (form: string) => prepareApplication({ url: `${base}/${form}`, profile, cvPdfPath, allowLocal: true });

function ready(r: Prepared) {
  if (r.status !== "ready") throw new Error(`expected a filled form, got ${JSON.stringify(r)}`);
  return r;
}

/** The person's answers, by label: what they would type on our review screen. */
function answer(plan: ApplyPlan, byLabel: Record<string, string | boolean>): Answers {
  const out: Answers = {};
  for (const item of plan.person) {
    const key = Object.keys(byLabel).find((k) => item.label.toLowerCase().includes(k.toLowerCase()));
    if (key !== undefined) out[item.id] = byLabel[key];
  }
  return out;
}

/** What the synthetic employer received, as the page shows it after the submit. */
function received(pageText: string): Record<string, unknown> {
  const m = pageText.match(/RECEIVED (\{[\s\S]*?\}) END/);
  if (!m) throw new Error(`no confirmation in: ${pageText.slice(0, 300)}`);
  return JSON.parse(m[1]);
}

describe("Greenhouse-style: one page, a visible file input, a second file input for a cover letter", () => {
  it("fills, attaches the CV to the right input, waits for the person, then sends", async () => {
    const r = ready(await prepare("greenhouse.html"));
    expect(r.resumeAttached).toBe(true);
    expect(fs.statSync(r.screenshot).size).toBeGreaterThan(10_000);
    expect(r.plan.fill.map((f) => f.label)).toEqual(["First Name", "Last Name", "Email", "Phone", "LinkedIn Profile", "Website"]);
    expect(r.plan.choose).toEqual([expect.objectContaining({ label: "How did you hear about this job?", option: "Job board" })]);
    expect(r.plan.person.filter((p) => p.sensitive).map((p) => p.label)).toEqual([
      "Are you legally authorized to work in the European Union?",
      "Will you now or in the future require visa sponsorship?",
      "Desired salary (EUR, gross per year)",
      "Gender (voluntary)",
    ]);

    const s = await submitApplication(r.session, {
      confirmedByPerson: true,
      // the person answers the two questions and leaves the salary and the survey empty, on purpose
      answers: answer(r.plan, { "legally authorized": "Yes", sponsorship: "No", salary: "", gender: "" }),
    });
    expect(s.status).toBe("sent");
    if (s.status !== "sent") return;
    const got = received(s.pageText);
    expect(got).toMatchObject({
      first_name: "Ana",
      last_name: "Popescu",
      email: profile.email,
      phone: profile.phone,
      linkedin: profile.linkedin,
      website: profile.website,
      resume: "Ana_Popescu.pdf",
      cover_letter_file: "",
      work_auth: "Yes",
      sponsorship: "No",
      source: "Job board",
      salary: "",
      gender: "",
    });
    expect(JSON.stringify(got)).not.toMatch(/BANANA/i);
  }, 90_000);
});

describe("Lever-style: the CV behind an ATTACH button, links, an EEO survey and a consent box", () => {
  it("leaves the survey and the consent to the person, and sends only with the consent given", async () => {
    const r = ready(await prepare("lever.html"));
    expect(r.resumeAttached).toBe(true);
    expect(r.plan.fill.map((f) => [f.label, f.field])).toEqual([
      ["Full name", "fullName"],
      ["Email", "email"],
      ["Phone", "phone"],
      ["Current location", "location"],
      ["Current company", "currentCompany"],
      ["LinkedIn URL", "linkedin"],
      ["Portfolio URL", "website"],
    ]);
    expect(r.plan.person.map((p) => [p.label, p.sensitive])).toEqual([
      ["GitHub URL", false],
      ["Additional information", false],
      ["Gender", true],
      ["Race", true],
      ["Veteran status", true],
      ["I consent to Nordwind processing my data for this application", true],
    ]);

    // until the person goes through the survey and the consent nothing is clicked, and the browser
    // stays open for them
    const blocked = await submitApplication(r.session, { confirmedByPerson: true, answers: answer(r.plan, { "I consent": true }) });
    expect(blocked.status).toBe("blocked");
    if (blocked.status === "blocked") expect(blocked.missing.map((m) => m.label)).toEqual(["Gender", "Race", "Veteran status"]);

    const s = await submitApplication(r.session, {
      confirmedByPerson: true,
      answers: answer(r.plan, { "I consent": true, gender: "", race: "", veteran: "" }),
    });
    expect(s.status).toBe("sent");
    if (s.status !== "sent") return;
    expect(received(s.pageText)).toMatchObject({
      name: "Ana Popescu",
      email: profile.email,
      location: profile.location,
      org: profile.currentCompany,
      resume: "Ana_Popescu.pdf",
      "urls[GitHub]": "",
      eeo_gender: "",
      eeo_race: "",
      eeo_veteran: "",
      consent: true,
    });
  }, 90_000);
});

describe("Ashby-style: values kept in the page's own state, radio questions", () => {
  it("reaches the page's state through real input events; the person answers both questions", async () => {
    const r = ready(await prepare("ashby.html"));
    expect(r.resumeAttached).toBe(true);
    expect(r.plan.person.map((p) => [p.kind, p.label, p.sensitive, p.required, p.options])).toEqual([
      ["radio", "Are you legally authorized to work in Romania?", true, true, ["Yes", "No"]],
      ["radio", "Are you open to a hybrid schedule (two office days a week)?", false, true, ["Yes", "No"]],
    ]);

    const s = await submitApplication(r.session, {
      confirmedByPerson: true,
      answers: answer(r.plan, { "legally authorized": "Yes", "hybrid schedule": "Yes" }),
    });
    expect(s.status).toBe("sent");
    if (s.status !== "sent") return;
    expect(received(s.pageText)).toEqual({
      name: "Ana Popescu",
      email: profile.email,
      phone: profile.phone,
      resume: "Ana_Popescu.pdf",
      auth: "Yes",
      hybrid: "Yes",
      source: "Job board",
    });
  }, 90_000);
});

describe("a CAPTCHA challenge", () => {
  it("is handed to the person before anything is filled", async () => {
    const r = await prepare("captcha.html");
    expect(r).toMatchObject({ status: "handoff", reason: "captcha" });
  }, 60_000);
});
