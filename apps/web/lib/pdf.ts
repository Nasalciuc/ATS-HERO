import * as pdfjsLib from "pdfjs-dist";

// The worker runs in this thread, as in the Complete pop-up's preview (CvPagedPreview): importing
// the worker module sets globalThis.pdfjsWorker, so PDF.js needs no worker URL. It used to load
// the worker from cdnjs, which the CSP (script-src / worker-src 'self') blocks, so every PDF
// upload failed with "We couldn't read this file".
async function loadWorker(): Promise<void> {
  // @ts-expect-error — the worker bundle ships without type declarations
  await import("pdfjs-dist/build/pdf.worker.min.mjs");
}

/**
 * Extracts plain text from an uploaded PDF entirely in the browser — the file
 * never leaves the device. Page text is joined with blank lines and runs of
 * horizontal whitespace are collapsed so the scoring engine sees clean input.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  await loadWorker();
  const loadingTask = pdfjsLib.getDocument({ data, isEvalSupported: false });
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
