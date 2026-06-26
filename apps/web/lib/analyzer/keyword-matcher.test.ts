import { describe, it, expect } from "vitest";
import { jobFit } from "./keyword-matcher";

describe("jobFit", () => {
  it("returns a 0 match with guidance when the job description is empty", () => {
    const r = jobFit("React developer with TypeScript", "");
    expect(r.matchScore).toBe(0);
    expect(r.matched).toHaveLength(0);
    expect(r.missing).toHaveLength(0);
    expect(r.message).toMatch(/add a job description/i);
  });

  it("scores 100 when the CV covers every ranked job keyword", () => {
    const job = "React TypeScript GraphQL Docker Kubernetes";
    const cv = "React TypeScript GraphQL Docker Kubernetes";
    const r = jobFit(cv, job);
    expect(r.matchScore).toBe(100);
    expect(r.missing).toHaveLength(0);
    expect(r.message).toMatch(/strong match/i);
  });

  it("scores 0 and lists everything as missing when there is no overlap", () => {
    const job = "React TypeScript GraphQL";
    const cv = "Gardening cooking painting";
    const r = jobFit(cv, job);
    expect(r.matchScore).toBe(0);
    expect(r.matched).toHaveLength(0);
    expect(r.missing).toEqual(expect.arrayContaining(["react", "typescript", "graphql"]));
    expect(r.message).toMatch(/low match/i);
  });

  it("partitions keywords into matched and missing", () => {
    const job = "We need React TypeScript and GraphQL experience";
    const cv = "I know React and TypeScript well";
    const r = jobFit(cv, job);
    expect(r.matched).toEqual(expect.arrayContaining(["react", "typescript"]));
    expect(r.missing).toContain("graphql");
    expect(r.matchScore).toBeGreaterThan(0);
    expect(r.matchScore).toBeLessThan(100);
  });

  it("filters out stopwords and generic recruiting noise", () => {
    const job =
      "The candidate should have experience and ability to work with the team. " +
      "Responsibilities include building and developing strong solutions.";
    const cv = "irrelevant";
    const r = jobFit(cv, job);
    const all = [...r.matched, ...r.missing];
    for (const noise of [
      "the",
      "and",
      "candidate",
      "experience",
      "ability",
      "team",
      "responsibilities",
      "strong",
      "building",
      "developing",
    ]) {
      expect(all).not.toContain(noise);
    }
  });

  it("ignores tokens shorter than 3 characters and pure numbers", () => {
    const r = jobFit("x", "Go is a language 2024 ab cd");
    const all = [...r.matched, ...r.missing];
    expect(all).not.toContain("ab");
    expect(all).not.toContain("2024");
    expect(all).not.toContain("is");
  });

  it("preserves multi-char tech tokens with + and . (c++, node.js)", () => {
    const job = "Looking for c++ and node.js skills";
    const cv = "Experienced in c++ and node.js";
    const r = jobFit(cv, job);
    expect(r.matched).toContain("c++");
    expect(r.matched).toContain("node.js");
  });

  it("FINDING: 2-character skills (c#, go, ml, ai, ux, qa, r) are silently dropped", () => {
    const job = "We use c# and go and ml heavily";
    const cv = "Expert in c# and go and ml";
    const r = jobFit(cv, job);
    const all = [...r.matched, ...r.missing];
    expect(all).not.toContain("c#");
    expect(all).not.toContain("go");
    expect(all).not.toContain("ml");
  });

  it("caps ranking at the 30 most frequent keywords", () => {
    const words = Array.from({ length: 40 }, (_, i) => `keyword${i}`);
    const job = words.join(" ");
    const r = jobFit("nothing relevant here", job);
    expect(r.matched.length + r.missing.length).toBeLessThanOrEqual(30);
  });

  it("is case-insensitive", () => {
    const r = jobFit("react TYPESCRIPT", "REACT typescript");
    expect(r.matchScore).toBe(100);
  });
});
