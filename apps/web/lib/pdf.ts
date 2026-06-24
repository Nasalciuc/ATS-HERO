import * as pdfjsLib from "pdfjs-dist";

// In Next.js we can't use Vite's `?url` worker import. Load the worker from a CDN
// matching the installed pdfjs-dist version (client-side only).
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

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
