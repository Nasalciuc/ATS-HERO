/**
 * The "ATS read" score of an uploaded (or pasted) CV: how much of the profile an ATS builds from the
 * file comes out right. It replaces the old Improve score, which only counted contacts and length
 * (a recipe with an email scored the same as a good CV; ATS-VIEW-DESIGN.md §1.1).
 *
 * Deterministic and explainable:
 * - the weights are the ATS lab's (apps/ai/app/lab/scorer.py), so an exported CV and an uploaded
 *   one are measured the same way;
 * - with no source data to compare against, a field counts as read when every reading of the file
 *   recovers it the same way (and absolute checks pass: no dated job at all is 0, even when every
 *   reading agrees);
 * - every point lost is an issue with a reason and a fix: the issues' points add up to 100 − score.
 */
import type { AtsRead, AtsSignals } from "./types";
import { NO_SIGNALS } from "./types";
import { DATE_RANGE, entryParts, headingKey, monthsOfExperience, parse, splitLines, type Block, type Parsed } from "./parse";
import type { ScoreReport, SectionKey, SectionReport } from "../types";

/** The lab's weights (scorer.py WEIGHTS). */
export const WEIGHTS = {
  name: 7,
  email: 8,
  phone: 6,
  linkedin: 4,
  experience: 35,
  education: 10,
  skillsText: 12,
  skillsList: 8,
  headings: 5,
  unicode: 5,
} as const;
type Check = keyof typeof WEIGHTS;

export type Mark = "ok" | "partial" | "lost";

/** One thing the ATS read (or failed to read), as the results screen lists it. */
export interface ReadField {
  label: string;
  value: string | null;
  mark: Mark;
  note?: string;
}

export interface Issue {
  code: string;
  section: "personalInfo" | "work" | "education" | "skills" | "file";
  /** points this costs (0: worth knowing, costs nothing yet) */
  points: number;
  title: string;
  why: string;
  fix: string;
  source?: { label: string; url: string };
}

export interface AtsSection extends SectionReport {
  /** what an ATS reads in this section, field by field */
  reads: ReadField[];
  /** one line for the row header, e.g. "4 of 4 read" */
  status: string;
}

export interface AtsReport extends ScoreReport {
  kind: "ats-read";
  verdict: "PASS" | "WARN" | "FAIL";
  sections: AtsSection[];
  issues: Issue[];
  good: string[];
  file: { kind: "pdf" | "docx" | "text"; producer: string | null; pages: number | null; bytes: number | null; twoColumns: boolean };
  /** readings compared (2 for a file, 1 for pasted text) */
  readings: number;
  monthsOfExperience: number | null;
  content: { bullets: number; withResult: number; percentNoBase: number };
  /** the text as the weakest reading read it, for "See the text the robot read" */
  robotText: string;
}

const GREENHOUSE_PARSE = {
  label: "Greenhouse Support: Unsuccessful resume parse",
  url: "https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse",
};
const GREENHOUSE_MATCH = {
  label: "Greenhouse Support: Talent Matching FAQ",
  url: "https://support.greenhouse.io/hc/en-us/articles/41131616864283-Talent-Matching-Data-Processing-FAQ",
};

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFKC").replace(/\u200B/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const round1 = (n: number) => Math.round(n * 10) / 10;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Score a file read by `readForAts`. */
export function scoreRead(read: AtsRead, today = new Date()): AtsReport {
  return scoreReadings(
    read.readings.map((r) => r.text),
    read.signals,
    { kind: read.kind, producer: read.producer, pages: read.pages, bytes: read.bytes },
    today,
  );
}

/** Score pasted text: one reading, no layout to check. */
export function scoreText(text: string, today = new Date()): AtsReport {
  return scoreReadings([text], NO_SIGNALS, { kind: "text", producer: null, pages: null, bytes: null }, today);
}

