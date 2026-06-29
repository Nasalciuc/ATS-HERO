/**
 * Visual audit — captures app pages at Figma desktop width (1728px).
 * Run: node scripts/playwright-audit.mjs
 * Requires: dev server on BASE_URL (default http://localhost:3000)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "tests", "screenshots", "audit-v8");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const W = 1728;
const H = 1100;

const SAMPLE_CV = `David Smith
Investment Analyst
Email: david@example.com
Phone: +1 234 567 890
Experience: Analyst at Goldman Sachs 2020-2024
Skills: Excel, Financial Modeling, Python`;

const SAMPLE_JD = `Investment Analyst role requiring financial modeling, Excel, valuation, and Python experience.`;

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("  ✓", name);
  return file;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();

  console.log(`Auditing ${BASE} @ ${W}px → ${OUT}\n`);

  // 404
  await page.goto(`${BASE}/orice-gresit`, { waitUntil: "networkidle" });
  await shot(page, "404-notfound");

  // Improve
  await page.goto(`${BASE}/app/improve`, { waitUntil: "networkidle" });
  await shot(page, "improve-cv");

  // Job fit
  await page.goto(`${BASE}/app/jobfit`, { waitUntil: "networkidle" });
  await shot(page, "jobfit");

  // Create — personal info
  await page.goto(`${BASE}/app/create`, { waitUntil: "networkidle" });
  await shot(page, "create-personal-info");

  // Create — skills with sample tags (matches Figma chips)
  const skillsBtn = page.locator(".progress__step").filter({ hasText: "Skills" }).locator(".progress__node");
  if (await skillsBtn.count()) {
    await skillsBtn.click();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const key = "ats_hero_demo_skills";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(
          key,
          JSON.stringify({
            skills: ["Typography", "Creative coding"],
            softSkills: ["Collaboration", "Adaptability"],
            instruments: ["Figma", "Webflow"],
            languages: [{ id: "1", name: "French", level: "B2" }],
          })
        );
      }
    });
    await shot(page, "create-skills");
  }

  // Create — awards via Add section (multiple optional = full stepper like Figma)
  const addSectionBtn = page.getByRole("button", { name: "Add section" });
  if (await addSectionBtn.isVisible()) {
    await addSectionBtn.click();
    await page.waitForTimeout(300);
    for (const label of ["Relevant activities", "Awards", "Certifications", "Publications"]) {
      const btn = page.locator(".addsection__check").filter({ hasText: label });
      if (await btn.count()) await btn.click();
    }
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForTimeout(500);
    const awardsNode = page.locator(".progress__step").filter({ hasText: "Awards" }).locator(".progress__node");
    if (await awardsNode.count()) {
      await awardsNode.click();
      await page.waitForTimeout(300);
      await shot(page, "create-awards");
    }
    const certNode = page.locator(".progress__step").filter({ hasText: "Certifications" }).locator(".progress__node");
    if (await certNode.count()) {
      await certNode.click();
      await page.waitForTimeout(300);
      await shot(page, "create-certifications");
    }
  }

  // Score loading — create flow (no cache; UI min loading time)
  await page.evaluate(() => {
    sessionStorage.removeItem("ats_report");
    sessionStorage.removeItem("ats_jobfit");
    sessionStorage.setItem("ats_flow", "create");
  });
  await page.goto(`${BASE}/app/score`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await shot(page, "score-loading-create");

  // Score loading — improve flow (seed cache, min loading display)
  await page.evaluate(
    ({ cv, report }) => {
      sessionStorage.setItem("ats_flow", "improve");
      sessionStorage.setItem("ats_report", report);
      sessionStorage.removeItem("ats_jobfit");
      sessionStorage.setItem(`ats_improve_cv`, cv);
    },
    {
      cv: SAMPLE_CV,
      report: JSON.stringify({
        generalScore: 61.3,
        message: "Your resume has a few critical issues.",
        sections: [
          {
            key: "personalInfo",
            label: "Personal info",
            score: 80,
            entryScore: 80.2,
            critical: ["Missing phone format"],
            suggestions: ["Add LinkedIn"],
            goodPractices: ["Clear name"],
          },
        ],
      }),
    }
  );
  await page.goto(`${BASE}/app/score`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await shot(page, "score-loading-improve");

  // Score results — create (wait for API or use cache)
  await page.evaluate(
    ({ report }) => {
      sessionStorage.setItem("ats_flow", "create");
      sessionStorage.setItem("ats_report", report);
    },
    {
      report: JSON.stringify({
        generalScore: 61.3,
        message: "Your resume has a few critical issues, along with suggestions to help improve your chances of getting hired.",
        sections: [
          {
            key: "personalInfo",
            label: "Personal info",
            score: 80,
            entryScore: 80.2,
            critical: ["Missing or unclear role descriptions"],
            suggestions: ["Add keywords relevant to your target role"],
            goodPractices: ["Clear role and organization information"],
          },
          {
            key: "education",
            label: "Education",
            score: 30,
            entryScore: 30,
            critical: [],
            suggestions: [],
            goodPractices: [],
          },
        ],
      }),
    }
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await shot(page, "score-results-create");

  // Score results — improve flow
  await page.evaluate(() => sessionStorage.setItem("ats_flow", "improve"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await shot(page, "score-results-improve");

  // Expand first row + fix now
  const toggle = page.locator(".score-row__toggle").first();
  if (await toggle.count()) {
    await toggle.click();
    await page.waitForTimeout(200);
    await shot(page, "score-results-expanded");
    const fixBtn = page.getByRole("button", { name: "Fix now" });
    if (await fixBtn.isVisible()) {
      await fixBtn.click();
      await page.waitForTimeout(300);
      await shot(page, "score-results-fixnow");
    }
  }

  await browser.close();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
