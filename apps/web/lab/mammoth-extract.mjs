// ATS lab — mammoth raw-text extractor for DOCX (used by browser-side parsers such as
// ats-screener). Usage: node lab/mammoth-extract.mjs file.docx
import mammoth from "mammoth";

const { value } = await mammoth.extractRawText({ path: process.argv[2] });
process.stdout.write(value);
