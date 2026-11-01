/**
 * The ATS check of an uploaded (or pasted) CV, without a job: what an ATS parser starts from, field
 * by field, and what goes wrong, the way real resume parsers report it. No score: no ATS gives a CV
 * a 0–100 mark on its own (ATS-REAL-VS-NOI.md §1; claude.ai Project "App Builder").
 *
 * - **Fields read**: name, email, phone, LinkedIn (when the CV has one), every job, every degree
 *   and the skills list. With a file, a field counts as read when both readings of the file give
 *   the same thing (and a job has its title and company); pasted text has one reading.
 * - **Findings** carry the level of the closest Textkernel / RChilli code (levels.ts), a reason and
 *   a fix. Advice for the human reader (results in bullets) is kept apart: an ATS doesn't use it.
 */
import type { AtsRead, AtsSignals } from "./types";
import { NO_SIGNALS } from "./types";
import { DATE_RANGE, entryParts, headingKey, monthsOfExperience, parse, splitLines, type Block, type Parsed } from "./parse";
import type { SectionKey } from "../types";
import { ISSUE_LEVELS, LEVEL_ORDER, levelOf, type Level, type ParserRef } from "./levels";

export type { Level } from "./levels";

export type Mark = "ok" | "partial" | "lost";
export type Tone = "good" | "fair" | "poor";

/** One thing the readers got (or failed to get), as the results screen lists it. */
export interface ReadField {
  label: string;
  value: string | null;
  mark: Mark;
  note?: string;
  /** one of the fields counted in "N / M fields read" */
  counted?: boolean;
}

export interface Issue {
  code: string;
  section: "personalInfo" | "work" | "education" | "skills" | "file";
  level: Level;
  ref: ParserRef;
  title: string;
  why: string;
  fix: string;
  source?: { label: string; url: string };
}

/** Something to know that isn't a problem of the CV (pasted text, the CV's language). */
export interface Note {
  code: string;
  text: string;
  source?: { label: string; url: string };
}

export interface AtsSection {
  key: SectionKey;
  label: string;
  tone: Tone;
  /** one line for the row, e.g. "4 of 4 read the same" */
  status: string;
  reads: ReadField[];
  issues: Issue[];
  good: string[];
  /** for the human reader, not the ATS */
  recruiter: string[];
}

/** The CV's language, as far as the letters and a few words tell. */
export type Language = "en" | "ro" | "ru";

export interface AtsReport {
  kind: "ats-read";
  version: 2;
  language: Language;
  message: string;
  fields: { read: number; total: number };
  /** the worst level found, null when nothing */
  worst: Level | null;
  counts: Record<Level, number>;
  sections: AtsSection[];
  issues: Issue[];
  good: string[];
  notes: Note[];
  file: { kind: "pdf" | "docx" | "text"; producer: string | null; pages: number | null; bytes: number | null; twoColumns: boolean };
  /** readings compared (2 for a file, 1 for pasted text) */
  readings: number;
  monthsOfExperience: number | null;
  content: { bullets: number; withResult: number; percentNoBase: number };
  /** the text as the weakest reading read it, for "Text the robot read" */
  robotText: string;
}

export const GREENHOUSE_PARSE = {
  label: "Greenhouse Support: Unsuccessful resume parse",
  url: "https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse",
};
export const GREENHOUSE_MATCH = {
  label: "Greenhouse Support: Talent Matching FAQ",
  url: "https://support.greenhouse.io/hc/en-us/articles/41131616864283-Talent-Matching-Data-Processing-FAQ",
};
export const TEXTKERNEL_QUALITY = {
  label: "Textkernel: Resume Quality codes",
  url: "https://developer.textkernel.com/tx-platform/v10/resume-parser/overview/parser-output",
};
const TALEO_ATTACHMENTS = {
  label: "Oracle Taleo: attachment settings",
  url: "https://docs.oracle.com/en/cloud/saas/taleo-enterprise/22d/otrcg/c-attachmentpermissionsandsettings.html",
};
const TALEO_LANGUAGES = {
  label: "Oracle Taleo: supported languages",
  url: "https://docs.oracle.com/en/cloud/saas/taleo-enterprise/21c/otrcg/r-supportedlanguages.html",
};
const WORKABLE_FILES = {
  label: "Workable: supported files",
  url: "https://help.workable.com/hc/en-us/articles/115012238108",
};

