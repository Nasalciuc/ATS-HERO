/**
 * Daily search, the rules (canvas "ATS Hero Tracker v2", page "Search & agent"): pure functions,
 * no network. `lib/job-search-run.ts` calls apps/ai and writes; tests/job-search.test.ts holds these.
 *
 * Each morning: the postings of the last day and a half, from the boards the person chose, minus
 * the jobs already in their tracker, ordered by how much of what each post requires their CV shows
 * (Job Fit, no AI), the first `perDay` of them into Saved. Fewer, better: a post we can't check
 * comes after the ones we can.
 */
import { jobFit, type JobFitReport } from "./job-fit";
import { jobUrlKey, safeJobUrl } from "./job-url";
import { MAX_DESCRIPTION_CHARS } from "./tracker";
import type { JobBoard } from "./types";

export const PER_DAY_CHOICES = [5, 10, 20] as const;
export const MAX_PER_DAY = 20;
/** A day and a half: a run that comes late, or a post published at night, is still caught. The tracker's link check drops repeats. */
export const HOURS_OLD = 36;
/** Postings asked per board: apps/ai's cap (MAX_RESULTS). */
export const RESULTS_PER_BOARD = 50;
export const JOB_BOARDS: JobBoard[] = ["indeed", "linkedin"];
export const BOARD_LABEL: Record<JobBoard, string> = { indeed: "Indeed", linkedin: "LinkedIn" };

/**
 * The countries the search offers: our markets (PIETE-LIMBI-DOMENIU.md). `id` is the name JobSpy
 * takes for Indeed. Moldova has no Indeed, so there only LinkedIn's public list is read.
 */
export const JOB_COUNTRIES = [
  { id: "romania", label: "Romania", indeed: true },
  { id: "moldova", label: "Moldova", indeed: false },
  { id: "poland", label: "Poland", indeed: true },
  { id: "czech republic", label: "Czechia", indeed: true },
  { id: "ireland", label: "Ireland", indeed: true },
  { id: "netherlands", label: "Netherlands", indeed: true },
  { id: "belgium", label: "Belgium", indeed: true },
  { id: "finland", label: "Finland", indeed: true },
  { id: "germany", label: "Germany", indeed: true },
  { id: "uk", label: "United Kingdom", indeed: true },
  { id: "france", label: "France", indeed: true },
  { id: "united arab emirates", label: "United Arab Emirates", indeed: true },
  { id: "qatar", label: "Qatar", indeed: true },
  { id: "singapore", label: "Singapore", indeed: true },
  { id: "nigeria", label: "Nigeria", indeed: true },
  { id: "south africa", label: "South Africa", indeed: true },
] as const;
export type JobCountry = (typeof JOB_COUNTRIES)[number]["id"];

export const countryOf = (id: string) => JOB_COUNTRIES.find((c) => c.id === id) ?? null;

/** What a saved search holds, as the rules need it. */
export interface SearchSettings {
  searchTerm: string;
  country: string;
  city: string | null;
  remoteOnly: boolean;
  boards: JobBoard[];
  perDay: number;
}

/** The boards that can serve this country: Indeed has no Moldova. */
export function boardsFor(s: Pick<SearchSettings, "country" | "boards">): JobBoard[] {
  const country = countryOf(s.country);
  return s.boards.filter((b) => b !== "indeed" || Boolean(country?.indeed));
}

/** The body of apps/ai's POST /jobs/search. Only the title and the place go out, never the CV. */
export function searchRequest(s: SearchSettings) {
  const country = countryOf(s.country);
  const place = [s.city?.trim(), country?.label].filter(Boolean).join(", ");
  return {
    search_term: s.searchTerm.trim(),
    location: place || undefined,
    sites: boardsFor(s),
    // Indeed's country; without Indeed (Moldova) JobSpy still wants a valid one and ignores it
    country: country?.indeed ? country.id : "usa",
    results_wanted: RESULTS_PER_BOARD,
    hours_old: HOURS_OLD,
    is_remote: s.remoteOnly,
  };
}

/** One posting as apps/ai returns it (JobSpy's columns). */
export interface Posting {
  site?: string | null;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  date_posted?: string | null;
  job_url?: string | null;
  job_url_direct?: string | null;
  description?: string | null;
}

/** A posting the run will add to Saved. */
export interface PickedJob {
  role: string;
  company: string;
  location: string | null;
  url: string;
  urlKey: string;
  description: string | null;
  board: string | null;
  postedAt: string | null;
  fit: JobFitReport | null;
}

export interface PickResult {
  picked: PickedJob[];
  /** postings the boards returned */
  found: number;
  /** already in the tracker, or the same job twice in one run */
  repeats: number;
}

const clip = (s: string | null | undefined, max: number) => {
  const t = (s ?? "").trim();
  return t ? t.slice(0, max) : null;
};

/** Higher first: every required item shown, then the share shown, then how many, then the newest. */
function rank(a: PickedJob, b: PickedJob): number {
  const req = (j: PickedJob) => j.fit?.required ?? { met: 0, total: 0 };
  const all = (j: PickedJob) => (req(j).total > 0 && req(j).met === req(j).total ? 1 : 0);
  const share = (j: PickedJob) => (req(j).total > 0 ? req(j).met / req(j).total : -1);
  return all(b) - all(a)
    || share(b) - share(a)
    || req(b).met - req(a).met
    || (b.fit?.preferred.met ?? 0) - (a.fit?.preferred.met ?? 0)
    || (b.postedAt ?? "").localeCompare(a.postedAt ?? "");
}

/**
 * The postings to add: each with a usable link, a title and a company, not already in the tracker,
 * checked against the CV, the best `perDay`. The employer's own link (`job_url_direct`) is kept
 * when the board gives one: it is the page the person applies on.
 */
export function pickPostings(
  postings: Posting[],
  opts: { existingKeys: Set<string>; cvText: string | null; perDay: number; today?: Date },
): PickResult {
  const seen = new Set(opts.existingKeys);
  const out: PickedJob[] = [];
  let repeats = 0;
  for (const p of postings) {
    const url = safeJobUrl(p.job_url_direct) ?? safeJobUrl(p.job_url);
    const urlKey = jobUrlKey(url);
    const role = clip(p.title, 120);
    const company = clip(p.company, 120);
    if (!url || !urlKey || !role || !company) continue;
    if (seen.has(urlKey)) {
      repeats++;
      continue;
    }
    seen.add(urlKey);
    const description = clip(p.description, MAX_DESCRIPTION_CHARS);
    out.push({
      role, company, url, urlKey, description,
      location: clip(p.location, 200),
      board: p.site ?? null,
      postedAt: p.date_posted ?? null,
      fit: opts.cvText && description ? jobFit(opts.cvText, description, opts.today) : null,
    });
  }
  out.sort(rank);
  const perDay = Math.max(1, Math.min(MAX_PER_DAY, Math.floor(opts.perDay)));
  return { picked: out.slice(0, perDay), found: postings.length, repeats };
}
