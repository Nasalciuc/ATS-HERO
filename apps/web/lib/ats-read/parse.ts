/**
 * The ATS lab's reference parser (apps/ai/app/lab/parser.py), ported line for line so the browser
 * reads an uploaded CV exactly as the lab does. tests/ats-parse.test.ts runs both against the same
 * cases (tools/ats-lab/parity/cases.jsonl); change one parser, regenerate the cases, and the other
 * must follow.
 *
 * Python and JavaScript regexes differ in small ways; the port keeps Python's meaning:
 * - `\d` and `\w` are Unicode in Python: written here as \p{Nd} and [\p{L}\p{N}_] where it matters;
 * - `str.splitlines()` splits on more than "\n" and drops a final empty line: `splitLines`;
 * - `len()` counts code points: `[...s].length`.
 *
 * What a parser does with the text an extractor hands it: find contact tokens, cut the text into
 * sections by heading, anchor each job and degree on its dates, split the skills into items.
 * Below the port, two things the lab parser doesn't do: split an entry into title and company,
 * and count the years of experience from the dates (what an ATS filter on "3+ years" uses).
 */

const HEADINGS: Record<string, string[]> = {
  summary: ["summary", "professional summary", "profile", "about me", "objective", "rezumat", "profil"],
  experience: ["experience", "work experience", "professional experience", "employment",
    "employment history", "work history", "experiență", "experienta", "experiență profesională"],
  education: ["education", "educație", "educatie", "studii"],
  skills: ["skills", "technical skills", "hard skills", "skills & awards", "skills and awards",
    "skills & languages", "competențe", "competente", "abilități"],
  tools: ["tools", "instruments", "technologies"],
  soft_skills: ["soft skills"],
  languages: ["languages", "limbi", "limbi străine"],
  certifications: ["certifications", "certificates", "training & certifications",
    "training and certifications", "certificări"],
  awards: ["awards", "honors", "awards & honors", "premii"],
  publications: ["publications", "publicații"],
  volunteering: ["volunteering", "volunteer experience", "voluntariat"],
  activities: ["activities", "relevant activities", "projects", "activități"],
  links: ["links", "profiles"],
};
const HEADING_INDEX = new Map(Object.entries(HEADINGS).flatMap(([k, vs]) => vs.map((v) => [v, k] as const)));

export type SectionKey = keyof typeof HEADINGS;

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|" +
  "sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const DATE = `(?:(?:${MONTHS})\\.?\\s+(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])/(?:19|20)\\d{2}|(?:19|20)\\d{2})`;
export const DATE_RANGE = new RegExp(
  `(?<start>${DATE})\\s*(?:–|—|-|to|until)\\s*(?<end>${DATE}|present|current|now|prezent)`,
  "iu",
);
const SINGLE_DATE = new RegExp(`(?<![\\p{Nd}/.])(?<date>${DATE})(?![\\p{Nd}/])`, "iu");
const RANGE_CUT = new RegExp(`${DATE}\\s*(?:–|—|-|to|until)\\s*$`, "iu");
const RANGE_REST = new RegExp(`^\\s*(?:${DATE}|present|current|now|prezent)(?![\\p{L}\\p{N}_])`, "iu");
const SLUG_CUT = /linkedin\.com\/in\/$/i;
const SLUG_REST = /^[A-Za-z0-9\-_%]/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?<![\p{L}\p{N}_/])\+?\p{Nd}[\p{Nd}\s().-]{7,}\p{Nd}(?![\p{L}\p{N}_/])/gu;
const LINKEDIN = /linkedin\.com\/in\/([A-Za-z0-9\-_%]+)/i;
const LIGATURES = /[ﬀ-ﬆ]/g;
const BULLET = /^[\s•●▪◦‣►▸→➜➔✓■◆\-*·]+/u;
const LEVEL = /\s*\((?:a1|a2|b1|b2|c1|c2|native)\)\s*$/i;