const MB = 1024 * 1024;
const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFKC").replace(/\u200B/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Check a file read by `readForAts`. */
export function scoreRead(read: AtsRead, today = new Date()): AtsReport {
  return scoreReadings(
    read.readings.map((r) => r.text),
    read.signals,
    { kind: read.kind, producer: read.producer, pages: read.pages, bytes: read.bytes },
    today,
  );
}

/** Check pasted text: one reading, no layout to check. */
export function scoreText(text: string, today = new Date()): AtsReport {
  return scoreReadings([text], NO_SIGNALS, { kind: "text", producer: null, pages: null, bytes: null }, today);
}

type Draft = Omit<Issue, "level" | "ref">;

/** Russian when most letters are Cyrillic; Romanian when it has its letters and words; else English. */
export function languageOf(text: string): Language {
  const letters = text.match(/\p{L}/gu) ?? [];
  const cyrillic = letters.filter((c) => /\p{Script=Cyrillic}/u.test(c)).length;
  if (letters.length && cyrillic * 2 > letters.length) return "ru";
  const marks = (text.match(/[ăâîșşțţĂÂÎȘŞȚŢ]/g) ?? []).length;
  if (marks >= 4 && /(?<!\p{L})(?:și|şi|în|pentru|experien[țţ][ăa]|educa[țţ]ie|competen[țţ]e|universitatea|prezent)(?!\p{L})/iu.test(text)) return "ro";
  return "en";
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
  const differently = "Read differently by the two readers";
  const issues: Issue[] = [];
  const good: string[] = [];
  const notes: Note[] = [];
  const add = (d: Draft) => issues.push({ ...d, level: levelOf(d.code), ref: ISSUE_LEVELS[d.code]?.ref ?? {} });
  const has = (code: string) => issues.some((i) => i.code === code);
  const noSections = parsed.every((p) => p.sections.length === 0);
  const language = languageOf(texts[primaryIndex] ?? "");
  const NAMES = { en: "English", ro: "Romanian", ru: "Russian" } as const;
  if (language !== "en" && noSections)
    notes.push({
      code: "language_unknown",
      text: `This CV looks ${NAMES[language]}, and our reader found no heading it knows in it. If your headings are standard, the problem is our reader, not your CV: check the findings below against your CV.`,
    });
  if (language !== "en")
    notes.push({
      code: "taleo_language",
      text: "Some ATSs parse only some languages. Oracle Taleo lists full resume parsing for English only, limited parsing for Dutch, French, German, Italian, Brazilian Portuguese and Spanish, and none for Romanian or Russian. For an international employer, an English CV is the safer choice.",
      source: TALEO_LANGUAGES,
    });

  // ---------------------------------------------------------------- contact
  const contact: ReadField[] = [];
  const nameValues = parsed.map((p) => p.name);
  const nameBroken = (n: string | null) => !!n && n.split(/\s+/).some((w) => headingKey(w) !== null);
  const goodNames = nameValues.filter((n) => n && !nameBroken(n));
  if (goodNames.length === parsed.length && new Set(goodNames.map(norm)).size === 1) {
    contact.push({ label: "Name", value: P.name, mark: "ok", counted: true });
  } else if (goodNames.length > 0) {
    const odd = nameValues.find((n) => !n || nameBroken(n) || norm(n) !== norm(goodNames[0]));
    contact.push({
      label: "Name",
      value: goodNames[0],
      mark: "partial",
      counted: true,
      note: signals.contactsOutsideBody ? "Only in the page header or a text box" : odd ? `Also read as “${odd}”` : "Not found by every reader",
    });
    if (!signals.contactsOutsideBody)
      add({
        code: "name_mixed",
        section: "personalInfo",
        title: odd ? `Your name is also read as “${odd}”` : "One reader misses your name",
        why: "Parsers take the name from the first short line of capitalised words. When a heading or a sidebar line sits next to it, a reader glues them together.",
        fix: "Put your name alone on the first line, with nothing to its left or right.",
      });
  } else {
    contact.push({ label: "Name", value: null, mark: "lost", counted: true, note: "Not found" });
    add({
      code: "name_missing",
      section: "personalInfo",
      title: "Your name isn't found",
      why: "Parsers look for a short line of 2 to 4 capitalised words near the top. Yours is missing, has digits or symbols, or sits in a header or text box. Textkernel and RChilli rate a missing name as a major issue.",
      fix: "Start the CV with your name alone on its own line, in the page itself (not in the page header).",
    });
  }

  const lostContacts: ("email" | "phone")[] = [];
  for (const [check, label, pick] of [
    ["email", "Email", (p: Parsed) => p.emails[0] ?? null],
    ["phone", "Phone", (p: Parsed) => p.phones[0] ?? null],
  ] as const) {
    const found = parsed.map(pick);
    const hits = found.filter(Boolean).length;
    const value = pick(P) ?? found.find(Boolean) ?? null;
    if (hits === parsed.length) {
      contact.push({ label, value, mark: "ok", counted: true });
    } else if (hits > 0) {
      const outside = signals.contactsOutsideBody;
      contact.push({ label, value, mark: "partial", counted: true, note: outside ? "Only in the page header or a text box" : "Not found by every reader" });
      if (!outside)
        add({
          code: `${check}_partial`,
          section: "personalInfo",
          title: `One reader misses your ${label.toLowerCase()}`,
          why: "It's broken over two lines or glued to other text in one reading of the file.",
          fix: `Put your ${label.toLowerCase()} on one line, with spaces or a “|” around it.`,
        });
    } else {
      contact.push({ label, value: null, mark: "lost", counted: true, note: "Not found" });
      lostContacts.push(check);
    }
  }
  if (lostContacts.length === 2)
    add({
      code: "contacts_missing",
      section: "personalInfo",
      title: "No email and no phone found",
      why: "Recruiters contact you through what the ATS read. Textkernel and RChilli rate a CV with neither an email nor a phone as fatal.",
      fix: "Add your email and phone under your name, as plain text.",
      source: TEXTKERNEL_QUALITY,
    });
  else
    for (const check of lostContacts)
      add({
        code: `${check}_missing`,
        section: "personalInfo",
        title: `No ${check} found`,
        why: `Recruiters contact you through what the ATS read. Without a ${check} in the text, that field stays empty.`,
        fix: `Add your ${check} under your name, as plain text.`,
      });

  const linkedinHidden = signals.hiddenLinks.find((l) => /linkedin\.com/i.test(l.url));
  const slugs = parsed.map((p) => p.linkedin);
  const mentions = texts.some((t) => /linkedin/i.test(t));
  if (slugs.some(Boolean) || linkedinHidden || mentions) {
    const hits = slugs.filter(Boolean).length;
    if (hits === parsed.length && new Set(slugs).size === 1) {
      contact.push({ label: "LinkedIn", value: `linkedin.com/in/${slugs[0]}`, mark: "ok", counted: true });
    } else if (hits > 0) {
      contact.push({
        label: "LinkedIn",
        value: `linkedin.com/in/${slugs.find(Boolean)}`,
        mark: "partial",
        counted: true,
        note: signals.contactsOutsideBody ? "Only in the page header or a text box" : "Cut or missing in one reading",
      });
      if (!signals.contactsOutsideBody)
        add({
          code: "linkedin_cut",
          section: "personalInfo",
          title: "Your LinkedIn address is cut in one reading",
          why: "A long address wraps onto a second line, and the reader keeps only the first part.",
          fix: "Shorten it (linkedin.com/in/your-name, without https://www.) or give it its own line.",
        });
    } else if (linkedinHidden) {
      const word = linkedinHidden.label || "LinkedIn";
      contact.push({ label: "LinkedIn", value: null, mark: "lost", counted: true, note: `Only the word “${word}”: the address is a hidden link` });
      add({
        code: "linkedin_hidden",
        section: "personalInfo",
        title: "Your LinkedIn is a hidden link",
        why: `Text readers take the word “${word}”, not the address behind it. Some parsers also read links; many don't.`,
        fix: "Write the address out, e.g. linkedin.com/in/your-name.",
      });
    } else {
      contact.push({ label: "LinkedIn", value: null, mark: "lost", counted: true, note: "Mentioned, but no address" });
      add({
        code: "linkedin_no_address",
        section: "personalInfo",
        title: "LinkedIn is mentioned without its address",
        why: "The text says “LinkedIn” but no linkedin.com/in/… address follows, so the field stays empty.",
        fix: "Write the address out, e.g. linkedin.com/in/your-name.",
      });
    }
  }

  if (signals.contactsOutsideBody)
    add({
      code: "contacts_outside_body",
      section: "personalInfo",
      title: "Your contacts are only in the page header or a text box",
      why: "Stricter readers take the page body only. Greenhouse documents that contact details in a header, footer or text box aren't parsed, and iCIMS can't parse a name in the page header.",
      fix: "Move your name, email, phone and LinkedIn into the page itself, at the top.",
      source: GREENHOUSE_PARSE,
    });

  // ---------------------------------------------------------------- the whole CV
  if (noSections)
    add({
      code: "no_sections",
      section: "work",
      title: language === "en" ? "No sections found" : "No headings our reader knows",
      why:
        language === "en"
          ? "Parsers cut a CV into sections by headings such as “Experience”, “Education” and “Skills”. None was found, so nothing can be placed in the profile. Textkernel and RChilli rate this as fatal."
          : "Parsers cut a CV into sections by their headings, and our reader found none it knows. That may be our reader's limit; but parsers that don't know your CV's language place nothing in the profile either, which Textkernel and RChilli rate as fatal.",
      fix: "Use standard headings, each on its own line: Experience, Education, Skills.",
      source: TEXTKERNEL_QUALITY,
    });

  // ---------------------------------------------------------------- experience
  const jobCounts = parsed.map((p) => p.experience.length);
  const nJobs = Math.max(...jobCounts);
  const jobs: ReadField[] = [];
  let monthsTotal: number | null = null;
  let disagree = 0;
  if (nJobs === 0) {
    const heading = parsed.some((p) => p.sections.some(([k]) => k === "experience"));
    if (heading)
      add({
        code: "jobs_no_dates",
        section: "work",
        title: "Your jobs have no dates the parser can read",
        why: "An ATS anchors each job on its date range: that's how it tells jobs apart and counts your years of experience. Textkernel and RChilli rate jobs without dates as fatal.",
        fix: "Give every job a date range next to its title, like “March 2021 – Present” or “03/2021 – 02/2023”.",
        source: GREENHOUSE_MATCH,
      });
    else if (!noSections)
      add({
        code: "no_jobs",
        section: "work",
        title: "No Experience section found",
        why: "Parsers look for a heading such as “Experience” or “Work experience” and read the jobs under it. Without it, your jobs aren't read as jobs. Textkernel and RChilli rate this as fatal.",
        fix: "Put your jobs under a heading called “Experience”, each with its title, company and dates.",
        source: TEXTKERNEL_QUALITY,
      });
  } else {
    monthsTotal = monthsOfExperience(P.experience, today);
    const key = (b: Block) => `${norm(b.start)}|${norm(b.end)}`;
    const parts = parsed.map((p) => p.experience.map(entryParts));
    let consistent = 0;
    let incomplete = 0;
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
      const when = `${b.start} – ${b.end}`;
      if (same && complete) {
        consistent++;
        jobs.push({ label: when, value: `${mine.title} · ${mine.company}`, mark: "ok", counted: true, note: formatMonths(monthsOfExperience([b], today)) });
      } else {
        if (!same) disagree++;
        else incomplete++;
        jobs.push({
          label: when,
          value: [mine.title, mine.company].filter(Boolean).join(" · ") || "(no title or company found)",
          mark: "partial",
          counted: true,
          note: !same ? differently : !mine.company ? "No company read with this job" : "No job title read with this job",
        });
      }
    });
    // a job only some readings found is a job read differently
    disagree += nJobs - P.experience.length;
    if (disagree > 0 && !signals.twoColumns)
      add({
        code: "jobs_disagree",
        section: "work",
        title: `${plural(disagree, "job")} ${disagree === 1 ? "is" : "are"} read differently by the two readers`,
        why: "The order of the text inside the file isn't the order on the page, so a row-by-row reader and an in-order reader attach titles, companies and dates differently. A parser has the same choice to make.",
        fix: "Keep each job's title, company and dates on short lines together, then the bullets. Exporting again from Word, or uploading the .docx, can also help.",
      });
    if (incomplete > 0)
      add({
        code: "company_missing",
        section: "work",
        title: `${plural(incomplete, "job")} ${incomplete === 1 ? "is" : "are"} read without a company or title`,
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
    if (eduHeading)
      add({
        code: "education_no_dates",
        section: "education",
        title: "Our reader couldn't separate your degrees",
        why: "We found the Education heading, but our reader finds each degree by its years, and yours have none. Many ATS parsers don't need the years (Textkernel even advises leaving them out), so this may be our reader's limit, not theirs.",
        fix: "If you show years, put them next to each degree, e.g. “2016 – 2020”. If you don't, real parsers can still read your degrees.",
      });
    else if (!noSections)
      add({
        code: "no_education",
        section: "education",
        title: "No Education section found",
        why: "Textkernel and RChilli rate a CV without an Education section as fatal: the parser has nowhere to put your studies.",
        fix: "Add a section called “Education”. If you have no degree, list your school, a course or a certification there.",
        source: TEXTKERNEL_QUALITY,
      });
  } else {
    const keyE = (b: Block) => `${norm(b.start)}|${norm(b.end)}`;
    const same = parsed.every((p) => p.education.length === nEdu && p.education.every((b, i) => keyE(b) === keyE(P.education[i] ?? b)));
    for (const b of P.education)
      education.push({
        label: b.start === b.end ? b.end : `${b.start} – ${b.end}`,
        value: firstLine(b.text),
        mark: same ? "ok" : "partial",
        counted: true,
        note: same ? undefined : differently,
      });
    if (!same)
      add({
        code: "education_disagree",
        section: "education",
        title: "Your education is read differently by the two readers",
        why: "Readers attach the degree, school and dates differently, usually because of columns or dates far to the right.",
        fix: "Put the degree, the school and the years on short lines together, in one column.",
      });
  }

  // ---------------------------------------------------------------- skills
  const skills = P.skills;
  const skillsHeading = parsed.some((p) => p.sections.some(([k]) => k === "skills" || k === "tools"));
  const skillReads: ReadField[] = [];
  if (skills.length === 0) {
    if (skillsHeading)
      add({
        code: "skills_unlisted",
        section: "skills",
        title: "Your skills aren't read as a list",
        why: "There's a Skills heading, but nothing under it that a reader can split into items: one item per comma or bullet.",
        fix: "Separate the skills with commas or bullets. Show your main skills in the jobs where you used them, too.",
      });
    else if (!noSections)
      add({
        code: "no_skills",
        section: "skills",
        title: "No skills list found",
        why: "Recruiters search for skills, and Greenhouse matches the skills its parser finds. Textkernel prefers skills shown inside your jobs, and Workday doesn't fill its Skills field from the CV at all, so both places help.",
        fix: "Add a short “Skills” list separated by commas, and show your main skills in the jobs where you used them.",
        source: GREENHOUSE_MATCH,
      });
  } else {
    const ligatured = new Set(signals.ligatureWords.map((w) => norm(w)));
    const hiddenByLigature = skills.filter((s) => s.split(/\s+/).some((w) => ligatured.has(norm(w))));
    const lower = texts.map((t) => norm(t));
    const unsearchable = skills.filter((s) => !lower.every((t) => t.includes(norm(s))));
    const bad = new Set([...hiddenByLigature, ...unsearchable]);
    const listCounts = parsed.map((p) => p.skills.length);
    const listSame = listCounts.every((c) => Math.abs(c - skills.length) <= Math.max(1, skills.length * 0.2));
    const jobText = norm(P.experience.map((b) => b.text).join("\n"));
    const inJobs = skills.filter((s) => jobText.includes(norm(s))).length;
    skillReads.push({
      label: "Skills list",
      value: plural(skills.length, "skill"),
      mark: listSame && bad.size === 0 ? "ok" : "partial",
      counted: true,
      note: !listSame ? "The list comes out differently in one reading" : bad.size ? "Some skills are missed by one reader" : undefined,
    });
    skillReads.push({ label: "Also shown in a job", value: `${inJobs} of ${skills.length}`, mark: "ok" });
    if (hiddenByLigature.length)
      add({
        code: "skills_ligatures",
        section: "skills",
        title: `${plural(hiddenByLigature.length, "skill")} use${hiddenByLigature.length === 1 ? "s" : ""} font ligatures: ${hiddenByLigature.slice(0, 3).join(", ")}`,
        why: "Your font joins letters like “fl” and “fi” into one sign. Some readers keep that sign, so a search for the word misses you.",
        fix: "Download the CV as Word (.docx) and upload that, or switch to a font without ligatures.",
      });
    const other = unsearchable.filter((s) => !hiddenByLigature.includes(s));
    if (other.length)
      add({
        code: "skills_unsearchable",
        section: "skills",
        title: `${plural(other.length, "skill")} can't be found in every reading: ${other.slice(0, 3).join(", ")}`,
        why: "One reading breaks these words or glues them to other text, so a recruiter's search can miss them.",
        fix: "Keep each skill on one line, separated by commas.",
      });
    if (!listSame)
      add({
        code: "skills_list_disagree",
        section: "skills",
        title: "Your skills list is read differently by the two readers",
        why: "A sidebar or a table mixes the skills with other text in one reading.",
        fix: "Put the skills in one column, under a heading called “Skills”, separated by commas.",
      });
    const flagged = new Set([...hiddenByLigature, ...unsearchable]);
    for (const s of [...flagged].slice(0, 5)) skillReads.push({ label: s, value: null, mark: "partial", note: "Missed by one reader" });
  }

  // ---------------------------------------------------------------- headings
  const wanted: ["experience" | "education" | "skills", Issue["section"], string[]][] = [
    ["experience", "work", ["no_jobs", "jobs_no_dates"]],
    ["education", "education", ["no_education", "education_no_dates"]],
    ["skills", "skills", ["no_skills", "skills_unlisted"]],
  ];
  const foundIn = (k: string) => parsed.every((p) => p.sections.some(([s]) => s === k || (k === "skills" && s === "tools")));
  let headingsOk = true;
  for (const [k, section, covered] of wanted) {
    if (foundIn(k)) continue;
    headingsOk = false;
    // a section that's missing altogether is one finding, not two
    if (noSections || covered.some(has)) continue;
    add({
      code: `heading_${k}`,
      section,
      title: `One reader doesn't find your “${cap(k)}” heading`,
      why: "Parsers cut the CV into sections by their headings. When a heading is glued to other text or is a creative one (“Where I've made an impact”), what's under it isn't read as that section.",
      fix: `Name the section “${cap(k)}”, alone on its line.`,
    });
  }
  if (headingsOk) good.push("Standard headings: Experience, Education, Skills");

  // ---------------------------------------------------------------- diacritics and broken glyphs
  const special = /[^\x00-\x7F]/.test(P.name ?? "");
  // "\uFFFD" anywhere, or a private-use sign inside a word (a bullet drawn from a symbol font is fine)
  const broken = texts.some((t) => /\uFFFD|[\p{L}\p{N}][\uE000-\uF8FF]|[\uE000-\uF8FF][\p{L}\p{N}]/u.test(t));
  if (broken)
    add({
      code: "broken_glyphs",
      section: "personalInfo",
      title: "Some letters come out as unknown signs",
      why: "The font in the file doesn't say which letter each sign is, so readers get “\uFFFD” or private codes instead.",
      fix: "Export again with a standard font (for example Arial, Calibri or Inter), or upload the .docx.",
    });
  else if (special) {
    if (new Set(parsed.map((p) => norm(p.name))).size === 1) good.push("The special letters in your name read exactly");
    else
      add({
        code: "diacritics",
        section: "personalInfo",
        title: "The special letters in your name change between readers",
        why: "Letters like ă, ș or ț are stored in a way some readers can't map back.",
        fix: "Export again with a standard font (for example Arial, Calibri or Inter), or upload the .docx.",
      });
  }

  // ---------------------------------------------------------------- the file itself
  if (signals.twoColumns)
    add({
      code: "two_columns",
      section: "file",
      title: disagree > 0 ? `Your two columns mix up ${plural(disagree, "job")}` : "Your CV has two columns",
      why:
        (disagree > 0
          ? "Readers that go row by row mix the sidebar into your jobs, so titles, companies and dates end up with the wrong job. "
          : "Both of our readers got it right this time, but readers that go row by row mix the columns. ") +
        "Textkernel and RChilli rate column layouts as fatal, and Greenhouse lists them among the causes of failed parses.",
      fix: "Use one column: move the sidebar's contacts and skills to the top or the end.",
      source: GREENHOUSE_PARSE,
    });
  if (signals.tables > 0)
    add({
      code: "tables",
      section: "file",
      title: `Your Word file uses ${plural(signals.tables, "table")}`,
      why: "Greenhouse lists tables among the causes of failed parses: some readers take the cells in an order that splits a job from its dates.",
      fix: "Replace the table with plain lines: title, company and dates, then the bullets.",
      source: GREENHOUSE_PARSE,
    });
  if (signals.textBoxes > 0 && !signals.contactsOutsideBody)
    add({
      code: "text_boxes",
      section: "file",
      title: `Your Word file uses ${plural(signals.textBoxes, "text box", "text boxes")}`,
      why: "Stricter readers skip text boxes, so what's inside them can be lost. Greenhouse and iCIMS name text boxes among what parses worst.",
      fix: "Move the text out of the boxes into the page.",
      source: GREENHOUSE_PARSE,
    });
  const otherLigatures = signals.ligatureWords.filter((w) => !skills.some((s) => s.split(/\s+/).some((x) => norm(x) === norm(w))));
  if (otherLigatures.length && !has("skills_ligatures"))
    add({
      code: "ligatures",
      section: "file",
      title: `${plural(otherLigatures.length, "word")} use${otherLigatures.length === 1 ? "s" : ""} font ligatures: ${otherLigatures.slice(0, 3).join(", ")}`,
      why: "Some readers keep the joined sign (\uFB02, \uFB01), so a search for these words misses you.",
      fix: "Download the CV as Word (.docx) and upload that, or switch to a font without ligatures.",
    });
  if (file.bytes !== null && file.bytes > 2.5 * MB)
    add({
      code: "over_size",
      section: "file",
      title: `The file is ${formatBytes(file.bytes)}`,
      why:
        file.bytes > 5 * MB
          ? "Workable doesn't accept files over 5 MB, and Greenhouse doesn't parse files over 2.5 MB: there, the whole CV goes unread."
          : "Greenhouse doesn't parse files over 2.5 MB: there, the whole CV goes unread. Other ATSs may still read it.",
      fix: "Export again without large pictures, or save the PDF at a smaller size.",
      source: file.bytes > 5 * MB ? WORKABLE_FILES : GREENHOUSE_PARSE,
    });
  else if (file.bytes !== null && file.bytes > MB)
    add({
      code: "size_taleo",
      section: "file",
      title: `The file is ${formatBytes(file.bytes)}`,
      why: "Oracle Taleo's default limit is 1 MB per attachment, and employers often keep it.",
      fix: "Export again without large pictures, or save the PDF at a smaller size.",
      source: TALEO_ATTACHMENTS,
    });
  if (file.kind === "pdf")
    add({
      code: "pdf",
      section: "file",
      title: "Some parsers prefer Word to PDF",
      why: "Textkernel and RChilli flag every PDF as a major issue, because a PDF keeps no reading order. In our lab, one-column PDFs read almost perfectly and Word files perfectly.",
      fix: "If the job site accepts .docx, upload the Word version. Otherwise a one-column PDF is fine.",
      source: TEXTKERNEL_QUALITY,
    });
  if (file.kind === "text")
    notes.push({
      code: "pasted_text",
      text: "You pasted text, so the file's layout isn't checked: columns, tables, page headers and hidden links live in the file. Upload the PDF or Word file you send to employers for the full check.",
    });

  if (file.kind === "pdf" && !signals.twoColumns) good.push("One column");
  if (file.kind === "docx" && !signals.contactsOutsideBody && contact.find((f) => f.label === "Email")?.mark === "ok") good.push("Contacts in the page, not the header");
  if (file.bytes !== null && file.bytes <= MB) good.push(`${file.pages ? `${plural(file.pages, "page")}, ` : "File size "}${formatBytes(file.bytes)}`);

  issues.sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || order(a) - order(b));
  const counts = Object.fromEntries(LEVEL_ORDER.map((l) => [l, issues.filter((i) => i.level === l).length])) as Record<Level, number>;
  const worst = LEVEL_ORDER.find((l) => counts[l] > 0) ?? null;

  const counted = [...contact, ...jobs, ...education, ...skillReads].filter((f) => f.counted);
  const fields = { read: counted.filter((f) => f.mark === "ok").length, total: counted.length };

  const content = contentCounts(P.experience);
  const sections = buildSections(issues, contact, jobs, education, skillReads, monthsTotal, good, content, many, nJobs, skills.length);
  const weakest = parsed.reduce((w, p, i) => (p.experience.length < parsed[w].experience.length ? i : w), 0);

  return {
    kind: "ats-read",
    version: 2,
    language,
    message: summary(contact, jobs, nJobs, skills.length, issues, many),
    fields,
    worst,
    counts,
    sections,
    issues,
    good,
    notes,
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

/** A row's (or the circle's) colour: red for a critical finding, amber for major or missing, green otherwise. */
export function toneOfLevel(level: Level | null, missingIsFair = true): Tone {
  if (level === "critical") return "poor";
  if (level === "major" || (level === "missing" && missingIsFair)) return "fair";
  return "good";
}

export function formatMonths(m: number | null): string {
  if (m === null) return "";
  const y = Math.floor(m / 12);
  const mo = m % 12;
  return [y ? `${y} yr${y > 1 ? "s" : ""}` : "", mo ? `${mo} mo${mo > 1 ? "s" : ""}` : ""].filter(Boolean).join(" ") || "under 1 mo";
}

function formatBytes(b: number): string {
  return b >= MB ? `${(b / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

/** The sentence at the top: what the readers got, then the most important finding. */
function summary(contact: ReadField[], jobs: ReadField[], nJobs: number, nSkills: number, issues: Issue[], many: boolean): string {
  const got: string[] = [];
  const ok = (label: string) => contact.find((f) => f.label === label)?.mark === "ok";
  if (ok("Name")) got.push("your name");
  if (ok("Email")) got.push("email");
  if (ok("Phone")) got.push("phone");
  const okJobs = jobs.filter((j) => j.mark === "ok").length;
  if (nJobs > 0 && okJobs > 0)
    got.push(
      okJobs === nJobs
        ? nJobs === 1
          ? "your job with its dates"
          : nJobs === 2
            ? "both jobs with their dates"
            : `all ${nJobs} jobs with their dates`
        : `${okJobs} of ${plural(nJobs, "job")} in full`,
    );
  if (nSkills > 0) got.push(plural(nSkills, "skill"));
  const who = many ? "Both readers got" : "The reader got";
  const head = got.length ? `${who} ${list(got)}.` : many ? "The readers got almost nothing from this CV." : "The reader got almost nothing from this text.";
  const top = issues.find((i) => i.level === "critical" || i.level === "major");
  if (top) return `${head} Most important: ${lowerFirst(top.title)}.`;
  const gap = issues.find((i) => i.level === "missing");
  if (gap) return `${head} Missing: ${lowerFirst(gap.title)}.`;
  return `${head} Nothing the profile needs is lost.`;
}

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) && !/^(LinkedIn|Word|Greenhouse)\b/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
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
  issues: Issue[],
  contact: ReadField[],
  jobs: ReadField[],
  education: ReadField[],
  skills: ReadField[],
  months: number | null,
  good: string[],
  content: AtsReport["content"],
  many: boolean,
  nJobs: number,
  nSkills: number,
): AtsSection[] {
  const of = (...keys: Issue["section"][]) => issues.filter((i) => keys.includes(i.section));
  const worstOf = (list: Issue[]) => LEVEL_ORDER.find((l) => list.some((i) => i.level === l)) ?? null;
  const read = (fields: ReadField[]) => fields.filter((f) => f.mark === "ok").length;
  const same = many ? " the same" : "";
  const make = (key: SectionKey, label: string, own: Issue[], reads: ReadField[], status: string, goodHere: string[], recruiter: string[] = []): AtsSection => ({
    key,
    label,
    tone: toneOfLevel(worstOf(own)),
    status,
    reads,
    issues: own,
    good: goodHere,
    recruiter,
  });
  const recruiter: string[] = [];
  if (content.bullets > 0)
    recruiter.push(
      `${content.withResult} of ${plural(content.bullets, "bullet")} show${content.bullets === 1 ? "s" : ""} a measurable result (a number, a size, a time). Results are what a recruiter remembers.`,
    );
  if (content.percentNoBase > 0)
    recruiter.push(
      `${plural(content.percentNoBase, "bullet")} give${content.percentNoBase === 1 ? "s" : ""} a percentage with no starting point (“reduced costs by 34%”). Say from what to what (“from 40 s to 9 s”): numbers a recruiter can check read stronger.`,
    );
  const skillsList = skills.find((f) => f.counted);
  return [
    make("personalInfo", "Contact", of("personalInfo"), contact, `${read(contact)} of ${plural(contact.length, "field")} read${same}`, good.filter((g) => /Contacts|letters/.test(g))),
    make(
      "work",
      "Experience",
      // the file's own findings go with the row they affect most: the experience
      of("work", "file"),
      months !== null ? [...jobs, { label: "In total", value: formatMonths(months), mark: "ok", note: "counted from your dates" }] : jobs,
      nJobs === 0 ? "no jobs read" : `${read(jobs)} of ${plural(nJobs, "job")} read in full`,
      good.filter((g) => /job|column|page|File size|headings/i.test(g)),
      recruiter,
    ),
    make("education", "Education", of("education"), education, education.length ? `${read(education)} of ${plural(education.length, "entry", "entries")} read${same}` : "no entries read", []),
    make(
      "skills",
      "Skills",
      of("skills"),
      skills,
      nSkills === 0 ? "no skills list" : `${plural(nSkills, "skill")}${skillsList?.mark === "ok" ? "" : " · read differently"}`,
      [],
    ),
  ];
}

/** What the file is, for the line under the summary: "PDF made with Google Docs · 2 pages · 75 KB · one column". */
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
