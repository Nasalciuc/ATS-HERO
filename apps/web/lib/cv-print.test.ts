import { describe, it, expect } from "vitest";
import { printableCv, displayUrl, textWidth, fitFontSize, fitWordsFontSize, breakLongWords, BREAK, telHref, webHref, descLines } from "./cv-print";
import { hyphenationCallback } from "@/components/cv/templates/fonts";
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
    // a LinkedIn share link loses its tracking tail; other sites keep theirs
    ["https://www.linkedin.com/in/ana-popescu?utm_source=share&utm_medium=member_android", "linkedin.com/in/ana-popescu"],
    ["ro.linkedin.com/in/ana-popescu/#experience", "ro.linkedin.com/in/ana-popescu"],
    ["https://ana.dev/work?id=3", "ana.dev/work?id=3"],
  ])("%s → %s", (input, expected) => {
    expect(displayUrl(input)).toBe(expected);
  });
});

describe("descLines", () => {
  it("one bullet per line, without the marker pasted in front", () => {
    expect(descLines("• Led a team\n- Built X\n▪ Shipped Y\n✓ Cut Z\n\uF0B7 From Word\n  \n➤ ✓ Twice")).toEqual(
      ["Led a team", "Built X", "Shipped Y", "Cut Z", "From Word", "Twice"],
    );
    expect(descLines("Reduced costs by 40% - in 2023")).toEqual(["Reduced costs by 40% - in 2023"]);
  });
});

describe("links in the PDF", () => {
  it.each([
    ["+373 69 123 456", "tel:+37369123456"],
    ["+44 (0) 20 7946 0958 ext. 12345", "tel:+442079460958"],
    ["0721 234 567", "tel:0721234567"],
    ["(555) 010-2030 x12", "tel:5550102030"],
  ])("phone %s → %s", (input, expected) => expect(telHref(input)).toBe(expected));

  it.each([
    ["ana.dev", "https://ana.dev"],
    ["https://ana.dev/cv", "https://ana.dev/cv"],
    ["http://old.example", "http://old.example"],
  ])("web %s → %s", (input, expected) => expect(webHref(input)).toBe(expected));
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

  it("never goes below the floor (what still does not fit wraps in the template)", () => {
    expect(fitFontSize("linkedin.com/in/" + "x".repeat(80), 153)).toBe(6.5);
  });

  it("measures Inter Bold too (fontkit reference: 97.92pt at 17pt)", () => {
    expect(textWidth("Maximilian-", 17, true)).toBeCloseTo(97.92, 1);
    expect(textWidth("Maximilian-", 17, true)).toBeGreaterThan(textWidth("Maximilian-", 17));
  });
});

describe("fitWordsFontSize", () => {
  it("keeps the size when every word fits", () => {
    expect(fitWordsFontSize("Ana Popescu", 166, 17, 12, true)).toBe(17);
  });

  it("shrinks until the widest word (hyphenated parts count apart) fits", () => {
    const size = fitWordsFontSize("Wolfeschlegelsteinhausen Bergerdorff", 166, 17, 12, true);
    expect(size).toBeLessThan(17);
    expect(textWidth("Wolfeschlegelsteinhausen", size, true)).toBeLessThanOrEqual(166);
    expect(fitWordsFontSize("Maximilian-Alexander Konstantinopoulos-Vandersteen", 166, 17, 12, true)).toBe(17);
  });
});

describe("breakLongWords", () => {
  const url = "https://github.com/maximilian-konstantinopoulos/distributed-ledger-reconciliation-engine/blob/main/README.md";

  it("leaves text whose words fit exactly as it is", () => {
    const s = "Led a squad of 9 people; see github.com/ana/cv for details.";
    expect(breakLongWords(s, 335)).toBe(s);
  });

  it("marks breaks after / . - in a word wider than the line, and nothing else changes", () => {
    const out = breakLongWords(`Documented in ${url} today`, 335);
    expect(out.split(BREAK).join("")).toBe(`Documented in ${url} today`);
    expect(out).toContain(`https://${BREAK}github.${BREAK}com/${BREAK}`); // never inside "://"
    expect(out).toContain(`distributed-${BREAK}`);
    expect(out.startsWith("Documented in ")).toBe(true);
  });

  it("splits a long run without any break character where it has to, every piece fitting", () => {
    const word = "x".repeat(120);
    const pieces = breakLongWords(word, 100).split(BREAK);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join("")).toBe(word);
    for (const piece of pieces) expect(textWidth(piece, 10)).toBeLessThanOrEqual(100);
  });
});

describe("hyphenationCallback (fonts.ts)", () => {
  it("never splits an ordinary word", () => {
    expect(hyphenationCallback("Nasalciuc")).toEqual(["Nasalciuc"]);
  });

  it("turns break marks into zero-width break points and drops the marks", () => {
    expect(hyphenationCallback(`github.com/${BREAK}ana-${BREAK}popescu`)).toEqual(["github.com/", "", "ana-", "", "popescu"]);
  });
});
