import type { AtsRead } from "./types";

export type { AtsRead, AtsReading, AtsReaderId, AtsSignals, HiddenLink } from "./types";

const startsWith = (head: Uint8Array, bytes: number[]) => bytes.every((b, i) => head[i] === b);

/**
 * Reads a CV file for the ATS check, in the browser: a PDF or a Word .docx, told by its first bytes
 * like `readCvFile`. Returns null for any other file (`readCvFile` already explains those to the
 * person). Throws when a PDF can't be read.
 */
export async function readForAts(data: ArrayBuffer): Promise<AtsRead | null> {
  const head = new Uint8Array(data.slice(0, 8));
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    const { readPdf } = await import("./pdf");
    return readPdf(data);
  }
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
    const { readDocx } = await import("./docx");
    return readDocx(data);
  }
  return null;
}
