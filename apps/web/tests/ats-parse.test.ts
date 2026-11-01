// The browser's parser (lib/ats-read/parse.ts) must give the lab parser's answers
// (apps/ai/app/lab/parser.py). Both run every case in tools/ats-lab/parity/cases.jsonl:
// texts from the lab's synthetic people and the Word-style corpus, read by six PDF and three
// DOCX readers, plus hand-written edge cases. Regenerate with `python -m app.lab.parity --write`.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { entryParts, monthOf, monthsOfExperience, parse, splitLines, type Block } from "@/lib/ats-read/parse";

interface Case {
  id: string;
  text: string;
  expected: Record<string, unknown>;
}
const CASES = path.join(process.cwd(), "../../tools/ats-lab/parity/cases.jsonl");
const rows: Case[] = fs
  .readFileSync(CASES, "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

function expected(text: string) {
  const p = parse(text);
  return {
    name: p.name,
    emails: p.emails,
    phones: p.phones,
    linkedin: p.linkedin,
    sections: p.sections,
    experience: p.experience,
    education: p.education,
    skills: p.skills,
    ligatures: p.ligatures,
  };
}

describe("parity with the lab parser", () => {
  it("has the cases", () => expect(rows.length).toBeGreaterThanOrEqual(100));
  for (const row of rows) {
    it(row.id, () => expect(expected(row.text)).toEqual(row.expected));
  }
});

describe("Python's splitlines", () => {
  it("drops one final line break and splits on \\r\\n, \\r and the Unicode separators", () => {
    expect(splitLines("")).toEqual([]);
    expect(splitLines("a\n")).toEqual(["a"]);
    expect(splitLines("a\n\n")).toEqual(["a", ""]);
    expect(splitLines("a\r\nb\rc d")).toEqual(["a", "b", "c", "d"]);
  });
});

const block = (text: string, start = "2020", end = "2021"): Block => ({ start, end, text });

describe("title and company of an entry", () => {
  it.each([
    ["Data Analyst, Moldcell, June 2018 – February 2021\n• Built dashboards", "Data Analyst", "Moldcell"],
    ["Data Analyst at Moldcell\nJune 2018 – February 2021", "Data Analyst", "Moldcell"],
    ["Senior Data Analyst @ Orange Moldova (Mar '21 – now)", "Senior Data Analyst", "Orange Moldova"],
    [
      "Reco, Leader in Dynamic SaaS Security​\nChisinau, Remote\nSenior Go Developer & Researcher​\nOct. 2025 – now\n- Own 35+ integrations.",
      "Senior Go Developer & Researcher",
      "Reco",
    ],
    ["Frontend Engineer September 2021 – Present\nFintech Labs SRL Cluj-Napoca, Romania\n• Led the migration.", "Frontend Engineer", "Fintech Labs SRL Cluj-Napoca"],
  ])("%j", (text, title, company) => {
    expect(entryParts(block(text))).toEqual({ title, company });
  });
});

describe("years of experience from the dates", () => {
  const today = new Date(2026, 10, 1); // 1 Nov 2026
  it("reads month names, numeric months, bare years and 'now'", () => {
    expect(monthOf("Oct. 2025", "start", today)).toBe(2025 * 12 + 9);
    expect(monthOf("09/2021", "start", today)).toBe(2021 * 12 + 8);
    expect(monthOf("2019", "start", today)).toBe(2019 * 12);
    expect(monthOf("2019", "end", today)).toBe(2019 * 12 + 11);
    expect(monthOf("now", "end", today)).toBe(2026 * 12 + 10);
  });
  it("counts overlapping jobs once, end month included", () => {
    const jobs = [block("", "May 2023", "Now"), block("", "Aug 2023", "Mar 2024"), block("", "Oct. 2025", "now")];
    expect(monthsOfExperience(jobs, today)).toBe(43); // May 2023 – Nov 2026
    expect(monthsOfExperience([block("", "June 2018", "February 2021")], today)).toBe(33);
  });
});
