// "Recalculate Score" and Back to the analyze page score the same file again (lib/analyze-flow.ts):
// the file's reading is kept in session storage next to the text, and used only while the text is
// still the file's. Synthetic person only (AGENTS.md rule 11).
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { atsReport, keepAtsRead, startImprove, storedAtsRead } from "@/lib/analyze-flow";
import { NO_SIGNALS, type AtsRead } from "@/lib/ats-read/types";

const STREAM = `Elena Rusu
elena.rusu@example.com | +373 69 555 012 | linkedin.com/in/elena-rusu
Experience
Senior Data Analyst, Orange Moldova, Mar 2021 – Present
• Built Power BI dashboards used by 40 managers
Data Analyst, Moldcell, Jun 2018 – Feb 2021
• Automated churn analysis in Python
Education
BSc Computer Science, Technical University of Moldova, 2014 – 2018
Skills
Python, SQL, Power BI, Tableau`;

// the same page read row by row, with a sidebar mixed into the jobs
const ROWS = STREAM.replace("Senior Data Analyst, Orange Moldova", "Senior Data Analyst Python, SQL Orange Moldova");

const READ: AtsRead = {
  kind: "pdf",
  bytes: 20_000,
  pages: 1,
  producer: "Microsoft® Word",
  readings: [
    { reader: "pdf-stream", text: STREAM },
    { reader: "pdf-rows", text: ROWS },
  ],
  signals: { ...NO_SIGNALS, twoColumns: true },
};

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("sessionStorage", memoryStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the file's reading survives Recalculate and Back", () => {
  it("Recalculate on the unchanged text gives the file's report again", () => {
    startImprove(STREAM, READ);
    const first = JSON.parse(sessionStorage.getItem("ats_report")!);
    expect(first.file.kind).toBe("pdf");
    expect(first.file.twoColumns).toBe(true);
    const again = atsReport(sessionStorage.getItem("ats_text")!, storedAtsRead());
    expect(again.fields).toEqual(first.fields);
    expect(again.file).toEqual(first.file);
    expect(again.issues.map((i) => i.code)).toEqual(first.issues.map((i: { code: string }) => i.code));
  });

  it("an edited text is scored as text, not as the file", () => {
    startImprove(STREAM, READ);
    const edited = atsReport(`${STREAM}\nGerman (B1)`, storedAtsRead());
    expect(edited.file.kind).toBe("text");
    expect(edited.readings).toBe(1);
  });

  it("pasted text clears a reading kept from an earlier file", () => {
    startImprove(STREAM, READ);
    startImprove(STREAM);
    expect(storedAtsRead()).toBeNull();
    expect(atsReport(STREAM, storedAtsRead()).file.kind).toBe("text");
  });

  it("a reading too large for session storage is dropped, not thrown", () => {
    keepAtsRead(READ);
    const storage = memoryStorage();
    storage.setItem("ats_read", JSON.stringify(READ));
    storage.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    vi.stubGlobal("sessionStorage", storage);
    expect(() => keepAtsRead(READ)).not.toThrow();
    expect(storedAtsRead()).toBeNull();
  });
});
