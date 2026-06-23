import * as pdfjsLib from "pdfjs-dist";
// Vite resolves this to the bundled worker URL. Requires `vite/client` types
// (already referenced in src/vite-env.d.ts) for the `?url` suffix to type-check.
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/**
 * Extracts plain text from an uploaded PDF entirely in the browser — the file
 * never leaves the device. Page text is joined with blank lines and runs of
 * horizontal whitespace are collapsed so the scoring engine sees clean input.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      pages.push(text);
    }
    return pages.join("\n\n").replace(/[ \t]+/g, " ").trim();
  } finally {
    await loadingTask.destroy();
  }
}

/** True when a File looks like a PDF (by MIME type or extension). */
export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
