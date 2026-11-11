// Interview Trainer, step 2: the question pack (lib/interview/pack.ts). No AI: every question is tied
// to a line that is in the CV word for word (APPLY-COPILOT-DESIGN.md §11, "Gata înseamnă"), the kind
// of interview picks what is asked (ANTRENOR-INTERVIU-VOCE.md B1), a required skill the CV doesn't show
// is asked about openly, and "Practice these again" asks the missed lines first, in other words (IV-16).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { askAbout, buildPack, cvLines, lineAt, PackError, QUESTIONS_FOR, type PackInput } from "@/lib/interview/pack";
import { emptyCvData, type CvData, type InterviewKind } from "@/lib/types";

const personas = JSON.parse(fs.readFileSync(path.join(process.cwd(), "../../tools/ats-lab/fixtures/personas.json"), "utf8")) as Record<string, CvData>;
const { ana, amara } = personas;

const FRONTEND_POST = "Frontend Engineer\nRequirements:\n- 3+ years with React and TypeScript\n- GraphQL\n- AWS\nNice to have:\n- Docker";
const DATA_POST = "Data Analyst\nWhat you'll do:\n- Build dashboards in Power BI\n- Write SQL\nRequirements:\n- Python\n- Snowflake\nNice to have: Tableau";
const KINDS: InterviewKind[] = ["recruiter", "technical", "manager"];

const pack = (over: Partial<PackInput> & Pick<PackInput, "cv">) =>
  buildPack({ post: "", role: "Data Analyst", company: "Altamira Tech", kind: "technical", minutes: 10, ...over });

