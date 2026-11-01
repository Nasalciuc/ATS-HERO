/**
 * Job Fit: does the CV meet the job post's requirements, one by one? This is how real ATSs explain
 * a match: Workday HiredScore's Fit & Gap shows each qualification met or not met, Workable and
 * Teamtailor show met / not met / unknown per criterion. There is no percentage: we extract the
 * requirements ourselves, and a percentage would claim a precision we don't have.
 *
 * - **Requirements** (deterministic, no AI): the skills from `packages/shared/data/skills.json`
 *   found in the post, whole words only, and the years of experience it asks for. Required or
 *   preferred by the paragraph's heading ("Requirements" / "Nice to have"…, in English, Romanian
 *   and Russian), or by "is a plus" on the line; the duties count as required (the job needs the
 *   skill); "About us", "We offer" and "Benefits" are skipped.
 * - **The summary** uses Workday HiredScore's published grade definitions, in words: all required
 *   and most preferred (A), all required (B), most required (C), few required (D). "Most" is ours:
 *   more than half. HiredScore's extra threshold for A isn't public.
 *
 * Design: ATS-REAL-VS-NOI.md §5.4 (claude.ai Project "App Builder").
 */
import { skills as SKILLS } from "./analyzer/shared-data";
import { entryParts, monthsOfExperience, parse, splitLines } from "./ats-read/parse";
import { formatMonths } from "./ats-read/score";

export type ReqStatus = "met" | "not_met" | "unknown";

export interface Requirement {
  /** what the post asks for: "SQL", "Python or R", "3+ years of experience" */
  label: string;
  kind: "skill" | "years";
  required: boolean;
  status: ReqStatus;
  /** where the CV shows it, or what it shows instead */
  where: string;
  /** the post's line it comes from */
  quote: string;
}

export type FitSummary = "all_required_most_preferred" | "all_required" | "most_required" | "few_required" | "none_found";

export interface JobFitReport {
  kind: "requirements";
  version: 1;
  summary: FitSummary;
  /** the summary in words: "Meets all required" */
  label: string;
  message: string;
  required: { met: number; total: number };
  preferred: { met: number; total: number };
  requirements: Requirement[];
}

export const FIT_LABELS: Record<FitSummary, string> = {
  all_required_most_preferred: "Meets all required and most preferred",
  all_required: "Meets all required",
  most_required: "Meets most required",
  few_required: "Meets few required",
  none_found: "No requirements we can check",
};

// ---------------------------------------------------------------------------------------------
// skills, found the same way in the post and in the CV

const TOKENS = new Set(SKILLS.tech_skills.map((s) => s.toLowerCase()));
const PHRASES = SKILLS.phrases.map((s) => s.toLowerCase());
const SINGLE = SKILLS.single_letter.map((s) => s.toLowerCase());
const DISPLAY = SKILLS.display;

