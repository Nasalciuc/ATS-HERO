// Client-side region-fit — mirrors apps/ai region_checker.py. Global rules engine:
// flags only deviations from the TARGET country's profile, silent otherwise.

import { regions, type RegionProfile } from "./shared-data";
import type { RegionDeviation, RegionResult, RegionSignals } from "./types";

function profileFor(target: string): RegionProfile {
  const delta = regions.regions[target.toUpperCase()] ?? {};
  return { ...regions.baseline, ...delta };
}

export function checkRegion(target: string, signals: RegionSignals): RegionResult {
  const p = profileFor(target);
  const label = (p.label as string) ?? target.toUpperCase();
  const dev: RegionDeviation[] = [];
  const add = (field: string, severity: RegionDeviation["severity"], message: string) =>
    dev.push({ field, severity, message });

  if (signals.has_photo === true && p.photo === "omit") {
    add("photo", "high", `Remove the photo — not expected in ${label} and can invite bias.`);
  } else if (signals.has_photo === false && p.photo === "expected") {
    add("photo", "medium", `Add a professional photo — expected in ${label}.`);
  }

  if (signals.has_personal_data === true && p.personal_data === "omit") {
    add("personal_data", "high", `Remove date of birth / marital status / nationality — discouraged in ${label}.`);
  } else if (signals.has_personal_data === false && p.personal_data === "expected") {
    add("personal_data", "medium", `Add date of birth and nationality — standard in ${label}.`);
  }

  const maxPages = (p.max_pages as number) ?? 2;
  if (typeof signals.page_count === "number" && signals.page_count > maxPages) {
    add("length", "medium", `${signals.page_count} pages exceeds the ~${maxPages}-page norm for ${label}.`);
  }

  if (p.gdpr_clause === "expected" && signals.has_gdpr_clause === false) {
    add("gdpr_clause", "medium", `Add a data-processing (GDPR) consent clause — expected in ${label}.`);
  }

  if (p.references_on_cv === "expected" && signals.has_references === false) {
    add("references", "medium", `Include 2-3 references with contact details — expected in ${label}.`);
  }

  return { target: target.toUpperCase(), profile_label: label, deviations: dev };
}

/** Country codes available in the rules engine (for a target-region selector). */
export const regionCodes = (): string[] => Object.keys(regions.regions).sort();
