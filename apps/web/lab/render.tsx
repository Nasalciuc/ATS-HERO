// ATS lab — renderer. CvData fixtures → the EXACT production templates → PDF (every template)
// + DOCX, through the same printableCv() boundary the browser export uses. No browser needed,
// so CI can regenerate the whole matrix in seconds after any template change.
//
//   npx tsx --tsconfig lab/tsconfig.json lab/render.tsx [fixtures.json] [outDir]
import fs from "node:fs";
import path from "node:path";
import { Font, renderToFile } from "@react-pdf/renderer";
import { Packer } from "docx";
import { TEMPLATES } from "../components/cv/templates";
import { resolveTheme } from "../components/cv/templates/theme";
import { buildCvDocx } from "../lib/exportDocx";
import { printableCv } from "../lib/cv-print";
import type { CvData } from "../lib/types";

const WEB = path.resolve(__dirname, "..");
const REPO = path.resolve(WEB, "../..");
const fixtures = process.argv[2] ?? path.join(REPO, "tools/ats-lab/fixtures/personas.json");
const outDir = process.argv[3] ?? path.join(REPO, "tools/ats-lab/out/files");

// Same families as fonts.ts, but filesystem paths (fonts.ts uses browser URLs "/fonts/…").
Font.register({ family: "CvSans", src: path.join(WEB, "public/fonts/Inter-Regular.ttf") });
Font.register({ family: "CvSansBold", src: path.join(WEB, "public/fonts/Inter-Bold.ttf") });
Font.registerHyphenationCallback((word) => [word]);

async function main() {
  const personas = JSON.parse(fs.readFileSync(fixtures, "utf8")) as Record<string, CvData>;
  fs.mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const [id, data] of Object.entries(personas)) {
    for (const t of TEMPLATES) {
      const Template = t.component;
      // `<id>--<template>.pdf` is EXACTLY what production renders (theme untouched), and the gate
      // judges it. `-split` / `-stacked` is the other meta placement, rendered for comparison.
      const production = resolveTheme(t.id);
      const alt = production.meta === "stacked" ? "split" : "stacked";
      for (const [suffix, theme] of [["", production], [`-${alt}`, { ...production, meta: alt }]] as const) {
        const file = path.join(outDir, `${id}--${t.id}${suffix}.pdf`);
        await renderToFile(<Template data={printableCv(data)} theme={theme} />, file);
        written.push(file);
      }
    }
    const docx = path.join(outDir, `${id}--docx.docx`);
    fs.writeFileSync(docx, await Packer.toBuffer(buildCvDocx(data)));
    written.push(docx);
  }
  console.log(`rendered ${written.length} files → ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
