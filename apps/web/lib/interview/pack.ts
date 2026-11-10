/**
 * Interview Trainer: the question pack (ANTRENOR-INTERVIU-VOCE.md §5 and B1; APPLY-COPILOT-DESIGN.md §11).
 *
 * No AI. The questions come from the post's requirements, read the way Job Fit reads them, and from
 * the CV's own lines, and every question is tied to a line that is in the CV, word for word. The
 * interviewer may phrase a question its own way and ask follow-ups on the answer; it never asks
 * about something the CV doesn't have, and a requirement the CV doesn't show is asked about openly
 * ("isn't in your CV"), from a real line.
 *
 * The interview's kind picks what is asked (B1): the recruiter asks about the role, the motivation
 * and the requirements; the technical interviewer about the skills, one by one; the hiring manager
 * about results and the team. 10 minutes ask 4 questions, 20 minutes 8. The same input gives the same
 * pack; another `variant` asks the same things in other words ("Practice these again", IV-16).
 */
import { descLines } from "@/lib/cv-print";
import { findSkills, requirementsOf } from "@/lib/job-fit";
import type { CvData, InterviewKind, InterviewPack, InterviewQuestion } from "@/lib/types";

/** A line of the CV a question can be tied to. */
export type CvLine = {
  /** "work.0.2": the first job's third line; "summary.0": the summary's first sentence */
  ref: string;
  text: string;
  section: "work" | "activities" | "volunteering" | "summary";
  /** the job or the activity the line belongs to ("Frontend Engineer", "Fintech Labs SRL"); empty in the summary */
  role: string;
  org: string;
  /** the skills the line names (Job Fit's keys: "typescript", "power bi") */
  skills: string[];
  /** the line has a number: a result, a size, a time */
  hasNumber: boolean;
};

/** A requirement of the post, with the CV line that shows it, if one does. */
export type AskItem = {
  label: string;
  required: boolean;
  keys: string[];
  /** the CV line that names it, the strongest first: a job's line, with a number */
  proof: CvLine | null;
  /** named in the CV's skills lists, even without a line */
  listed: boolean;
};

export class PackError extends Error {
  constructor(public reason: "no_lines") {
    super("The CV has no lines to ask about");
  }
}

export const QUESTIONS_FOR: Record<10 | 20, number> = { 10: 4, 20: 8 };

const keysOf = (text: string) => [...new Set(findSkills(text).map((h) => h.key))];
const sentences = (text: string) => text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);

/** The CV's lines, in the CV's order: the jobs' lines, then activities and volunteering, then the summary. */
export function cvLines(cv: CvData): CvLine[] {
  const out: CvLine[] = [];
  const add = (ref: string, text: string, section: CvLine["section"], role: string, org: string) =>
    out.push({ ref, text, section, role: role.trim(), org: org.trim(), skills: keysOf(text), hasNumber: /\d/.test(text) });
  cv.work.forEach((w, i) => descLines(w.description).forEach((l, j) => add(`work.${i}.${j}`, l, "work", w.role, w.company)));
  for (const section of ["activities", "volunteering"] as const)
    cv[section].forEach((a, i) =>
      descLines(a.description).forEach((l, j) => add(`${section}.${i}.${j}`, l, section, a.role || a.title, a.organisation ?? "")));
  sentences(cv.summary.valueProposition ?? "").forEach((s, j) => add(`summary.${j}`, s, "summary", cv.summary.position ?? "", ""));
  return out;
}

/** The line a ref points to, as the CV has it now; null when the CV changed and it's gone. */
export function lineAt(cv: CvData, ref: string): CvLine | null {
  return cvLines(cv).find((l) => l.ref === ref) ?? null;
}

/** A job's line before an activity's, a line with a number before one without, earlier before later. */
const strength = (l: CvLine, i: number) => (l.section === "work" ? 0 : l.section === "summary" ? 2000 : 1000) + (l.hasNumber ? 0 : 500) + i;
const strongest = (lines: CvLine[]) =>
  lines.map((l, i) => [l, strength(l, i)] as const).sort((a, b) => a[1] - b[1]).map(([l]) => l);

