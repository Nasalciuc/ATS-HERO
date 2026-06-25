"use client";
// Live preview of the chosen template. PDFViewer renders the real PDF in an iframe, so
// preview == export exactly. Write-only here (no DOM in the build sandbox); the rendering
// path is render-validated.
//
// TWO things to respect in Next:
//  1. CLIENT-ONLY: PDFViewer touches browser APIs. Import this component dynamically with
//     ssr:false, e.g.
//        const CvTemplatePreview = dynamic(
//          () => import("@/components/cv/CvTemplatePreview").then(m => m.CvTemplatePreview),
//          { ssr: false }
//        );
//  2. DEBOUNCE: PDFViewer re-renders the whole PDF on every prop change, which is heavy
//     per keystroke. Pass a DEBOUNCED copy of `data` (e.g. 400-600ms) from the parent,
//     not the live form value.
import { PDFViewer } from "@react-pdf/renderer";
import { getTemplate } from "@/components/cv/templates";
import { resolveTheme } from "@/components/cv/templates/theme";
import { registerFonts } from "@/components/cv/templates/fonts";
import type { CvData } from "@/lib/types";

registerFonts();

export function CvTemplatePreview({
  data,
  templateId = "classic",
  accent,
}: {
  data: CvData;
  templateId?: string;
  accent?: number | string;
}) {
  const { component: Template } = getTemplate(templateId);
  return (
    <PDFViewer style={{ width: "100%", height: "100%", border: "none" }} showToolbar={false}>
      <Template data={data} theme={resolveTheme(templateId, accent)} />
    </PDFViewer>
  );
}
