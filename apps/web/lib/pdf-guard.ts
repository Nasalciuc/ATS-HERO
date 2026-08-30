export type GuardError = "TOO_LARGE" | "NOT_PDF" | "TOO_MANY_PAGES" | "PARSE_FAILED";

export async function guardAndExtractPdf(file: File): Promise<{ ok: true; text: string } | { ok: false; error: GuardError }> {
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "TOO_LARGE" };
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== "%PDF-") return { ok: false, error: "NOT_PDF" };
  try {
    const pdfjs = await import("pdfjs-dist");
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
    if (doc.numPages > 50) return { ok: false, error: "TOO_MANY_PAGES" };
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const c = await page.getTextContent();
      text += c.items.map((it: unknown) => (it as { str?: string }).str ?? "").join(" ") + "\n";
    }
    return { ok: true, text };
  } catch { return { ok: false, error: "PARSE_FAILED" }; }
}

export const GUARD_MSG: Record<GuardError, string> = {
  TOO_LARGE: "File is over 10 MB.", NOT_PDF: "This doesn't look like a valid PDF.",
  TOO_MANY_PAGES: "PDF has more than 50 pages.", PARSE_FAILED: "We couldn't read this file.",
};
