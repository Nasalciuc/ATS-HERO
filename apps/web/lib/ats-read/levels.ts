/**
 * How bad each finding of the ATS check is, on the scale real resume parsers use. Textkernel
 * (Lever's and SmartRecruiters' parser) and RChilli rate a CV on its own with findings on four
 * levels and no score: Fatal, Major, Data missing, Suggested improvement. Each of our findings takes
 * the level of their closest code; where they have none ("ours"), the level follows what happens to
 * the parsed profile. Where our evidence contradicts theirs, the deviation is written here.
 *
 * Design: ATS-REAL-VS-NOI.md §5.1 (claude.ai Project "App Builder"). The table there and this one
 * must say the same (tests/ats-score.test.tsx checks the codes).
 */

export type Level = "critical" | "major" | "missing" | "tip";

export const LEVEL_ORDER: Level[] = ["critical", "major", "missing", "tip"];

export const LEVELS: Record<Level, { label: string; vendor: string; meaning: string }> = {
  critical: {
    label: "Critical",
    vendor: "Fatal",
    meaning: "parsers flag it as fatal: the profile they build may come out badly wrong",
  },
  major: { label: "Major", vendor: "Major issue", meaning: "part of the profile comes out wrong or mixed up" },
  missing: { label: "Missing", vendor: "Data missing", meaning: "a field the profile should have is empty" },
  tip: { label: "Tip", vendor: "Suggested improvement", meaning: "nothing is lost today, but it's worth changing" },
};

/** The parser codes a finding mirrors: Textkernel Tx (ResumeQuality) and RChilli (Resume Quality). */
export interface ParserRef {
  textkernel?: string;
  rchilli?: string;
  /** "closest": their code isn't the same thing, only the nearest one */
  closest?: boolean;
  /** our level differs from theirs, and why */
  deviation?: string;
}

export const ISSUE_LEVELS: Record<string, { level: Level; ref: ParserRef }> = {
  // the whole CV / a whole section
  no_sections: { level: "critical", ref: { textkernel: "412", rchilli: "4101" } },
  no_jobs: { level: "critical", ref: { textkernel: "413", rchilli: "4102" } },
  jobs_no_dates: { level: "critical", ref: { textkernel: "419", rchilli: "4106" } },
  no_education: { level: "critical", ref: { textkernel: "414", rchilli: "4104" } },
  two_columns: { level: "critical", ref: { textkernel: "433", rchilli: "4108" } },
  contacts_missing: { level: "critical", ref: { textkernel: "441", rchilli: "4107" } },
  over_size: { level: "critical", ref: {} },
  // a field comes out wrong
  name_missing: { level: "major", ref: { textkernel: "302", rchilli: "4004" } },
  name_mixed: { level: "major", ref: {} },
  email_partial: { level: "major", ref: {} },
  phone_partial: { level: "major", ref: {} },
  linkedin_cut: { level: "major", ref: {} },
  contacts_outside_body: { level: "major", ref: { textkernel: "311", rchilli: "4006", closest: true } },
  jobs_disagree: { level: "major", ref: {} },
  education_disagree: { level: "major", ref: {} },
  heading_experience: { level: "major", ref: { textkernel: "325", rchilli: "4002", closest: true } },
  heading_education: { level: "major", ref: { textkernel: "325", rchilli: "4002", closest: true } },
  heading_skills: { level: "major", ref: { textkernel: "325", rchilli: "4002", closest: true } },
  skills_list_disagree: { level: "major", ref: {} },
  skills_unsearchable: { level: "major", ref: {} },
  skills_ligatures: { level: "major", ref: {} },
  ligatures: { level: "major", ref: {} },
  broken_glyphs: { level: "major", ref: {} },
  tables: { level: "major", ref: {} },
  text_boxes: { level: "major", ref: {} },
  // a field is empty
  email_missing: { level: "missing", ref: { textkernel: "211", rchilli: "3101" } },
  phone_missing: { level: "missing", ref: { textkernel: "212", rchilli: "3102" } },
  company_missing: { level: "missing", ref: { textkernel: "222", rchilli: "3106" } },
  linkedin_hidden: { level: "missing", ref: {} },
  linkedin_no_address: { level: "missing", ref: {} },
  // worth changing
  education_no_dates: {
    level: "tip",
    ref: { textkernel: "233", deviation: "Textkernel 233 says degrees don't need dates; our reader finds degrees by their years" },
  },
  no_skills: {
    level: "tip",
    ref: { textkernel: "112", rchilli: "5102", deviation: "they suggest skills inside your jobs instead of a list; we suggest both" },
  },
  skills_unlisted: {
    level: "tip",
    ref: { textkernel: "112", rchilli: "5102", deviation: "they suggest skills inside your jobs instead of a list; we suggest both" },
  },
  diacritics: { level: "tip", ref: {} },
  pdf: {
    level: "tip",
    ref: { textkernel: "300", rchilli: "4005", deviation: "they rate every PDF a major issue; our lab reads one-column PDFs almost perfectly" },
  },
  size_taleo: { level: "tip", ref: {} },
};

export const levelOf = (code: string): Level => ISSUE_LEVELS[code]?.level ?? "tip";

/** "Textkernel 433 · RChilli 4108", "closest: Textkernel 311 · RChilli 4006", or null for ours. */
export function refLine(ref: ParserRef): string | null {
  const codes = [ref.textkernel && `Textkernel ${ref.textkernel}`, ref.rchilli && `RChilli ${ref.rchilli}`].filter(Boolean).join(" · ");
  if (!codes) return null;
  return ref.closest ? `closest: ${codes}` : codes;
}
