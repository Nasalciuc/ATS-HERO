// Interview Trainer, step 3: what an answer measured, without AI (lib/interview/measure.ts). Counts are
// information, never grades (IV-17): words per minute and long pauses only for spoken answers, filler
// words only from their second use; the requirement named and the CV line's facts used, read the way
// Job Fit reads skills, with the answer's own sentence as the quote.
import { describe, expect, it } from "vitest";
import { cvFactsIn, FILLER_MIN, measureAnswer, measuredCriteria, namedIn, spokenNumbers } from "@/lib/interview/measure";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

describe("measureAnswer", () => {
  it("counts the words and the time; words per minute only for a spoken answer of 10 seconds or more", () => {
    expect(measureAnswer({ text: words(150), seconds: 60, mode: "voice" })).toMatchObject({ seconds: 60, words: 150, wordsPerMinute: 150 });
    expect(measureAnswer({ text: words(150), seconds: 60, mode: "typing" }).wordsPerMinute).toBe(0);
    expect(measureAnswer({ text: words(12), seconds: 6, mode: "voice" }).wordsPerMinute).toBe(0);
    expect(measureAnswer({ text: "", seconds: -3, mode: "voice" })).toMatchObject({ seconds: 0, words: 0, wordsPerMinute: 0 });
  });

  it("counts the pauses of 3 seconds or more, in spoken answers only", () => {
    expect(measureAnswer({ text: "x", seconds: 30, mode: "voice", pauses: [0.5, 3, 4.2, 2.9] }).longPauses).toBe(2);
    expect(measureAnswer({ text: "x", seconds: 30, mode: "typing", pauses: [5, 6] }).longPauses).toBe(0);
  });

  it(`lists a filler word from its ${FILLER_MIN}nd use, the most used first`, () => {
    const m = measureAnswer({
      text: "Um, so basically I, like, built it. So basically it worked, you know, um, it was fine.",
      seconds: 20, mode: "voice",
    });
    expect(m.fillers).toEqual([
      { word: "basically", count: 2 },
      { word: "so", count: 2 },
      { word: "um", count: 2 },
    ]);
  });

  it("doesn't count “like” as a verb, “so” inside a sentence, or “you know how”", () => {
    const m = measureAnswer({
      text: "I like SQL and I like Python, so I used both. You know how reports go; you know how teams work.",
      seconds: 20, mode: "voice",
    });
    expect(m.fillers).toEqual([]);
  });

  it("keeps the requirement named and the CV line's facts with the measures", () => {
    const m = measureAnswer({
      text: "I moved the reports to SQL and cut them from six hours to one.",
      seconds: 40, mode: "typing", requirement: "SQL",
      bullet: { ref: "work.0.1", text: "Cut the monthly report from 6 hours to 1 with SQL" },
    });
    expect(m.named).toEqual(["SQL"]);
    expect(m.cvFacts).toEqual({ used: ["6", "1", "SQL"], unused: [] });
  });
});

describe("the requirement named", () => {
  it("finds the requirement's skills in the answer, the way Job Fit reads them", () => {
    expect(namedIn("We moved the whole app to TypeScript last year.", "React and TypeScript")).toEqual(["TypeScript"]);
    expect(namedIn("I built dashboards in PowerBI.", "Power BI")).toEqual(["Power BI"]);
    expect(namedIn("I built dashboards.", "Power BI")).toEqual([]);
    expect(namedIn("Anything", null)).toEqual([]);
  });
});

describe("the CV line's facts", () => {
  const line = "Built Power BI and SQL dashboards used daily by 40 operations staff, cutting reporting time by 45%";

  it("are the line's numbers and tools; those the answer didn't say are left as a hint", () => {
    expect(cvFactsIn("I built the dashboards in Power BI.", line)).toEqual({ used: ["Power BI"], unused: ["40", "45%", "SQL"] });
    expect(cvFactsIn("About forty people used them daily, and reporting got 45 percent faster.", line))
      .toEqual({ used: ["40", "45%"], unused: ["Power BI", "SQL"] });
  });

  it("read numbers said in words, and “one” only as a number", () => {
    expect(spokenNumbers("from six hours to one, forty-five percent, two million users")).toBe("from 6 hours to 1, 45%, 2m users");
    expect(spokenNumbers("one of the teams")).toBe("one of the teams");
    expect(spokenNumbers("often, tent")).toBe("often, tent");
  });
});

describe("the measured criteria", () => {
  it("give the requirement and the proof with the answer's own sentence, or missing", () => {
    const answer = "We had slow reports. I rewrote them in SQL and the report went from 6 hours to 1.";
    const m = measureAnswer({ text: answer, seconds: 30, mode: "typing", requirement: "SQL",
      bullet: { ref: "work.0.0", text: "Cut the monthly report from 6 hours to 1 with SQL" } });
    expect(measuredCriteria(answer, m, "SQL")).toEqual([
      { key: "requirement", met: true, quote: "I rewrote them in SQL and the report went from 6 hours to 1." },
      { key: "proof", met: true, quote: "I rewrote them in SQL and the report went from 6 hours to 1." },
    ]);
    const vague = measureAnswer({ text: "I helped a lot.", seconds: 5, mode: "typing", requirement: null,
      bullet: { ref: "work.0.0", text: "Cut the monthly report from 6 hours to 1 with SQL" } });
    expect(measuredCriteria("I helped a lot.", vague, null)).toEqual([{ key: "proof", met: false, quote: null }]);
  });
});