/** Python's str.splitlines(). */
export function splitLines(s: string): string[] {
  if (s === "") return [];
  const parts = s.split(/\r\n|[\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (parts[parts.length - 1] === "") parts.pop();
  return parts;
}

const rstrip = (s: string) => s.replace(/[\s\x1c-\x1f\x85]+$/u, "");
const strip = (s: string) => s.replace(/^[\s\x1c-\x1f\x85]+/u, "").replace(/[\s\x1c-\x1f\x85]+$/u, "");
const len = (s: string) => [...s].length;

/** What a careful parser normalises: Unicode NFC, NBSP→space, trailing spaces. */
export function normalize(text: string): string {
  const t = text.normalize("NFC").replaceAll(" ", " ").replaceAll("﻿", "");
  return splitLines(t).map(rstrip).join("\n");
}

/** Re-join a date range cut after its dash and a LinkedIn address cut right after "/in/". */
export function joinWraps(text: string): string {
  const out: string[] = [];
  for (const line of splitLines(text)) {
    const prev = out.length ? rstrip(out[out.length - 1]) : "";
    if (out.length && RANGE_CUT.test(prev) && RANGE_REST.test(line)) out[out.length - 1] = `${prev} ${strip(line)}`;
    else if (out.length && SLUG_CUT.test(prev) && SLUG_REST.test(strip(line))) out[out.length - 1] = prev + strip(line);
    else out.push(line);
  }
  return out.join("\n");
}

export function headingKey(line: string): SectionKey | null {
  const s = strip(strip(line).replace(/[:\s]+$/u, ""));
  if (!s || len(s) > 40 || /[\p{Nd}\p{No}]/u.test(s)) return null;
  return HEADING_INDEX.get(s.toLowerCase()) ?? null;
}

/** Text anchored on one date range: one job or one degree, as the parser segments it. */
export interface Block {
  start: string;
  end: string;
  text: string;
}

export interface Parsed {
  text: string;
  name: string | null;
  emails: string[];
  phones: string[];
  linkedin: string | null;
  /** [section, line index], in order */
  sections: [SectionKey, number][];
  experience: Block[];
  education: Block[];
  skills: string[];
  ligatures: string[];
}

export function parse(raw: string): Parsed {
  const text = joinWraps(normalize(raw));
  const lines = splitLines(text);
  const sections: [SectionKey, number][] = [];
  lines.forEach((line, i) => {
    const k = headingKey(line);
    if (k) sections.push([k, i]);
  });
  const li = text.match(LINKEDIN);
  return {
    text,
    name: guessName(lines),
    emails: [...text.matchAll(EMAIL)].map((m) => m[0]),
    phones: [...text.matchAll(PHONE)].map((m) => strip(m[0])).filter((p) => !DATE_RANGE.test(p)),
    linkedin: li ? li[1].toLowerCase() : null,
    sections,
    experience: blocks(lines, sectionSpan(sections, lines, "experience")),
    education: blocks(lines, sectionSpan(sections, lines, "education")),
    skills: skillItems(lines, sections),
    ligatures: [...new Set([...raw.matchAll(LIGATURES)].map((m) => m[0]))].sort(),
  };
}

/** First short line of 2-4 capitalised words with no digits, @, / or : (the classic heuristic). */
function guessName(lines: string[]): string | null {
  for (const line of lines.slice(0, 12)) {
    const s = strip(line);
    const words = s.split(/\s+/u).filter(Boolean);
    if (
      words.length >= 2 &&
      words.length <= 4 &&
      !headingKey(s) &&
      !/[\p{Nd}@/:]/u.test(s) &&
      words.every((w) => {
        const first = [...w][0];
        return !/\p{L}/u.test(first) || /\p{Lu}/u.test(first);
      })
    )
      return s;
  }
  return null;
}

function sectionSpan(sections: [SectionKey, number][], lines: string[], key: SectionKey): [number, number] | null {
  for (let idx = 0; idx < sections.length; idx++) {
    const [k, start] = sections[idx];
    if (k === key) return [start + 1, idx + 1 < sections.length ? sections[idx + 1][1] : lines.length];
  }
  return null;
}

/** Walk up from a date line over the entry header: at most `depth` short, non-bullet, non-date lines. */
function headerStart(lines: string[], anchor: number, floor: number, depth: number): number {
  let i = anchor - 1;
  let taken = 0;
  let first = anchor;
  while (i >= floor && taken < depth) {
    const s = strip(lines[i]);
    if (!s) {
      i -= 1;
      continue;
    }
    if (BULLET.test(lines[i]) || DATE_RANGE.test(s) || headingKey(s) || len(s) > 80 || s.endsWith(".")) break;
    first = i;
    taken += 1;
    i -= 1;
  }
  return first;
}

function blocks(lines: string[], span: [number, number] | null): Block[] {
  if (!span) return [];
  const [start, end] = span;
  const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, k) => from + k);
  let pattern = DATE_RANGE;
  let anchors = range(start, end).filter((i) => DATE_RANGE.test(lines[i]));
  if (!anchors.length) {
    anchors = range(start, end).filter((i) => SINGLE_DATE.test(lines[i]));
    pattern = SINGLE_DATE;
  }
  if (!anchors.length) return [];
  // Entries in one section share a layout: learn the header depth from the first entry.
  const depth = Math.min(3, range(start, anchors[0]).filter((i) => strip(lines[i])).length);
  const starts = anchors.map((a, n) => headerStart(lines, a, n ? anchors[n - 1] + 1 : start, depth));
  return anchors.map((a, n) => {
    const m = lines[a].match(pattern)!;
    const g = m.groups!;
    const bEnd = n + 1 < anchors.length ? starts[n + 1] : end;
    const [first, last] = pattern === DATE_RANGE ? [g.start, g.end] : [g.date, g.date];
    return { start: first, end: last, text: lines.slice(starts[n], Math.max(bEnd, a + 1)).join("\n") };
  });
}

