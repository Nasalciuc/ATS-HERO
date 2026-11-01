import * as pdfjsLib from "pdfjs-dist";

// The worker runs in this thread, as in the Complete pop-up's preview (CvPagedPreview): importing
// the worker module sets globalThis.pdfjsWorker, so PDF.js needs no worker URL. It used to load
// the worker from cdnjs, which the CSP (script-src / worker-src 'self') blocks, so every PDF
// upload failed with "We couldn't read this file".
export async function loadWorker(): Promise<void> {
  // @ts-expect-error — the worker bundle ships without type declarations
  await import("pdfjs-dist/build/pdf.worker.min.mjs");
}

export const MAX_PDF_PAGES = 50;

/**
 * The text layer of a PDF, read entirely in the browser (the file never leaves the device), in
 * the order the PDF stores it, one line per printed line. PDF.js marks the last piece of each
 * line (`hasEOL`) and puts the spaces between words itself; a two-column CV comes out column by
 * column, as its generator wrote it. The text used to be joined with spaces into one line per
 * page, which ran headings, dates and bullets together.
 *
 * Throws when the file is not a readable PDF. `pages` is reported even when there are too many
 * to read (then `text` is empty), so the caller can say why.
 */
export async function extractPdfText(data: ArrayBuffer): Promise<{ pages: number; text: string }> {
  await loadWorker();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data), isEvalSupported: false });
  try {
    const pdf = await loadingTask.promise;
    if (pdf.numPages > MAX_PDF_PAGES) return { pages: pdf.numPages, text: "" };
    const pages: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const content = await (await pdf.getPage(n)).getTextContent();
      let page = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        page += item.str + (item.hasEOL ? "\n" : "");
      }
      pages.push(page);
    }
    const text = pages
      .join("\n")
      .split("\n")
      .map((line) => line.replace(/[ \t ]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return { pages: pdf.numPages, text };
  } finally {
    await loadingTask.destroy();
  }
}
