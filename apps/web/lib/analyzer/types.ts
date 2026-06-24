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
