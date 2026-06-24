// Format / parseability check. Detecting columns, tables, images and header/footer
// content requires the file STRUCTURE, which only the Python service can inspect
// (pdfjs-dist on the client extracts text, not layout). So this is a thin bridge plus
// a helper to summarize the result for the UI.

import { formatCheck } from "./python-client";
import type { FormatResult } from "./types";

export { formatCheck };

export interface FormatSummary {
  atsSafe: boolean;
  blockers: number; // count of high-severity warnings
  headline: string;
}

export function summarizeFormat(result: FormatResult): FormatSummary {
  const blockers = result.warnings.filter((w) => w.severity === "high").length;
  const headline = result.ats_safe
    ? "ATS-safe format — your file should parse cleanly."
    : `${blockers} parsing blocker${blockers === 1 ? "" : "s"} found — ATS may misread or drop content.`;
  return { atsSafe: result.ats_safe, blockers, headline };
}