function scoreReadings(
  texts: string[],
  signals: AtsSignals,
  file: { kind: "pdf" | "docx" | "text"; producer: string | null; pages: number | null; bytes: number | null },
  today: Date,
): AtsReport {
  const parsed = texts.map(parse);
  // The reading the screen shows: the one that found the most jobs, then the most skills.
  const primaryIndex = parsed.reduce(
    (best, p, i) =>
      p.experience.length > parsed[best].experience.length ||
      (p.experience.length === parsed[best].experience.length && p.skills.length > parsed[best].skills.length)
        ? i
        : best,
    0,
  );
  const P = parsed[primaryIndex];
  const many = parsed.length > 1;
  const checks: Partial<Record<Check, number>> = {};
  const issues: Issue[] = [];
  const good: string[] = [];
  const add = (issue: Issue) => issues.push({ ...issue, points: round1(issue.points) });

  // ---------------------------------------------------------------- contact
  const contact: ReadField[] = [];
  const nameValues = parsed.map((p) => p.name);
  const nameBroken = (n: string | null) => !!n && n.split(/\s+/).some((w) => headingKey(w) !== null);
  const goodNames = nameValues.filter((n) => n && !nameBroken(n));
  if (goodNames.length === parsed.length && new Set(goodNames.map(norm)).size === 1) {
    checks.name = 1;
    contact.push({ label: "Name", value: P.name, mark: "ok" });
  } else if (goodNames.length > 0) {
    checks.name = 0.5;
    const odd = nameValues.find((n) => !n || nameBroken(n) || norm(n) !== norm(goodNames[0]));
    contact.push({
      label: "Name",
      value: goodNames[0],
      mark: "partial",
      note: signals.contactsOutsideBody ? "Only in the page header or a text box" : odd ? `Also read as “${odd}”` : "Not found by every reader",
    });
    if (!signals.contactsOutsideBody) add({
      code: "name_mixed",
      section: "personalInfo",
      points: WEIGHTS.name / 2,
      title: odd ? `Your name is also read as “${odd}”` : "Some readers miss your name",
      why: "The name is the first short line of capitalised words. When a heading or a sidebar line sits next to it, a reader glues them together.",
      fix: "Put your name alone on the first line, with nothing to its left or right.",
    });
  } else {
    checks.name = 0;
    contact.push({ label: "Name", value: null, mark: "lost", note: "Not found" });
    add({
      code: "name_missing",
      section: "personalInfo",
      points: WEIGHTS.name,
      title: "Your name isn't found",
      why: "Parsers look for a short line of 2 to 4 capitalised words near the top. Yours is missing, has digits or symbols, or sits in a header or text box.",
      fix: "Start the CV with your name alone on its own line, in the page itself (not in the page header).",
    });
  }

  for (const [check, label, pick] of [
    ["email", "Email", (p: Parsed) => p.emails[0] ?? null],
    ["phone", "Phone", (p: Parsed) => p.phones[0] ?? null],
  ] as const) {
    const found = parsed.map(pick);
    const hits = found.filter(Boolean).length;
    const value = pick(P) ?? found.find(Boolean) ?? null;
    if (hits === parsed.length) {
      checks[check] = 1;
      contact.push({ label, value, mark: "ok" });
    } else if (hits > 0) {
      checks[check] = 0.5;
      const outside = signals.contactsOutsideBody;
      contact.push({ label, value, mark: "partial", note: outside ? "Only in the page header or a text box" : "Not found by every reader" });
      if (!outside)
        add({
          code: `${check}_partial`,
          section: "personalInfo",
          points: WEIGHTS[check] / 2,
          title: `Some readers miss your ${label.toLowerCase()}`,
          why: "It's broken over two lines or glued to other text in some readings of the file.",
          fix: `Put your ${label.toLowerCase()} on one line, with spaces or a “|” around it.`,
        });
    } else {
      checks[check] = 0;
      contact.push({ label, value: null, mark: "lost", note: "Not found" });
      add({
        code: `${check}_missing`,
        section: "personalInfo",
        points: WEIGHTS[check],
        title: `No ${label.toLowerCase()} found`,
        why: `Recruiters contact you through what the ATS read. Without a ${label.toLowerCase()} in the text, there's nothing to read.`,
        fix: `Add your ${label.toLowerCase()} under your name, as plain text.`,
      });
    }
  }
  const linkedinHidden = signals.hiddenLinks.find((l) => /linkedin\.com/i.test(l.url));
  const slugs = parsed.map((p) => p.linkedin);
  const mentions = texts.some((t) => /linkedin/i.test(t));
  if (slugs.some(Boolean) || linkedinHidden || mentions) {
    const hits = slugs.filter(Boolean).length;
    if (hits === parsed.length && new Set(slugs).size === 1) {
      checks.linkedin = 1;
      contact.push({ label: "LinkedIn", value: `linkedin.com/in/${slugs[0]}`, mark: "ok" });
    } else if (hits > 0) {
      checks.linkedin = 0.5;
      contact.push({
        label: "LinkedIn",
        value: `linkedin.com/in/${slugs.find(Boolean)}`,
        mark: "partial",
        note: signals.contactsOutsideBody ? "Only in the page header or a text box" : "Cut or missing in some readings",
      });
      if (!signals.contactsOutsideBody) add({
        code: "linkedin_cut",
        section: "personalInfo",
        points: WEIGHTS.linkedin / 2,
        title: "Your LinkedIn address is cut in some readings",
        why: "A long address wraps onto a second line, and the reader keeps only the first part.",
        fix: "Shorten it (linkedin.com/in/your-name, without https://www.) or give it its own line.",
      });
    } else if (linkedinHidden) {
      checks.linkedin = 0;
      contact.push({ label: "LinkedIn", value: null, mark: "lost", note: `Only the word “${linkedinHidden.label || "LinkedIn"}”: the address is a hidden link` });
      add({
        code: "linkedin_hidden",
        section: "personalInfo",
        points: WEIGHTS.linkedin,
        title: "Your LinkedIn is a hidden link",
        why: `The page shows “${linkedinHidden.label || "LinkedIn"}” and the address sits behind it as a link. ATS readers take the text, so your profile ends up without it.`,
        fix: "Write the address out, e.g. linkedin.com/in/your-name.",
      });
    } else {
      checks.linkedin = 0;
      contact.push({ label: "LinkedIn", value: null, mark: "lost", note: "Mentioned, but no address" });
      add({
        code: "linkedin_no_address",
        section: "personalInfo",
        points: WEIGHTS.linkedin,
        title: "LinkedIn is mentioned without its address",
        why: "The text says “LinkedIn” but no linkedin.com/in/… address follows, so there is nothing to read.",
        fix: "Write the address out, e.g. linkedin.com/in/your-name.",
      });
    }
  }

  if (signals.contactsOutsideBody) {
    const lost = (["name", "email", "phone", "linkedin"] as const).filter((c) => checks[c] === 0.5);
    add({
      code: "contacts_outside_body",
      section: "personalInfo",
      points: lost.reduce((sum, c) => sum + WEIGHTS[c] / 2, 0),
      title: "Your contacts are only in the page header or a text box",
      why: "Stricter readers read the page body only. Greenhouse documents that contact details in a header, footer or text box aren't parsed.",
      fix: "Move your name, email, phone and LinkedIn into the page itself, at the top.",
      source: GREENHOUSE_PARSE,
    });
  }

  // ---------------------------------------------------------------- experience
  const jobCounts = parsed.map((p) => p.experience.length);
  const nJobs = Math.max(...jobCounts);
  const jobs: ReadField[] = [];
  let monthsTotal: number | null = null;
  if (nJobs === 0) {
    checks.experience = 0;
    add({
      code: "no_jobs",
      section: "work",
      points: WEIGHTS.experience,
      title: "No jobs with dates found",
      why: "An ATS anchors each job on its dates: that's how it tells jobs apart and counts your years of experience. Without a date range next to each job, the experience can't be read.",
      fix: "Under a heading called “Experience”, give every job a date range like “March 2021 – Present” next to its title.",
      source: GREENHOUSE_MATCH,
    });
  } else {
    monthsTotal = monthsOfExperience(P.experience, today);
    const key = (b: Block) => `${norm(b.start)}|${norm(b.end)}`;
    const parts = parsed.map((p) => p.experience.map(entryParts));
    let consistent = 0;
    let noCompany = 0;
    let disagree = 0;
    P.experience.forEach((b, i) => {
      const mine = parts[primaryIndex][i];
      const same = parsed.every(
        (p, r) =>
          p.experience[i] &&
          key(p.experience[i]) === key(b) &&
          norm(parts[r][i]?.company) === norm(mine.company) &&
          norm(parts[r][i]?.title) === norm(mine.title),
      );
      const complete = !!mine.title && !!mine.company;
      const months = monthsOfExperience([b], today);
      const when = `${b.start} – ${b.end}`;
      if (same && complete) {
        consistent++;
        jobs.push({ label: when, value: `${mine.title} · ${mine.company}`, mark: "ok", note: formatMonths(months) });
      } else {
        if (!same) disagree++;
        else noCompany++;
        jobs.push({
          label: when,
          value: [mine.title, mine.company].filter(Boolean).join(" · ") || "(no title or company found)",
          mark: "partial",
          note: !same
            ? "Read differently depending on how the file is read"
            : !mine.company
              ? "No company read with this job"
              : "No job title read with this job",
        });
      }
    });
    // jobs only some readings found count as not read
    const missingJobs = nJobs - P.experience.length;
    disagree += missingJobs;
    if (Math.min(...jobCounts) !== nJobs && missingJobs === 0) {
      // the primary found them all, another reading didn't: those jobs are already counted above
    }
    checks.experience = consistent / nJobs;
    const per = WEIGHTS.experience / nJobs;
    if (disagree > 0)
      add({
        code: "jobs_disagree",
        section: "work",
        points: per * disagree,
        title: `${plural(disagree, "job")} come${disagree === 1 ? "s" : ""} out differently depending on how the file is read`,
        why: signals.twoColumns
          ? "Your CV has two columns. Readers that go row by row mix the sidebar into your jobs, so titles, companies and dates end up with the wrong job."
          : "The order of the text inside the file isn't the order on the page, so a row-by-row reader and an in-order reader attach titles, companies and dates differently.",
        fix: signals.twoColumns
          ? "Use one column: move the sidebar's contacts and skills to the top or the end."
          : "Keep each job's title, company and dates on short lines together, then the bullets. Exporting again from Word, or uploading the .docx, can also help.",
        source: signals.twoColumns ? GREENHOUSE_PARSE : undefined,
      });
    if (noCompany > 0)
      add({
        code: "company_missing",
        section: "work",
        points: per * noCompany,
        title: `The company of ${plural(noCompany, "job")} isn't read with the job`,
        why: "The parser takes the short lines right above or next to the dates as the job's header. A company on a long line (over 80 characters, e.g. with a description and a city) or too far from the dates is left out. ATS matching uses job titles, companies and dates.",
        fix: "Keep company and title on short lines right next to the dates. Move descriptions like “Leader in …” into the first bullet.",
        source: GREENHOUSE_MATCH,
      });
    if (consistent === nJobs) good.push("Every job has its title, company and dates read together");
  }

  // ---------------------------------------------------------------- education
  const nEdu = Math.max(...parsed.map((p) => p.education.length));
  const education: ReadField[] = [];
  const eduHeading = parsed.some((p) => p.sections.some(([k]) => k === "education"));
  if (nEdu === 0) {
    checks.education = 0;
    add({
      code: eduHeading ? "education_no_dates" : "no_education",
      section: "education",
      points: WEIGHTS.education,
      title: eduHeading ? "Your education has no dates" : "No education section found",
      why: eduHeading
        ? "Degrees are anchored on their dates, like jobs. Without a year, the parser can't separate them."
        : "The parser looks for a heading such as “Education”. Without it, your degrees aren't read as education.",
      fix: eduHeading
        ? "Add the years to each degree, e.g. “2016 – 2020”, or at least the graduation year."
        : "Add a section called “Education” with your degree, school and years.",
    });
  } else {
    const keyE = (b: Block) => `${norm(b.start)}|${norm(b.end)}`;
    const same = parsed.every((p) => p.education.length === nEdu && p.education.every((b, i) => keyE(b) === keyE(P.education[i] ?? b)));
    checks.education = same ? 1 : 0.5;
    for (const b of P.education)
      education.push({
        label: b.start === b.end ? b.end : `${b.start} – ${b.end}`,
        value: firstLine(b.text),
        mark: same ? "ok" : "partial",
        note: same ? undefined : "Read differently depending on how the file is read",
      });
    if (!same)
      add({
        code: "education_disagree",
        section: "education",
        points: WEIGHTS.education / 2,
        title: "Your education comes out differently depending on how the file is read",
        why: "Readers attach the degree, school and dates differently, usually because of columns or dates far to the right.",
        fix: "Put the degree, the school and the years on short lines together, in one column.",
      });
  }

  // ---------------------------------------------------------------- skills
  const skills = P.skills;
  const skillsHeading = parsed.some((p) => p.sections.some(([k]) => k === "skills" || k === "tools"));
  const skillReads: ReadField[] = [];
  let inJobs = 0;
  if (skills.length === 0) {
    checks.skillsText = 0;
    checks.skillsList = 0;
    add({
      code: skillsHeading ? "skills_unlisted" : "no_skills",
      section: "skills",
      points: WEIGHTS.skillsText + WEIGHTS.skillsList,
      title: skillsHeading ? "Your skills aren't read as a list" : "No skills section found",
      why: "ATS profiles have a skills field, and recruiters search it. The parser fills it from a section called “Skills”, one item per comma or bullet.",
      fix: "Add a section called “Skills” and separate the skills with commas.",
      source: GREENHOUSE_MATCH,
    });
  } else {
    const ligatured = new Set(signals.ligatureWords.map((w) => norm(w)));
    const hiddenByLigature = skills.filter((s) => s.split(/\s+/).some((w) => ligatured.has(norm(w))));
    const lower = texts.map((t) => norm(t));
    const unsearchable = skills.filter((s) => !lower.every((t) => t.includes(norm(s))));
    const bad = new Set([...hiddenByLigature, ...unsearchable]);
    checks.skillsText = (skills.length - bad.size) / skills.length;
    const listCounts = parsed.map((p) => p.skills.length);
    checks.skillsList = listCounts.every((c) => Math.abs(c - skills.length) <= Math.max(1, skills.length * 0.2)) ? 1 : 0.5;
    const jobText = norm(P.experience.map((b) => b.text).join("\n"));
    inJobs = skills.filter((s) => jobText.includes(norm(s))).length;
    skillReads.push({ label: "Skills read as a list", value: plural(skills.length, "skill"), mark: checks.skillsList === 1 ? "ok" : "partial" });
    skillReads.push({ label: "Also inside a job", value: `${inJobs} of ${skills.length}`, mark: "ok" });
    if (hiddenByLigature.length)
      add({
        code: "skills_ligatures",
        section: "skills",
        points: (WEIGHTS.skillsText * hiddenByLigature.length) / skills.length,
        title: `${plural(hiddenByLigature.length, "skill")} use${hiddenByLigature.length === 1 ? "s" : ""} font ligatures: ${hiddenByLigature.slice(0, 3).join(", ")}`,
        why: "Your font joins letters like “fl” and “fi” into one sign. Some readers keep that sign, so a search for the word misses you.",
        fix: "Download the CV as Word (.docx) and upload that, or switch to a font without ligatures.",
      });
    const other = unsearchable.filter((s) => !hiddenByLigature.includes(s));
    if (other.length)
      add({
        code: "skills_unsearchable",
        section: "skills",
        points: (WEIGHTS.skillsText * other.length) / skills.length,
        title: `${plural(other.length, "skill")} can't be found in every reading: ${other.slice(0, 3).join(", ")}`,
        why: "Some readings break these words or glue them to other text, so a recruiter's search can miss them.",
        fix: "Keep each skill on one line, separated by commas.",
      });
    if (checks.skillsList < 1)
      add({
        code: "skills_list_disagree",
        section: "skills",
        points: WEIGHTS.skillsList / 2,
        title: "Your skills list comes out differently depending on how the file is read",
        why: "A sidebar or a table mixes the skills with other text in some readings.",
        fix: "Put the skills in one column, under a heading called “Skills”, separated by commas.",
      });
    const flagged = new Set([...hiddenByLigature, ...unsearchable]);
    for (const s of [...flagged].slice(0, 5)) skillReads.push({ label: s, value: null, mark: "partial", note: "Missed by some readers" });
  }

  // ---------------------------------------------------------------- headings
  const wanted: ["experience" | "education" | "skills", AtsSection["key"]][] = [
    ["experience", "work"],
    ["education", "education"],
    ["skills", "skills"],
  ];
  const foundIn = (k: string) => parsed.every((p) => p.sections.some(([s]) => s === k || (k === "skills" && s === "tools")));
  const missingHeadings = wanted.filter(([k]) => !foundIn(k));
  checks.headings = (wanted.length - missingHeadings.length) / wanted.length;
  for (const [k, section] of missingHeadings)
    add({
      code: `heading_${k}`,
      section: section as Issue["section"],
      points: WEIGHTS.headings / wanted.length,
      title: `No “${cap(k)}” heading the parser recognises`,
      why: "Parsers cut the CV into sections by their headings. A creative heading (“Where I've made an impact”) isn't recognised, so what's under it isn't read as that section.",
      fix: `Name the section “${cap(k)}”.`,
    });
  if (missingHeadings.length === 0) good.push("Standard headings: Experience, Education, Skills");

  // ---------------------------------------------------------------- diacritics and broken glyphs
  const special = /[^\x00-\x7F]/.test(P.name ?? "");
  // "\uFFFD" anywhere, or a private-use sign inside a word (a bullet drawn from a symbol font is fine)
  const broken = texts.some((t) => /\uFFFD|[\p{L}\p{N}][\uE000-\uF8FF]|[\uE000-\uF8FF][\p{L}\p{N}]/u.test(t));
  if (special || broken) {
    const sameName = new Set(parsed.map((p) => norm(p.name))).size === 1;
    checks.unicode = sameName && !broken ? 1 : 0;
    if (checks.unicode === 0)
      add({
        code: broken ? "broken_glyphs" : "diacritics",
        section: "personalInfo",
        points: WEIGHTS.unicode,
        title: broken ? "Some letters come out as unknown signs" : "The special letters in your name change between readers",
        why: broken
          ? "The font in the file doesn't say which letter each sign is, so readers get “�” or private codes instead."
          : "Letters like ă, ș or ț are stored in a way some readers can't map back.",
        fix: "Export again with a standard font (for example Arial, Calibri or Inter), or upload the .docx.",
      });
    else if (special) good.push("Diacritics read exactly");
  }

  // ---------------------------------------------------------------- the file itself
  if (signals.twoColumns && !issues.some((i) => i.code === "jobs_disagree"))
    add({
      code: "two_columns",
      section: "file",
      points: 0,
      title: "Your CV has two columns",
      why: "Both of our readings got it right, but readers that go row by row mix the columns; Greenhouse lists column layouts among the causes of failed parses.",
      fix: "For online applications, a one-column version is the safer choice.",
      source: GREENHOUSE_PARSE,
    });
  if (signals.tables > 0)
    add({
      code: "tables",
      section: "file",
      points: 0,
      title: `Your Word file uses ${plural(signals.tables, "table")}`,
      why: "Greenhouse lists tables among the causes of failed parses: some readers take the cells in an order that splits a job from its dates.",
      fix: "Replace the table with plain lines: title, company and dates, then the bullets.",
      source: GREENHOUSE_PARSE,
    });
  if (signals.textBoxes > 0 && !signals.contactsOutsideBody)
    add({
      code: "text_boxes",
      section: "file",
      points: 0,
      title: `Your Word file uses ${plural(signals.textBoxes, "text box", "text boxes")}`,
      why: "Stricter readers skip text boxes, so what's inside them can be lost.",
      fix: "Move the text out of the boxes into the page.",
      source: GREENHOUSE_PARSE,
    });
  const otherLigatures = signals.ligatureWords.filter((w) => !skills.some((s) => s.split(/\s+/).some((x) => norm(x) === norm(w))));
  if (otherLigatures.length && !issues.some((i) => i.code === "skills_ligatures"))
    add({
      code: "ligatures",
      section: "file",
      points: 0,
      title: `${plural(otherLigatures.length, "word")} use${otherLigatures.length === 1 ? "s" : ""} font ligatures: ${otherLigatures.slice(0, 3).join(", ")}`,
      why: "Some readers keep the joined sign (\uFB02, \uFB01), so a search for these words misses you.",
      fix: "Download the CV as Word (.docx) and upload that, or switch to a font without ligatures.",
    });
  if (file.kind === "text")
    add({
      code: "pasted_text",
      section: "file",
      points: 0,
      title: "You pasted text, so the file's layout isn't checked",
      why: "Columns, tables, headers and hidden links live in the file. Pasted text only shows the words.",
      fix: "Upload the PDF or Word file you send to employers for the full check.",
    });

  // ---------------------------------------------------------------- total
  const applicable = (Object.keys(WEIGHTS) as Check[]).filter((c) => checks[c] !== undefined);
  const weightSum = applicable.reduce((s, c) => s + WEIGHTS[c], 0);
  let score = round1((100 * applicable.reduce((s, c) => s + WEIGHTS[c] * (checks[c] ?? 0), 0)) / weightSum);
  // issues are written in field points; scale them to the 0–100 score
  for (const i of issues) i.points = round1((i.points * 100) / weightSum);
  if (signals.overSizeLimit && score > 50) {
    issues.push({
      code: "over_size",
      section: "file",
      points: round1(score - 50),
      title: "The file is over 2.5 MB",
      why: "Greenhouse documents that it doesn't parse files over 2.5 MB: the whole CV can go unread.",
      fix: "Export again without large pictures, or save as PDF “for the web” / smaller size.",
      source: GREENHOUSE_PARSE,
    });
    score = 50;
  }
  // the points add up to 100 − score (rounding goes to the biggest issue)
  const lost = round1(100 - score);
  const sum = round1(issues.reduce((s, i) => s + i.points, 0));
  const biggest = [...issues].sort((a, b) => b.points - a.points)[0];
  if (biggest && sum !== lost && biggest.points > 0) biggest.points = round1(biggest.points + lost - sum);
  issues.sort((a, b) => b.points - a.points || order(a) - order(b));

  const verdict: AtsReport["verdict"] =
    checks.name === 1 && checks.email === 1 && checks.phone === 1 && checks.experience === 1 &&
    (checks.skillsText ?? 0) >= 0.95 && (checks.unicode ?? 1) === 1 && checks.headings === 1 && (checks.skillsList ?? 0) >= 0.8
      ? "PASS"
      : checks.email === 1 && (checks.skillsText ?? 0) >= 0.95 && (checks.experience ?? 0) > 0
        ? "WARN"
        : "FAIL";

  if (file.kind !== "text" && !signals.twoColumns && file.kind === "pdf") good.push("One column");
  if (file.kind === "docx" && !signals.contactsOutsideBody && checks.email === 1) good.push("Contacts in the page, not the header");
  if (file.bytes !== null && !signals.overSizeLimit) good.push(`${file.pages ? `${plural(file.pages, "page")}, ` : ""}${formatBytes(file.bytes)}`);

  const content = contentCounts(P.experience);
  const sections = buildSections(checks, issues, contact, jobs, education, skillReads, monthsTotal, good, content);
  const weakest = parsed.reduce((w, p, i) => (p.experience.length < parsed[w].experience.length ? i : w), 0);

  return {
    kind: "ats-read",
    generalScore: score,
    message: summary(checks, P, nJobs, jobs, skills.length, issues, many),
    verdict,
    sections,
    issues,
    good,
    file: { ...file, twoColumns: signals.twoColumns },
    readings: parsed.length,
    monthsOfExperience: monthsTotal,
    content,
    robotText: texts[weakest] ?? "",
  };
}