describe("the question pack", () => {
  it("ties every question to a line that is in the CV, word for word, for every persona, kind and length", () => {
    for (const [who, cv] of Object.entries(personas))
      for (const post of ["", FRONTEND_POST, DATA_POST])
        for (const kind of KINDS)
          for (const minutes of [10, 20] as const) {
            const { questions } = pack({ cv, post, kind, minutes });
            const where = `${who} ${kind} ${minutes}`;
            expect(questions.length, where).toBeGreaterThan(0);
            expect(questions.length, where).toBeLessThanOrEqual(QUESTIONS_FOR[minutes]);
            expect(questions.map((q) => q.id), where).toEqual(questions.map((_, i) => `q${i + 1}`));
            expect(new Set(questions.map((q) => q.text)).size, `${where}: a question asked twice`).toBe(questions.length);
            for (const q of questions) expect(lineAt(cv, q.bullet.ref)?.text, `${where} ${q.id}`).toBe(q.bullet.text);
          }
  });

  it("asks 4 questions in 10 minutes and 8 in 20", () => {
    expect(pack({ cv: amara, post: DATA_POST, minutes: 10 }).questions).toHaveLength(4);
    expect(pack({ cv: amara, post: DATA_POST, minutes: 20 }).questions).toHaveLength(8);
  });

  it("the technical interview asks about the post's required skills, from the lines that name them", () => {
    const { questions } = pack({ cv: amara, post: DATA_POST, kind: "technical", minutes: 20 });
    const bi = questions.find((q) => q.requirement?.includes("Power BI"));
    expect(bi?.bullet.text).toContain("Power BI");
    expect(bi?.text).toContain("Power BI");
    const py = questions.find((q) => q.requirement === "Python");
    expect(py?.bullet.text).toContain("Python");
  });

  it("asks together about requirements one line shows: “React and TypeScript”", () => {
    const { questions } = pack({ cv: ana, post: FRONTEND_POST, kind: "technical" });
    expect(questions[0]).toMatchObject({ requirement: "React and TypeScript", bullet: { ref: "work.0.0" } });
    expect(questions.filter((q) => q.requirement === "React" || q.requirement === "TypeScript")).toHaveLength(0);
  });

  it("asks openly about a required skill the CV doesn't show, starting from a real line", () => {
    const { questions } = pack({ cv: ana, post: FRONTEND_POST, kind: "technical" });
    const aws = questions.find((q) => q.requirement === "AWS");
    expect(aws?.text).toMatch(/isn't in your CV|doesn't show/);
    expect(lineAt(ana, aws!.bullet.ref)).not.toBeNull();
  });

  it("asks where a skill only listed in the CV was used", () => {
    const { questions } = pack({ cv: ana, post: FRONTEND_POST, kind: "technical" });
    expect(questions.find((q) => q.requirement === "GraphQL")?.text).toMatch(/lists GraphQL|in your skills/);
  });

  it("the recruiter asks about the person's role, then why this job", () => {
    const { questions } = pack({ cv: amara, post: DATA_POST, kind: "recruiter" });
    expect(questions[0].text).toContain("Flutterwave");
    expect(questions[1].text).toContain("the Data Analyst role at Altamira Tech");
    expect(questions[1].bullet.ref).toBe("summary.0");
  });

  it("the hiring manager starts with a result: a line with a number", () => {
    for (const cv of Object.values(personas)) {
      const [first] = pack({ cv, post: "", kind: "manager" }).questions;
      expect(first.bullet.text).toMatch(/\d/);
    }
  });

  it("gives the same pack for the same input, and the same lines in other words for another variant", () => {
    const input = { cv: amara, post: DATA_POST, kind: "technical" as const, minutes: 20 as const };
    expect(pack(input)).toEqual(pack(input));
    const a = pack(input).questions;
    const b = pack({ ...input, variant: 1 }).questions;
    expect(b.map((q) => q.bullet.ref)).toEqual(a.map((q) => q.bullet.ref));
    b.forEach((q, i) => expect(q.text, q.id).not.toBe(a[i].text));
  });

  it("“Practice these again” asks the missed lines and requirements first", () => {
    const { questions } = pack({ cv: amara, post: DATA_POST, kind: "recruiter", focus: [
      { ref: "work.1.0", requirement: null },
      { ref: "work.0.0", requirement: "Snowflake" },
    ] });
    expect(questions[0].bullet.ref).toBe("work.1.0");
    expect(questions[1]).toMatchObject({ requirement: "Snowflake", bullet: { ref: "work.0.0" } });
    expect(questions.filter((q) => q.requirement === "Snowflake")).toHaveLength(1);
  });

  it("can't make a pack from a CV with no lines yet", () => {
    expect(() => pack({ cv: emptyCvData() })).toThrow(PackError);
    try {
      pack({ cv: emptyCvData() });
    } catch (e) {
      expect((e as PackError).reason).toBe("no_lines");
    }
  });
});

describe("the CV's lines", () => {
  it("are the jobs' lines without pasted bullet marks, then the summary's sentences, each with its place", () => {
    const cv = { ...emptyCvData(), work: [{ ...ana.work[0], description: "• Built a library\n\n- Cut costs by 10%" }] };
    cv.summary = { position: "Engineer", valueProposition: "I build things. I ship fast." };
    expect(cvLines(cv).map((l) => [l.ref, l.text, l.hasNumber])).toEqual([
      ["work.0.0", "Built a library", false],
      ["work.0.1", "Cut costs by 10%", true],
      ["summary.0", "I build things.", false],
      ["summary.1", "I ship fast.", false],
    ]);
  });
});

describe("what the interviewer will ask about", () => {
  it("lists the post's requirements, required first, each with the line that shows it, or that it's only listed, or missing", () => {
    const items = askAbout(ana, FRONTEND_POST);
    expect(items.map((i) => [i.label, i.required, i.proof?.ref ?? null, i.listed])).toEqual([
      ["React", true, "work.0.0", true],
      ["TypeScript", true, "work.0.0", true],
      ["GraphQL", true, null, true],
      ["AWS", true, null, false],
      ["Docker", false, null, false],
    ]);
  });
});