function skillItems(lines: string[], sections: [SectionKey, number][]): string[] {
  const items: string[] = [];
  sections.forEach(([key, start], idx) => {
    if (!["skills", "tools", "soft_skills", "languages"].includes(key)) return;
    const end = idx + 1 < sections.length ? sections[idx + 1][1] : lines.length;
    for (const line of lines.slice(start + 1, end)) {
      const body = line.replace(BULLET, "").replace(/^[A-Za-z][A-Za-z &/]{1,30}:\s*/u, "");
      for (const part of body.split(/[·,|;•]/)) {
        const item = strip(part).replace(LEVEL, "");
        if (item) items.push(item);
      }
    }
  });
  return items;
}

// --------------------------------------------------------------------------------------------
// Beyond the lab parser: what the "how an ATS reads your CV" view shows for each entry.

const TITLE_WORDS =
  /\b(?:developer|engineer|analyst|manager|designer|specialist|consultant|lead|director|intern|internship|researcher|scientist|architect|administrator|officer|coordinator|assistant|accountant|teacher|nurse|editor|writer|programmer|technician|associate|executive|head|founder|co-founder|cto|ceo|cfo|vp|president|owner|supervisor|representative|agent|advisor|adviser|strategist|marketer|recruiter|tester|qa|devops|sre|contributor|volunteer|trainer|mentor|lecturer|professor|student|operator|inginer|programator|dezvoltator|manager|specialist|analist|director|asistent|contabil|profesor)\b/iu;
const ENTRY_SPLIT = /\s+(?:at|@|—|–|\|)\s+|,\s+|\s+·\s+/u;

/**
 * The header lines of an entry: from the block's start through its date line, plus one short line
 * under it (a "Company   City" line). A long line or a sentence ("Summary: Built…") is not header.
 */
function headerLines(block: Block): string[] {
  const out: string[] = [];
  let dated = false;
  for (const line of splitLines(block.text)) {
    const s = strip(line.replace(/\u200b/g, ""));
    if (!s) continue;
    if (dated) {
      if (!BULLET.test(line) && len(s) <= 60 && !s.endsWith(".") && !/^[\p{L} ]{2,20}:/u.test(s)) out.push(s);
      break;
    }
    if (BULLET.test(line)) break;
    out.push(s);
    if (DATE_RANGE.test(s) || SINGLE_DATE.test(s)) dated = true;
  }
  return out;
}

/** A header line without its dates: ranges, single dates and a trailing "(Mar '21 – now)". */
const withoutDates = (s: string) =>
  strip(
    s
      .replace(DATE_RANGE, "")
      .replace(SINGLE_DATE, "")
      .replace(/\s*\([^)]*\p{Nd}[^)]*\)\s*$/u, "")
      .replace(/[\s,·|–—-]+$/u, "")
      .replace(/^[\s,·|–—-]+/u, ""),
  );

/**
 * The title and the company of a job, as far as the header shows them. A line with a job word
 * ("Engineer", "Analyst"…) is the title; another header line is the company (up to its first comma:
 * "Reco, Leader in SaaS Security" → "Reco"). One line holding both ("Data Analyst, Moldcell",
 * "Data Analyst at Moldcell") is split on the first separator after the title.
 */
export function entryParts(block: Block): { title: string | null; company: string | null } {
  const lines = headerLines(block).map(withoutDates).filter(Boolean);
  let title: string | null = null;
  let company: string | null = null;
  for (const line of lines) {
    const parts = line.split(ENTRY_SPLIT).map(strip).filter(Boolean);
    if (!title && TITLE_WORDS.test(parts[0] ?? "")) {
      title = parts[0];
      if (!company && parts[1] && !TITLE_WORDS.test(parts[1])) company = parts[1];
    } else if (!company) {
      company = parts[0] ?? null;
    }
    if (title && company) break;
  }
  return { title, company };
}

const MONTH_INDEX = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** A date as months since year 0 (start: January for a bare year, end: December, capped at today). */
export function monthOf(raw: string, edge: "start" | "end", today: Date): number | null {
  const s = raw.toLowerCase().trim();
  const now = today.getFullYear() * 12 + today.getMonth();
  if (/^(?:present|current|now|prezent)$/.test(s)) return now;
  const year = s.match(/(?:19|20)\d{2}/);
  if (!year) return null;
  const y = Number(year[0]);
  const named = s.match(/^([a-z]{3})/);
  const numeric = s.match(/^(0?[1-9]|1[0-2])\//);
  const month = named ? MONTH_INDEX.indexOf(named[1]) : numeric ? Number(numeric[1]) - 1 : edge === "start" ? 0 : 11;
  return Math.min(y * 12 + Math.max(0, month), now);
}

/** Months of experience covered by the jobs' dates, overlaps counted once (end month included). */
export function monthsOfExperience(jobs: Block[], today: Date): number {
  const spans = jobs
    .map((j) => [monthOf(j.start, "start", today), monthOf(j.end, "end", today)] as const)
    .filter((s): s is readonly [number, number] => s[0] !== null && s[1] !== null && s[1] >= s[0])
    .map(([a, b]) => [a, b + 1] as [number, number])
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const s of spans) {
    if (cur && s[0] <= cur[1]) cur[1] = Math.max(cur[1], s[1]);
    else {
      if (cur) total += cur[1] - cur[0];
      cur = [...s];
    }
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}
