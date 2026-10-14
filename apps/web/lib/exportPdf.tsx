// Renders the CV to a real PDF (client-side) and triggers a download — now template-aware.
// Replaces the old single-template downloadCvPdf(data, styleId).
import { pdf } from "@react-pdf/renderer";
import { getTemplate } from "@/components/cv/templates";
import { resolveTheme } from "@/components/cv/templates/theme";
import { registerFonts, resetGlyphCache } from "@/components/cv/templates/fonts";
import type { CvData } from "@/lib/types";
import { printableCv } from "@/lib/cv-print";

/**
 * @param data        The CV data.
 * @param templateId  "classic" | "modern" | "minimal" (from the registry).
 * @param accent      Optional accent override (1-6) or hex string.
 */
// One render at a time: the glyph cache reset (fonts.ts) must not land in the middle of another
// render, e.g. the Complete preview re-rendering while Download is clicked.
let queue: Promise<unknown> = Promise.resolve();

export function renderCvPdfBlob(data: CvData, templateId = "classic", accent?: number | string): Promise<Blob> {
  const render = async () => {
    registerFonts();
    resetGlyphCache(); // a preview rendered earlier must not change this PDF (see fonts.ts)
    const { component: Template } = getTemplate(templateId);
    return pdf(<Template data={printableCv(data)} theme={resolveTheme(templateId, accent)} />).toBlob();
  };
  const result = queue.then(render, render);
  queue = result.catch(() => undefined);
  return result;
}

export async function downloadCvPdf(data: CvData, templateId = "classic", accent?: number | string): Promise<void> {
  const blob = await renderCvPdfBlob(data, templateId, accent);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(data.personalInfo.name || "resume").trim().replace(/\s+/g, "_") || "resume"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
