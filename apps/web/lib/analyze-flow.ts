import type { AtsRead } from "./ats-read/types";
import { scoreRead, scoreText, type AtsReport } from "./ats-read/score";

/**
 * The ATS read report for a CV: from the file when we have it and its text is the one being
 * analysed (columns, hidden links, headers and the rest live in the file), else from the text.
 */
export function atsReport(text: string, ats?: AtsRead | null): AtsReport {
  const reading = ats?.readings.find((r) => r.reader === "pdf-stream" || r.reader === "docx-all");
  return ats && reading && reading.text === text ? scoreRead(ats) : scoreText(text);
}

/**
 * Starts the Improve My Resume analysis of a CV: what "Check ATS Score" does on /app/improve, and
 * what the landing card does with a dropped file. The results page reads the report and the text
 * from sessionStorage; the caller then goes to /app/score.
 */
export function startImprove(text: string, ats?: AtsRead | null): void {
  sessionStorage.setItem("ats_flow", "improve");
  sessionStorage.setItem("ats_report", JSON.stringify(atsReport(text, ats)));
  sessionStorage.removeItem("ats_jobfit");
  // kept for "Recalculate Score" on the results page; it replaces an older saved draft
  sessionStorage.setItem("ats_text", text);
  sessionStorage.removeItem("ats_jd");
  sessionStorage.removeItem("ats_improve_cv");
}
