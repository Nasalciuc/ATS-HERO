import { describe, expect, it } from "vitest";
import { cvToText, emptyCvData } from "@/lib/types";
import { jobFit } from "@/lib/job-fit";

// a synthetic person
function cv() {
  const d = emptyCvData();
  d.personalInfo.name = "Ana Popescu";
  d.personalInfo.email = "ana@example.com";
  d.summary.position = "Data Analyst";
  d.skills = ["SQL", "Python"];
  d.instruments = ["Excel"];
  d.work = [
    { id: "w1", role: "Data Analyst", company: "Lumen Retail", description: "Reports in SQL and Python.", startDate: "March 2021", endDate: "", current: true, country: "Romania", cityState: "Bucharest" },
    { id: "w2", role: "Junior Analyst", company: "Orbit Bank", description: "Excel reports.", startDate: "2019", endDate: "2021", current: false, country: "", cityState: "" },
  ];
  d.education = [{ id: "e1", institution: "ASE Bucharest", location: "", degree: "BSc Statistics", minor: "", startDate: "2015", endDate: "2019", grade: "", additional: "" }];
  return d;
}

describe("cvToText", () => {
  it("lays the CV out under headings, each job with its company and dates", () => {
    const t = cvToText(cv());
    expect(t).toContain("EXPERIENCE\nData Analyst\nLumen Retail · March 2021 – Present · Bucharest · Romania\nReports in SQL and Python.");
    expect(t).toContain("Junior Analyst\nOrbit Bank · 2019 – 2021");
    expect(t).toContain("SKILLS\nSQL, Python, Excel");
    expect(t).toContain("EDUCATION\nBSc Statistics\nASE Bucharest · 2015 – 2019");
    expect(t).not.toMatch(/\n\n\n/);
    expect(t).not.toContain("AWARDS");
  });

  it("lets Job Fit count a builder CV's years from its jobs' dates", () => {
    const r = jobFit(cvToText(cv()), "Requirements:\nSQL\n3+ years in a data role", new Date("2026-11-03T00:00:00Z"));
    const years = r.requirements.find((q) => q.kind === "years");
    expect(years?.status).toBe("met");
    expect(r.required).toEqual({ met: 2, total: 2 });
  });

  it("gives an empty CV no headings", () => {
    expect(cvToText(emptyCvData())).toBe("");
  });
});