const order = (i: Issue) => ["personalInfo", "work", "education", "skills", "file"].indexOf(i.section);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const firstLine = (t: string) => (splitLines(t).find((l) => l.trim()) ?? "").replace(/\u200B/g, "").trim();

export function formatMonths(m: number | null): string {
  if (m === null) return "";
  const y = Math.floor(m / 12);
  const mo = m % 12;
  return [y ? `${y} yr${y > 1 ? "s" : ""}` : "", mo ? `${mo} mo${mo > 1 ? "s" : ""}` : ""].filter(Boolean).join(" ") || "under 1 mo";
}

function formatBytes(b: number): string {
  return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

/** The verdict sentence: what an ATS reads, then what it loses. */
function summary(
  checks: Partial<Record<Check, number>>,
  P: Parsed,
  nJobs: number,
  jobs: ReadField[],
  nSkills: number,
  issues: Issue[],
  many: boolean,
): string {
  const read: string[] = [];
  if (checks.name === 1) read.push("your name");
  if (checks.email === 1) read.push("email");
  if (checks.phone === 1) read.push("phone");
  const okJobs = jobs.filter((j) => j.mark === "ok").length;
  if (nJobs > 0 && okJobs > 0)
    read.push(
      okJobs === nJobs
        ? nJobs === 1
          ? "your job with its dates"
          : nJobs === 2
            ? "both jobs with their dates"
            : `all ${nJobs} jobs with their dates`
        : `${okJobs} of ${plural(nJobs, "job")} with their dates`,
    );
  if (nSkills > 0) read.push(plural(nSkills, "skill"));
  const head = read.length ? `An ATS reads ${list(read)}.` : "An ATS reads almost nothing from this CV.";
  const costly = issues.filter((i) => i.points > 0).slice(0, 2);
  if (!costly.length) return `${head} Nothing it needs is lost${many ? ", whichever way the file is read" : ""}.`;
  return `${head} ${costly.length === 1 ? "What costs you" : "What costs you most"}: ${costly.map((i) => lowerFirst(i.title)).join("; ")}.`;
}

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * Bullets in the jobs, those with a measurable result, and those with a % but no starting point.
 * A bullet wrapped over several lines is one bullet: its continuation lines are joined to it.
 */
export function contentCounts(jobs: Block[]): AtsReport["content"] {
  const BULLET_START = /^\s*(?:[•●▪◦‣►▸→➜➔✓■◆*·]|-\s)/u;
  const bullets: string[] = [];
  for (const b of jobs) {
    let current: string | null = null;
    for (const line of splitLines(b.text)) {
      if (BULLET_START.test(line)) {
        if (current !== null) bullets.push(current);
        current = line;
      } else if (current !== null && line.trim() && !DATE_RANGE.test(line)) {
        current += ` ${line.trim()}`;
      } else if (current !== null) {
        bullets.push(current);
        current = null;
      }
    }
    if (current !== null) bullets.push(current);
  }
  const RESULT =
    /\d+(?:[.,]\d+)?\+|\d+(?:[.,]\d+)?\s*(?:%|x\b|×|ms\b|s\b|sec|min|hours?|h\b|days?|weeks?|months?|years?|k\b|m\b|bn\b|million|thousand|users|customers|clients|people|engineers|\$|€|£|lei|mdl)|[$€£]\s?\d|\bfrom\s+\S+.*\bto\s+\S*\d/iu;
  return {
    bullets: bullets.length,
    withResult: bullets.filter((t) => RESULT.test(t)).length,
    percentNoBase: bullets.filter((t) => /\d\s*%/.test(t) && !/\bfrom\b[^%]*\bto\b/i.test(t)).length,
  };
}

function buildSections(
  checks: Partial<Record<Check, number>>,
  issues: Issue[],
  contact: ReadField[],
  jobs: ReadField[],
  education: ReadField[],
  skills: ReadField[],
  months: number | null,
  good: string[],
  content: AtsReport["content"],
): AtsSection[] {
  const pct = (cs: Check[]) => {
    const on = cs.filter((c) => checks[c] !== undefined);
    const w = on.reduce((s, c) => s + WEIGHTS[c], 0);
    return w ? round1((100 * on.reduce((s, c) => s + WEIGHTS[c] * (checks[c] ?? 0), 0)) / w) : 0;
  };
  const of = (key: Issue["section"]) => issues.filter((i) => i.section === key);
  const critical = (key: Issue["section"]) =>
    of(key)
      .filter((i) => i.points > 0)
      .map((i) => `${i.title} (−${i.points} pts). ${i.why}`);
  const suggestions = (key: Issue["section"]) => of(key).map((i) => (i.points > 0 ? i.fix : `${i.title}. ${i.why} ${i.fix}`));
  const status = (fields: ReadField[], noun: string) =>
    fields.length ? `${fields.filter((f) => f.mark === "ok").length} of ${plural(fields.length, noun)} read` : `no ${noun}s read`;
  const make = (key: SectionKey, label: string, score: number, reads: ReadField[], st: string, goodHere: string[]): AtsSection => ({
    key,
    label,
    score,
    entryScore: score,
    critical: critical(key as Issue["section"]),
    suggestions: suggestions(key as Issue["section"]),
    goodPractices: goodHere,
    reads,
    status: st,
  });
  const jobsGood = good.filter((g) => /job/i.test(g));
  const fileIssues = of("file");
  const sections = [
    make("personalInfo", "Contact", pct(["name", "email", "phone", "linkedin", "unicode"]), contact, status(contact, "field"), good.filter((g) => /Contacts|Diacritics/.test(g))),
    make(
      "work",
      "Experience",
      pct(["experience"]),
      months !== null ? [...jobs, { label: "In total", value: formatMonths(months), mark: "ok", note: "counted from your dates" }] : jobs,
      status(jobs, "job"),
      jobsGood,
    ),
    make("education", "Education", pct(["education"]), education, status(education, "entry"), []),
    make("skills", "Skills", pct(["skillsText", "skillsList"]), skills, skills.length ? skills[0].value ?? "" : "no skills read", []),
  ];
  // the bullets: a counter, not a score (there's no objective measure of a good bullet)
  if (content.bullets > 0) {
    sections[1].reads.push({
      label: "Bullets with a measurable result",
      value: `${content.withResult} of ${content.bullets}`,
      mark: content.withResult * 2 >= content.bullets ? "ok" : "partial",
    });
    if (content.percentNoBase > 0)
      sections[1].suggestions.push(
        `${plural(content.percentNoBase, "bullet")} give${content.percentNoBase === 1 ? "s" : ""} a percentage with no starting point (“reduced costs by 34%”). Say from what to what (“from 40 s to 9 s”): numbers a recruiter can check read stronger.`,
      );
  }
  // the file's own issues go with the row they affect most: the experience
  for (const i of fileIssues) {
    if (i.points > 0) {
      sections[1].critical.push(`${i.title} (−${i.points} pts). ${i.why}`);
      sections[1].suggestions.push(i.fix);
    } else sections[1].suggestions.push(`${i.title}. ${i.why} ${i.fix}`);
  }
  return sections;
}

/** What the file is, for the line under the verdict: "PDF made with Google Docs · 2 pages · 75 KB · one column". */
export function fileLine(r: AtsReport): string {
  const f = r.file;
  if (f.kind === "text") return "Pasted text · the file's layout isn't checked";
  const maker = producerName(f.producer);
  const parts = [`${f.kind === "pdf" ? "PDF" : "Word file"}${maker ? ` made with ${maker}` : ""}`];
  if (f.pages) parts.push(plural(f.pages, "page"));
  if (f.bytes !== null) parts.push(formatBytes(f.bytes));
  if (f.kind === "pdf") parts.push(f.twoColumns ? "two columns" : "one column");
  parts.push("read in your browser");
  return parts.join(" · ");
}

/** The PDF Producer as people know it: "Skia/PDF m150 Google Docs Renderer" → "Google Docs". */
export function producerName(producer: string | null): string | null {
  if (!producer) return null;
  const known: [RegExp, string][] = [
    [/google docs/i, "Google Docs"],
    [/microsoft|word/i, "Microsoft Word"],
    [/libreoffice|openoffice/i, "LibreOffice"],
    [/canva/i, "Canva"],
    [/pdftex|luatex|xetex|xdvipdfmx|latex/i, "LaTeX"],
    [/quartz|mac os|pages/i, "Apple Pages or macOS"],
    [/ats hero/i, "ATS Hero"],
    [/chrome|skia/i, "a web browser"],
  ];
  for (const [re, name] of known) if (re.test(producer)) return name;
  return producer.length > 30 ? null : producer;
}
