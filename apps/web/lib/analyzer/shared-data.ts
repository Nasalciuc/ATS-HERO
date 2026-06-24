// Single source of truth, shared with the Python service (apps/ai).
// These import the JSON in packages/shared/data — edit the data there, never here.
//
// Requires "resolveJsonModule": true in tsconfig (and the path alias to packages/shared).
// Adjust the import paths to match your tsconfig path mapping if needed.

import weakPhrasesJson from "../../../../packages/shared/data/weak-phrases.json";
import clichesJson from "../../../../packages/shared/data/cliches.json";
import skillsJson from "../../../../packages/shared/data/skills.json";
import sectionsJson from "../../../../packages/shared/data/sections.json";
import regionsJson from "../../../../packages/shared/data/regions.json";

export interface WeakPhrase {
  phrase: string;
  why: string;
  rewrite_hint: string;
}
export interface Cliche {
  phrase: string;
  why: string;
}

export const weakPhrases = (weakPhrasesJson as { weak_phrases: WeakPhrase[] }).weak_phrases;
export const cliches = (clichesJson as { cliches: Cliche[] }).cliches;

export const skills = skillsJson as {
  tech_skills: string[];
  single_letter: string[];
  phrases: string[];
  display: Record<string, string>;
};

export const sections = sectionsJson as {
  sections: Record<string, string[]>;
  nonstandard_heading_hints: string[];
};

export interface RegionProfile {
  label?: string;
  photo?: string;
  personal_data?: string;
  max_pages?: number;
  references_on_cv?: string;
  gdpr_clause?: string;
  language_levels?: string;
  europass?: boolean;
  format?: string;
  [k: string]: unknown;
}

export const regions = regionsJson as {
  baseline: RegionProfile;
  regions: Record<string, RegionProfile>;
};
