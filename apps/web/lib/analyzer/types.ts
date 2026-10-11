// Types mirroring the Python service responses (apps/ai). Keep in sync via the
// shared JSON in packages/shared/data — these are the wire contracts.

export type Severity = "high" | "medium" | "low";

export interface Finding {
  type: string; // weak_phrase | cliche | nonstandard_heading | images | tables | ...
  severity: Severity;
  text: string;
  why: string;
  suggestion: string;
  line?: number | null;
}

export interface Signal {
  key: string;
  label: string;
  score: number; // 0-100
  weight: number;
  detail: string;
}

export interface Detected {
  emails: string[];
  phones: string[];
  links: string[];
  skills: string[];
  action_verbs: string[];
  organizations: string[];
  dates: string[];
}

export interface ScoreResult {
  overall_score: number;
  signals: Signal[];
  detected: Detected;
  findings: Finding[];
  suggestions: string[];
  meta: {
    word_count: number;
    sentence_count: number;
    nlp_model: string;
    model_loaded: boolean;
  };
}

export interface ExtractResult {
  text: string;
  char_count: number;
  word_count: number;
  page_count: number;
  format: string;
  filename: string;
}

export interface JobFitResult {
  match_score: number;
  matched: string[];
  missing: string[];
  suggestions: string[];
}

export interface FormatResult {
  format: string;
  ats_safe: boolean;
  page_count: number;
  warnings: Finding[];
  details: Record<string, unknown>;
}

export interface RegionDeviation {
  field: string;
  severity: Severity;
  message: string;
}

export interface RegionResult {
  target: string;
  profile_label: string;
  deviations: RegionDeviation[];
}

export interface RegionSignals {
  has_photo?: boolean | null;
  has_personal_data?: boolean | null;
  page_count?: number | null;
  has_references?: boolean | null;
  has_gdpr_clause?: boolean | null;
  languages?: string[];
}

/** POST /parse-check — what ATS-style readers recover from one CV file (the ATS lab). */
export type ParseCheckVerdict = "PASS" | "WARN" | "FAIL";

export interface ParseCheckReader {
  reader: string; // extraction engine: pymupdf | pdfminer | pypdf | python-docx | docx2txt
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  sections?: string[];
  jobs?: { start: string; end: string; text: string }[];
  education?: { start: string; end: string; text: string }[];
  skills?: string[];
  verdict?: ParseCheckVerdict; // only when truth was sent
  score?: number;
  problems?: string[];
}

export interface ParseCheckResult {
  format: "pdf" | "docx";
  summary: {
    verdict: ParseCheckVerdict;
    score_min?: number;
    score_mean?: number;
    readers_passing?: number;
    readers_total: number;
    disagreements?: string[];
  };
  readers: ParseCheckReader[];
  recommendations: { code: string; severity: Severity; message: string }[];
}
