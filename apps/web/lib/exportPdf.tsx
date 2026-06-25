// Renders the CV to a real PDF (client-side) and triggers a download — now template-aware.
// Replaces the old single-template downloadCvPdf(data, styleId).
import { pdf } from "@react-pdf/renderer";
import { getTemplate } from "@/components/cv/templates";
import { resolveTheme } from "@/components/cv/templates/theme";
import { registerFonts } from "@/components/cv/templates/fonts";
import type { CvData } from "@/lib/types";

/**
 * @param data        The CV data.
 * @param templateId  "classic" | "modern" | "minimal" (from the registry).
 * @param accent      Optional accent override (1-6) or hex string.
 */
export async function downloadCvPdf(data: CvData, templateId = "classic", accent?: number | string): Promise<void> {
  registerFonts();
  const { component: Template } = getTemplate(templateId);
  const blob = await pdf(<Template data={data} theme={resolveTheme(templateId, accent)} />).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(data.personalInfo.name || "resume").trim().replace(/\s+/g, "_") || "resume"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