/** What the interviewer will ask about (the setup screen): the post's requirements, required first, each with its proof. */
export function askAbout(cv: CvData, post: string): AskItem[] {
  const lines = cvLines(cv);
  const listed = new Set(keysOf([...cv.skills, ...cv.instruments, ...cv.softSkills].join(", ")));
  const items = requirementsOf(post).skills.map((r) => ({
    label: r.label,
    required: r.required,
    keys: r.keys,
    proof: strongest(lines.filter((l) => l.section !== "summary" && l.skills.some((k) => r.keys.includes(k))))[0] ?? null,
    listed: r.keys.some((k) => listed.has(k)),
  }));
  return [...items.filter((i) => i.required), ...items.filter((i) => !i.required)];
}

// ---------------------------------------------------------------------------------------------
// the words

const IRREGULAR = new Set([
  "built", "led", "ran", "made", "wrote", "grew", "cut", "won", "drove", "took", "set", "gave", "brought", "began",
  "bought", "sold", "taught", "chose", "kept", "held", "found", "spoke", "rebuilt", "rewrote", "undertook", "oversaw",
  "met", "lead", "co-led", "shipped", "redid", "split", "put", "sent", "spent", "upheld", "won", "flew",
]);
/** Does the line start the way CV lines do, with what the person did ("Built…", "Cut…", "Mentored…")? */
const startsWithDeed = (text: string) => {
  const w = (text.match(/^[\p{L}-]+/u)?.[0] ?? "").toLowerCase();
  return w.length > 3 && /ed$/.test(w) ? !["need", "speed", "seed", "feed", "breed"].includes(w) : IRREGULAR.has(w);
};
const lowerFirst = (s: string) => (/^\p{Lu}\p{Ll}/u.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** A line short enough to say: up to the first ", " after 50 characters, or 110 characters at a word's end. */
function shortLine(text: string): string {
  const t = text.trim().replace(/[.;:,]+$/, "");
  if (t.length <= 110) return t;
  const comma = t.indexOf(", ", 50);
  if (comma > 0 && comma <= 110) return t.slice(0, comma);
  return t.slice(0, t.lastIndexOf(" ", 110)) + "…";
}
/** "when you led the migration…" or "this line of your CV: “…”". */
const story = (l: CvLine) => (startsWithDeed(l.text) ? `when you ${lowerFirst(shortLine(l.text))}` : `this line of your CV: “${shortLine(l.text)}”`);
const where = (l: CvLine) => (l.org ? ` at ${l.org}` : l.role ? ` as ${l.role}` : "");
/** "the Data Analyst role at Altamira Tech", with whatever of the two the Tracker has. */
export const theRole = (role: string, company: string) =>
  role && company ? `the ${role} role at ${company}` : role ? `the ${role} role` : company ? `this role at ${company}` : "this role";

type Ctx = { role: string; company: string };
/** `free`: the question is about the job, not about this line (an overview, a gap), so the line stays free for another */
type Slot = { line: CvLine; requirement: string | null; text: (v: number) => string; free?: boolean };
const pick = (options: string[], v: number) => options[v % options.length];
/** "React", "React and TypeScript", "React, TypeScript and GraphQL" */
const joinLabels = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

const ask = {
  overview: (l: CvLine): Omit<Slot, "line"> => ({
    requirement: null,
    text: (v) => pick([
      `Walk me through your work${l.role ? ` as ${l.role}` : ""}${l.org ? ` at ${l.org}` : ""}. What are you responsible for?`,
      `Tell me about your role${l.org ? ` at ${l.org}` : ""}. What does a normal week look like for you?`,
    ], v),
  }),
  motivation: (ctx: Ctx): Omit<Slot, "line"> => ({
    requirement: null,
    text: (v) => pick([
      `What draws you to ${theRole(ctx.role, ctx.company)}?`,
      `Why are you interested in ${theRole(ctx.role, ctx.company)}, and why now?`,
    ], v),
  }),
  requirement: (l: CvLine, req: string): Omit<Slot, "line"> => ({
    requirement: req,
    text: (v) => pick([
      `The role asks for ${req}. Tell me about ${story(l)}. What exactly did you do?`,
      `Let's talk about ${req}. Walk me through ${story(l)}. How did you approach it?`,
    ], v),
  }),
  gap: (l: CvLine, req: string): Omit<Slot, "line"> => ({
    requirement: req,
    text: (v) => pick([
      `The role also asks for ${req}, which isn't in your CV yet. Thinking of your work${where(l)}, how would you get up to speed with it?`,
      `Your CV doesn't show ${req}, and this job uses it. Be honest with me: where are you with it, and what from your work${where(l)} would help you learn it?`,
    ], v),
  }),
  result: (l: CvLine): Omit<Slot, "line"> => ({
    requirement: null,
    text: (v) => pick([
      `Tell me about ${story(l)}. What was your part, and how did you get that result?`,
      `I'd like to hear about ${story(l)}. What did you change, and what came of it?`,
    ], v),
  }),
  team: (l: CvLine): Omit<Slot, "line"> => ({
    requirement: null,
    text: (v) => pick([
      `Tell me about ${story(l)}. Who did you work with, and how did you keep everyone moving?`,
      `Think of ${story(l)}. How did you work with the people around you?`,
    ], v),
  }),
  setback: (l: CvLine): Omit<Slot, "line"> => ({
    requirement: null,
    text: (v) => pick([
      `Think of the work behind “${shortLine(l.text)}”. What didn't go to plan, and what did you do about it?`,
      `Behind “${shortLine(l.text)}”, what was the hardest part, and how did you deal with it?`,
    ], v),
  }),
  how: (l: CvLine): Omit<Slot, "line"> => ({
    requirement: null,
    text: (v) => pick(l.skills.length ? [
      `Tell me about ${story(l)}. Which tools did you use, and why those?`,
      `Walk me through ${story(l)}, step by step.`,
    ] : [
      `Walk me through ${story(l)}, step by step.`,
      `Tell me about ${story(l)}. How did you go about it?`,
    ], v),
  }),
  listed: (l: CvLine, req: string): Omit<Slot, "line"> => ({
    requirement: req,
    text: (v) => pick([
      `Your CV lists ${req}, but none of your jobs mention it. Where have you used it, and what did you do with it?`,
      `This role uses ${req}, and it's in your skills. Tell me about a time you used it, as specifically as you can.`,
    ], v),
  }),
};

const TEAM = /\b(?:team|teams|mentor\w*|led|lead|managed|coach\w*|hired|stakeholders?|cross-functional|together|colleagues|clients?)\b/i;

export type PackInput = {
  cv: CvData;
  /** the job post (the Tracker's description); may be empty */
  post: string;
  /** the job's role and company, from the Tracker */
  role: string;
  company: string;
  kind: InterviewKind;
  minutes: 10 | 20;
  /** another wording of the same questions (IV-16); 0 by default */
  variant?: number;
  /** "Practice these again": the lines and requirements to ask about first */
  focus?: { ref: string; requirement: string | null }[];
};

/** The pack: the questions of one session, each tied to a line of this CV. */
export function buildPack(input: PackInput): InterviewPack {
  const { cv, kind } = input;
  const v = input.variant ?? 0;
  const n = QUESTIONS_FOR[input.minutes];
  const lines = cvLines(input.cv);
  if (!lines.length) throw new PackError("no_lines");
  const ctx: Ctx = { role: input.role.trim(), company: input.company.trim() };
  const items = askAbout(cv, input.post);
  const proven = items.filter((i) => i.proof);
  const gaps = items.filter((i) => !i.proof && !i.listed && i.required);
  const jobLines = lines.filter((l) => l.section !== "summary");
  const deeds = strongest(jobLines);
  const results = deeds.filter((l) => l.hasNumber);
  const teamLines = deeds.filter((l) => TEAM.test(l.text));
  const first = jobLines[0] ?? lines[0];
  const pitch = lines.find((l) => l.section === "summary") ?? deeds[0];
  /** the line a gap question starts from: the one closest to the post's skills, or the strongest */
  const bridge = (keys: string[]) => deeds.find((l) => l.skills.some((k) => items.some((i) => i.keys.includes(k) && !keys.includes(k)))) ?? deeds[0] ?? first;

  type Plan = () => Slot | null;
  const used = new Set<string>();
  /** 0 on the first pass through the plan: a line is asked about once; later passes may come back to it */
  let pass = 0;
  const fresh = (pool: CvLine[]) => pool.find((l) => !used.has(l.ref));
  const proofSlot = (pool: AskItem[]): Plan => () => {
    const open = pool.filter((i) => i.proof && !used.has(`req:${i.label}`));
    for (const it of open) {
      // a line naming it that no other question took yet; on a later pass, the strongest one
      const named = strongest(jobLines.filter((l) => l.skills.some((k) => it.keys.includes(k))));
      const line = named.find((l) => !used.has(l.ref)) ?? (pass > 0 ? named[0] : undefined);
      if (!line) continue;
      // the requirements the same line shows are asked about together: "React and TypeScript"
      const same = open.filter((i) => i.keys.some((k) => line.skills.includes(k)));
      same.forEach((i) => used.add(`req:${i.label}`));
      return { line, ...ask.requirement(line, joinLabels(same.map((i) => i.label))) };
    }
    return null;
  };
  const listedSlot = (pool: AskItem[]): Plan => () => {
    const it = pool.find((i) => !i.proof && i.listed && !used.has(`req:${i.label}`));
    if (!it) return null;
    used.add(`req:${it.label}`);
    const l = bridge(it.keys);
    return { line: l, ...ask.listed(l, it.label), free: true };
  };
  const gapSlot: Plan = () => {
    const it = gaps.find((i) => !used.has(`req:${i.label}`));
    if (!it) return null;
    used.add(`req:${it.label}`);
    const l = bridge(it.keys);
    return { line: l, ...ask.gap(l, it.label), free: true };
  };
  const lineSlot = (pool: () => CvLine[], make: (l: CvLine) => Omit<Slot, "line">): Plan => () => {
    const l = fresh(pool());
    return l ? { line: l, ...make(l) } : null;
  };
  const once = (make: () => Slot | null, key: string): Plan => () => {
    if (used.has(key)) return null;
    used.add(key);
    return make();
  };
  const required = proven.filter((i) => i.required);
  const preferred = proven.filter((i) => !i.required);

  const plans: Record<InterviewKind, Plan[]> = {
    recruiter: [
      once(() => ({ line: first, ...ask.overview(first), free: true }), "overview"),
      once(() => (pitch ? { line: pitch, ...ask.motivation(ctx), free: true } : null), "motivation"),
      proofSlot(required), gapSlot, listedSlot(items.filter((i) => i.required)), proofSlot(required),
      lineSlot(() => results, ask.result), proofSlot(preferred), lineSlot(() => teamLines, ask.team), lineSlot(() => deeds, ask.result),
    ],
    technical: [
      proofSlot(required), proofSlot(required), gapSlot, listedSlot(items.filter((i) => i.required)), proofSlot(required),
      lineSlot(() => deeds.filter((l) => l.skills.length), ask.how), proofSlot(preferred), gapSlot, listedSlot(items),
      lineSlot(() => deeds, ask.setback), lineSlot(() => deeds, ask.how),
    ],
    manager: [
      lineSlot(() => results, ask.result), proofSlot(required), lineSlot(() => teamLines, ask.team),
      lineSlot(() => deeds, ask.setback), gapSlot, lineSlot(() => results, ask.result), proofSlot(required),
      lineSlot(() => deeds, ask.result), lineSlot(() => deeds, ask.team),
    ],
  };

  const chosen: { line: CvLine; requirement: string | null; text: string }[] = [];
  /** adds a question unless the session already asks it in these words */
  const add = (s: Slot) => {
    const text = s.text(v + chosen.length);
    if (chosen.some((c) => c.text === text)) return;
    if (!s.free) used.add(s.line.ref);
    chosen.push({ line: s.line, requirement: s.requirement, text });
  };
  // "Practice these again": the lines and requirements that missed something come first, in new words
  for (const f of input.focus ?? []) {
    if (chosen.length >= n) break;
    const l = lines.find((x) => x.ref === f.ref);
    if (!l) continue;
    if (f.requirement) used.add(`req:${f.requirement}`);
    const make = f.requirement
      ? items.some((i) => i.label === f.requirement && !i.proof) ? ask.gap(l, f.requirement) : ask.requirement(l, f.requirement)
      : l.hasNumber ? ask.result(l) : ask.how(l);
    add({ line: l, ...make });
  }
  // the kind's plan, in order; then again with the lines free, so a short CV still fills the session
  for (pass = 0; pass < 3 && chosen.length < n; pass++) {
    for (const plan of plans[kind]) {
      if (chosen.length >= n) break;
      const s = plan();
      if (s) add(s);
    }
    if (chosen.length < n) for (const k of [...used]) if (!k.startsWith("req:") && k !== "overview" && k !== "motivation") used.delete(k);
  }
  if (!chosen.length) throw new PackError("no_lines");

  const questions: InterviewQuestion[] = chosen.slice(0, n).map((s, i) => ({
    id: `q${i + 1}`,
    text: s.text,
    requirement: s.requirement,
    bullet: { ref: s.line.ref, text: s.line.text },
  }));
  return { questions };
}
