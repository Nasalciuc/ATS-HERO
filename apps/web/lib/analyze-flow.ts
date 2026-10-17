import { scoreRawText } from "./analyzer/ats-scorer";

/**
 * Starts the Improve My Resume analysis of a CV's text: what "Check ATS Score" does on
 * /app/improve, and what the landing card does with a dropped file. The results page reads the
 * report and the text from sessionStorage; the caller then goes to /app/score.
 */
export function startImprove(text: string): void {
  sessionStorage.setItem("ats_flow", "improve");
  sessionStorage.setItem("ats_report", JSON.stringify(scoreRawText(text)));
  sessionStorage.removeItem("ats_jobfit");
  // kept for "Recalculate Score" on the results page; it replaces an older saved draft
  sessionStorage.setItem("ats_text", text);
  sessionStorage.removeItem("ats_jd");
  sessionStorage.removeItem("ats_improve_cv");
}
