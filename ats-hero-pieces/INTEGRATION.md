# ATS Hero — 3 portable pieces (drop-in)

Three stack-agnostic additions: **scoring-engine tests**, **real PDF export**, and
**PDF upload parsing**. Everything is client-side or pure TypeScript, so it ports
verbatim to a future Next.js + Convex stack (the scoring tests follow with only an
import-path change).

Verified locally: `tsc --noEmit` clean, 44 tests green, `npm run build` succeeds.

## How to apply

Copy the `server/`, `src/` folders and `package.json` over your repo root
(preserving paths), then:

```bash
npm install          # pulls @react-pdf/renderer, pdfjs-dist, vitest
npm test             # 44 tests, all green
npm run dev          # web + api as before
```

## Files

**New**
- `server/scoring.test.ts` — Vitest suite for the ATS scoring engine (34 tests)
- `server/jobfit.test.ts` — Vitest suite for the keyword job-fit matcher (10 tests)
- `src/components/cv/CvPdfDocument.tsx` — `@react-pdf/renderer` document (the real PDF)
- `src/lib/exportPdf.tsx` — builds the PDF blob and triggers the browser download
- `src/lib/pdf.ts` — extracts text from an uploaded PDF via `pdfjs-dist`, fully client-side

**Modified**
- `server/scoring.ts` — bug fix in free-text email detection (see below)
- `src/components/modals/CompleteModal.tsx` — “Download PDF” now produces a real PDF
- `src/pages/AnalyzePage.tsx` — upload now accepts `.pdf` and extracts its text
- `package.json` — new dependencies + test scripts (`test`, `test:watch`, `test:cov`)

## New dependencies

| Package | Version | Scope |
| --- | --- | --- |
| `@react-pdf/renderer` | ^4.5.1 | runtime |
| `pdfjs-dist` | ^6.0.227 | runtime |
| `vitest` | ^4.1.9 | dev |
| `@vitest/coverage-v8` | ^4.1.9 | dev |

## What the tests surfaced

1. **BUG — fixed.** `EMAIL_RE` was anchored (`^...$`), so `scoreRawText` (the
   Improve flow) never detected an email inside real CV text and always lost 45
   contact points. Added an unanchored `EMAIL_SCAN_RE` for free-text scanning; the
   anchored regex still validates the structured `personalInfo.email` field.

2. **FINDING — your call.** `skills` is hard-capped at 90, so a perfect CV with no
   optional sections maxes at **88.2** (coreAvg 98 × 0.9), never 90/100. Intended
   (to push users toward optional sections), or should skills be able to reach 100?

3. **FINDING — your call.** `jobfit` drops any 2-character token (`t.length >= 3`),
   silently losing real skills like `c#`, `Go`, `ML`, `AI`, `UX`, `QA`, `R`. A
   whitelist of known short skills would fix it.

## Notes

- The PDF uses **Helvetica** (your design token) and a single-column, ATS-friendly
  layout; style accent colors mirror `CvDocument.tsx`.
- `react-pdf` and `pdfjs` are large libraries and are only needed on Download /
  PDF-upload. Consider lazy-loading them with a dynamic `import()` so they don’t
  weigh down the initial bundle (the build currently warns about chunk size).
- DOC export in `CompleteModal` remains a lightweight text serialization for now.
- Everything here is portable: if you migrate to Convex, `scoring.ts` / `jobfit.ts`
  move as-is, the PDF components are framework-agnostic React, and the tests follow
  with just an import-path update.
