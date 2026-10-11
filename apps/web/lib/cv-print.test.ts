import { describe, it, expect } from "vitest";
import { printableCv, displayUrl, textWidth, fitFontSize } from "./cv-print";
import { emptyCvData, type CvData } from "./types";

const blankWork = { id: "w0", role: "", company: "", description: "", startDate: "", endDate: "", current: true, country: "", cityState: "Berlin" };
const realWork = { ...blankWork, id: "w1", role: "Frontend Engineer" };

describe("printableCv", () => {
  it("drops entries the user added but never filled", () => {
    const d: CvData = {
      ...emptyCvData(),
      work: [blankWork, realWork],
      education: [{ id: "e0", institution: "", location: "Cluj", degree: "", minor: "", startDate: "2020", endDate: "", grade: "", additional: "" }],
      languages: [{ id: "l0", name: "  ", level: "B2" }, { id: "l1", name: "English", level: "C1" }],
      awards: [{ id: "a0", title: "", description: "", date: "2024" }],
      certifications: [{ id: "c0", title: "", description: "", date: "", issuer: "AWS" }],
    };
    const out = printableCv(d);
    expect(out.work.map((w) => w.id)).toEqual(["w1"]);
    expect(out.education).toEqual([]); // only location/dates — nothing to print
    expect(out.languages.map((l) => l.name)).toEqual(["English"]); // no lone "(B2)"
    expect(out.awards).toEqual([]);
    expect(out.certifications.map((c) => c.id)).toEqual(["c0"]); // issuer alone is content
  });

  it("never mutates the editing buffer", () => {
    const d: CvData = { ...emptyCvData(), work: [blankWork, realWork] };
    printableCv(d);
    expect(d.work).toHaveLength(2);
  });
});

describe("displayUrl", () => {
  it.each([
    ["https://www.linkedin.com/in/anapopescu/", "linkedin.com/in/anapopescu"],
    ["http://anapopescu.dev", "anapopescu.dev"],
    ["  WWW.Example.com/a  ", "Example.com/a"],
    ["github.com/ana", "github.com/ana"],
    ["Cluj-Napoca", "Cluj-Napoca"],
  ])("%s → %s", (input, expected) => {
    expect(displayUrl(input)).toBe(expected);
  });
});

describe("textWidth / fitFontSize", () => {
  it("measures Inter exactly (fontkit reference: 200.0pt at 9pt)", () => {
    expect(textWidth("mihai.stefanescu.dev@example-company.com", 9)).toBeCloseTo(200.0, 1);
  });

  it("keeps the base size when the token fits", () => {
    expect(fitFontSize("ana.popescu@example.com", 153)).toBe(9);
  });

  it("shrinks a long token to fit one line instead of wrapping it", () => {
    const size = fitFontSize("mihai.stefanescu.dev@example-company.com", 153);
    expect(size).toBeLessThan(9);
    expect(size).toBeGreaterThanOrEqual(6.5);
    expect(textWidth("mihai.stefanescu.dev@example-company.com", size)).toBeLessThanOrEqual(153);
  });

  it("never goes below the floor (the pre-flight check handles the rest)", () => {
    expect(fitFontSize("linkedin.com/in/" + "x".repeat(80), 153)).toBe(6.5);
  });
});
