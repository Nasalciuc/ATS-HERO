// The screen names no ATS or parser vendor (Scaler, 2 Nov 2026): the ATS check's findings, its notes,
// "How we check" and the Job Fit note say "resume parsers" or "some ATSs". The vendors stay where
// people who maintain the texts need them: comments, the never-shown sources in score.ts, the parser
// codes in levels.ts and the Project documents.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const VENDORS = /textkernel|rchilli|hiredscore|workday|workable|teamtailor|greenhouse|taleo|icims|oracle|successfactors|smartrecruiters|affinda|sovren|lever's/i;

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

/** The code without its comments (a `//` after a colon is a URL inside a string, not a comment). */
function withoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:"'])\/\/.*$/gm, "$1");
}

describe("no vendor names on the screen", () => {
  it("in the ATS check's findings and notes", () => {
    const src = withoutComments(read("lib/ats-read/score.ts"))
      // the sources: kept for whoever maintains the texts, never rendered
      .replace(/(?:export )?const [A-Z_]+ = \{\s*label:[^}]*\};/g, "")
      .replace(/source: [^,\n]+,?/g, "")
      // finding codes are ids, not text
      .replace(/code: "[a-z_]+"/g, "");
    expect(src).not.toMatch(VENDORS);
  });

  it("in the levels' notes on where we differ from the parsers", () => {
    const deviations = [...read("lib/ats-read/levels.ts").matchAll(/deviation: "([^"]*)"/g)].map((m) => m[1]);
    expect(deviations.length).toBeGreaterThan(0);
    for (const d of deviations) expect(d).not.toMatch(VENDORS);
  });

  it("on the score page: findings, notes, How we check, the Job Fit note", () => {
    const src = withoutComments(read("views/ScorePage.tsx"));
    expect(src).not.toMatch(VENDORS);
    // the sources and the parser codes aren't rendered
    expect(src).not.toMatch(/\.source\b|Parser codes|refLine/);
  });

  it("in Job Fit's messages", () => {
    expect(withoutComments(read("lib/job-fit.ts"))).not.toMatch(VENDORS);
  });
});