const display = (skill: string) => DISPLAY[skill] ?? (/^[a-z]+$/.test(skill) ? skill[0].toUpperCase() + skill.slice(1) : skill);
/** One key per skill however it's written: "golang" and "go" → "go", "powerbi" and "power bi" → "power bi". */
const keyOf = (skill: string) => display(skill).toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PHRASE_RES = PHRASES.map((p) => [p, new RegExp(`(?<![\\p{L}\\p{N}])${escape(p)}(?![\\p{L}\\p{N}])`, "giu")] as const);
const TOKEN_RE = /[\p{L}\p{N}]+(?:[#+]+|(?:[.-][\p{L}\p{N}]+)*)/gu;
/** "R" and "C" count only in a list: after a comma, "or", "and", "/" or "(", before a comma, "or" or the end.
 *  Word edges are letters and digits in any script: JavaScript's `\b` knows only Latin, so "și" and "или" never matched. */
const LIST_WORD = "(?<![\\p{L}\\p{N}])(?:or|and|sau|și|si|или|и)(?![\\p{L}\\p{N}])";
const singleRe = (letter: string) =>
  new RegExp(`(?:^|[,;/(]|${LIST_WORD})\\s*(${letter})\\s*(?=$|[,;/)]|\\s+${LIST_WORD}|\\s*\\.(?:\\s|$))`, "gimu");

interface Hit {
  key: string;
  name: string;
  start: number;
  end: number;
}

export function findSkills(text: string): Hit[] {
  const t = text.normalize("NFKC");
  const hits: Hit[] = [];
  for (const [p, re] of PHRASE_RES)
    for (const m of t.matchAll(re)) hits.push({ key: keyOf(p), name: display(p), start: m.index!, end: m.index! + m[0].length });
  for (const m of t.matchAll(TOKEN_RE)) {
    const tok = m[0].toLowerCase();
    if (!TOKENS.has(tok)) continue;
    const start = m.index!;
    const end = start + m[0].length;
    // a word inside a phrase already found ("BI" in "Power BI") is the phrase
    if (hits.some((h) => h.start <= start && end <= h.end)) continue;
    hits.push({ key: keyOf(tok), name: display(tok), start, end });
  }
  for (const letter of SINGLE)
    for (const m of t.matchAll(singleRe(letter))) {
      const start = m.index! + m[0].trimEnd().length - 1; // the letter ends the match, before its trailing spaces
      hits.push({ key: keyOf(letter), name: display(letter), start, end: start + 1 });
    }
  return hits.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------------------------------------
// the post: which paragraph says what

type Mode = "required" | "preferred" | "skip";

const HEAD = (words: string) => new RegExp(`^(?:${words})\\s*(?::|$)`, "iu");
const REQUIRED_HEAD = HEAD(
  [
    "requirements?", "must[- ]haves?", "what you need", "what we(?:'re| are) looking for", "what you(?:'ll)? bring",
    "who you are", "(?:minimum |basic |required )?qualifications", "required (?:skills|experience)", "you have",
    "you should have", "skills(?: (?:&|and) experience)?", "your profile", "responsibilities", "key responsibilities",
    "what you(?:'ll| will) do", "your role", "the role", "tasks",
    "cerin[țţt]e(?: obligatorii)?", "ce a[șşs]tept[ăa]m(?: de la tine)?", "profilul candidatului", "responsabilit[ăa][țţt]i", "ce vei face",
    "требования", "мы ожидаем", "что мы ждем(?: от вас)?", "ожидания", "необходимые навыки", "обязанности", "задачи", "чем предстоит заниматься",
  ].join("|"),
);
const PREFERRED_HEAD = HEAD(
  [
    "nice[- ]to[- ]haves?", "preferred(?: qualifications| skills)?", "bonus(?: points)?", "pluses", "plus", "(?:it'?s|would be) a plus",
    "desirable", "good to have", "optional",
    "avantaje?", "constituie un avantaj", "reprezint[ăa] un avantaj", "ar fi un plus",
    "будет плюсом", "желательно", "преимуществом будет", "будет преимуществом", "дополнительно",
  ].join("|"),
);
const SKIP_HEAD = HEAD(
  [
    "about(?: us| the company| the team)?", "who we are", "we offer", "what we offer", "our offer", "benefits", "perks",
    "why join(?: us)?", "compensation", "salary",
    "despre noi", "oferim", "ce oferim", "beneficii",
    "мы предлагаем", "условия", "о компании", "о нас",
  ].join("|"),
);
const PLUS_MARK = /\b(?:nice to have|is a plus|would be a plus|a big plus|preferred|bonus|optional|is an advantage|constituie un avantaj|reprezintă un avantaj|ar fi un plus)\b|будет плюсом|желательно|приветствуется|будет преимуществом/iu;
const BULLET = /^[\s•●▪◦‣►▸→✓■◆\-*·#]+/u;

/** The years the post asks for, from one line ("3+ years", "at least 3 years", "minim 3 ani", "опыт от 3 лет"). */
export function yearsAsked(line: string): number | null {
  const pats = [
    /(\d{1,2})\s*\+\s*(?:years?|yrs?)\b/iu,
    /(\d{1,2})\s*(?:-|–|to)\s*\d{1,2}\s*(?:years?|yrs?)\b/iu,
    /(?:at least|minimum(?: of)?|min\.?|over|more than)\s*(\d{1,2})\s*(?:years?|yrs?)\b/iu,
    /(\d{1,2})\s*(?:years?|yrs?)\s+(?:of\s+)?(?:[\p{L}/-]+\s+){0,3}?experience/iu,
    /(?:minim(?:um)?|cel pu[țţt]in)\s*(\d{1,2})\s*ani\b/iu,
    /(\d{1,2})\s*\+?\s*ani\s+(?:de\s+)?experien/iu,
    /опыт[^.\n]{0,40}?от\s*(\d{1,2})\s*(?:лет|года|год)/iu,
    /от\s*(\d{1,2})\s*(?:лет|года|год)/iu,
    /(\d{1,2})\s*\+?\s*(?:лет|года|год)\s+опыта/iu,
  ];
  for (const re of pats) {
    const m = line.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

interface PostReq {
  label: string;
  keys: string[];
  required: boolean;
  quote: string;
}

/** The post's requirements: skills (alternatives like "Python or R" kept together) and years. */
export function requirementsOf(post: string): { skills: PostReq[]; years: { n: number; quote: string } | null } {
  const out: PostReq[] = [];
  const seen = new Set<string>();
  let mode: Mode = "required";
  let years: { n: number; quote: string } | null = null;
  for (const raw of splitLines(post.normalize("NFKC"))) {
    let line = raw.replace(BULLET, "").trim();
    if (!line) continue;
    // a heading switches the mode; "Nice to have: Go, C#" switches it and keeps the rest of the line
    for (const [re, m] of [[SKIP_HEAD, "skip"], [PREFERRED_HEAD, "preferred"], [REQUIRED_HEAD, "required"]] as const) {
      const hit = line.match(re);
      if (hit) {
        mode = m;
        line = line.slice(hit[0].length).trim();
        break;
      }
    }
    if (!line || mode === "skip") continue;
    const required = mode === "required" && !PLUS_MARK.test(line);
    if (required) {
      const n = yearsAsked(line);
      if (n !== null && (!years || n > years.n)) years = { n, quote: line };
    }
    const hits = findSkills(line);
    // "Python or R", "Python / R": one requirement either skill meets
    const groups: Hit[][] = [];
    for (const h of hits) {
      const last = groups[groups.length - 1];
      const prev = last?.[last.length - 1];
      if (prev && /^\s*(?:or|\/|sau|или)\s*$/iu.test(line.slice(prev.end, h.start))) last.push(h);
      else groups.push([h]);
    }
    for (const g of groups) {
      const keys = [...new Set(g.map((h) => h.key))];
      if (keys.some((k) => seen.has(k))) {
        // asked again: a required mention wins over a preferred one
        if (required) for (const r of out) if (r.keys.some((k) => keys.includes(k))) r.required = true;
        continue;
      }
      keys.forEach((k) => seen.add(k));
      out.push({ label: [...new Set(g.map((h) => h.name))].join(" or "), keys, required, quote: line });
    }
  }
  return { skills: out, years };
}

// ---------------------------------------------------------------------------------------------
// the match

export function jobFit(cvText: string, postText: string, today = new Date()): JobFitReport {
  const { skills, years } = requirementsOf(postText);
  const cv = parse(cvText);
  const inCv = new Set(findSkills(cv.text).map((h) => h.key));
  const inList = new Set(findSkills(cv.skills.join(", ")).map((h) => h.key));
  const inJobs = cv.experience.map((b) => {
    const { title, company } = entryParts(b);
    return { name: company ?? title ?? "a job", keys: new Set(findSkills(b.text).map((h) => h.key)) };
  });

  const requirements: Requirement[] = skills.map((r) => {
    const found = r.keys.filter((k) => inCv.has(k));
    if (!found.length) return { label: r.label, kind: "skill", required: r.required, status: "not_met", where: "Not found in your CV", quote: r.quote };
    const places: string[] = [];
    if (found.some((k) => inList.has(k))) places.push("your Skills list");
    const jobs = inJobs.filter((j) => found.some((k) => j.keys.has(k))).map((j) => j.name);
    if (jobs.length) places.push(jobs.length === 1 ? `your job at ${jobs[0]}` : `${jobs.length} of your jobs`);
    return {
      label: r.label,
      kind: "skill",
      required: r.required,
      status: "met",
      where: places.length ? `In ${places.join(" and ")}` : "Elsewhere in your CV",
      quote: r.quote,
    };
  });
  if (years) {
    const months = cv.experience.length ? monthsOfExperience(cv.experience, today) : null;
    const met = months !== null && months >= years.n * 12;
    requirements.unshift({
      label: `${years.n}+ years of experience`,
      kind: "years",
      required: true,
      status: met ? "met" : "not_met",
      where: months === null ? "No dated jobs read from your CV" : `${formatMonths(months)} from your jobs' dates`,
      quote: years.quote,
    });
  }

  const count = (req: boolean) => {
    const list = requirements.filter((r) => r.required === req && r.status !== "unknown");
    return { met: list.filter((r) => r.status === "met").length, total: list.length };
  };
  const required = count(true);
  const preferred = count(false);
  const summary: FitSummary =
    required.total + preferred.total === 0
      ? "none_found"
      : required.met === required.total
        ? preferred.total > 0 && preferred.met * 2 > preferred.total
          ? "all_required_most_preferred"
          : "all_required"
        : required.met * 2 > required.total
          ? "most_required"
          : "few_required";
  return { kind: "requirements", version: 1, summary, label: FIT_LABELS[summary], message: message(summary, requirements), required, preferred, requirements };
}

function message(summary: FitSummary, reqs: Requirement[]): string {
  if (summary === "none_found")
    return "We found no requirements we can check in this post: no skills from our list and no years of experience. Read the post yourself and compare.";
  const names = (required: boolean) => reqs.filter((r) => r.required === required && r.status === "not_met").map((r) => r.label);
  const short = (xs: string[]) => `${xs.slice(0, 4).join(", ")}${xs.length > 4 ? "…" : ""}`;
  const missing = names(true);
  const extra = names(false);
  const head = missing.length ? `Your CV doesn't show: ${short(missing)}.` : "Your CV shows everything the post marks as required.";
  return extra.length ? `${head} Nice to have, not shown: ${short(extra)}.` : head;
}

