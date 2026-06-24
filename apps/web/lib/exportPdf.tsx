"use client";
import { pdf } from "@react-pdf/renderer";
import CvPdfDocument from "../components/cv/CvPdfDocument";
import type { CvData } from "./types";

/**
 * Renders the CV to a real PDF (client-side) and triggers a download.
 * The filename is derived from the candidate's name.
 */
export async function downloadCvPdf(data: CvData, styleId = 1): Promise<void> {
  const blob = await pdf(<CvPdfDocument data={data} styleId={styleId} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(data.personalInfo.name || "resume").trim().replace(/\s+/g, "_") || "resume"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
