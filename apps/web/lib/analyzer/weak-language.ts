// Instant weak-phrase / cliché detection for live builder feedback — mirrors the
// Python ats_scorer findings scan. Runs on every keystroke; same data source.

import { weakPhrases, cliches, sections } from "./shared-data";
import type { Finding } from "./types";

function lineOf(lines: string[], needle: string): number | null {
  const low = needle.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(low)) return i + 1;
  }
  return null;
}

function boundary(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!\\w)${escaped}(?!\\w)`, "i");
}

/** Scan free text for weak phrases, clichés and non-standard headings. */
export function scanLanguage(text: string): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split("\n");

  for (const entry of weakPhrases) {
    if (boundary(entry.phrase).test(text)) {
      findings.push({
        type: "weak_phrase",
        severity: "high",
        text: entry.phrase,
        why: entry.why,
        suggestion: entry.rewrite_hint,
        line: lineOf(lines, entry.phrase),
      });
    }
  }

  for (const entry of cliches) {
    if (boundary(entry.phrase).test(text)) {
      findings.push({
        type: "cliche",
        severity: "medium",
        text: entry.phrase,
        why: entry.why,
        suggestion: "Replace with a specific, quantified achievement.",
        line: lineOf(lines, entry.phrase),
      });
    }
  }

  for (const hint of sections.nonstandard_heading_hints) {
    if (boundary(hint).test(text)) {
      findings.push({
        type: "nonstandard_heading",
        severity: "medium",
        text: hint,
        why: "Non-standard section headings confuse ATS parsers.",
        suggestion: "Use a standard heading (Summary, Experience, Education, Skills).",
        line: lineOf(lines, hint),
      });
    }
  }

  return findings;
}
