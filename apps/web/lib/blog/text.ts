// Text helpers the blog shares between the loader (server, build time) and the components.
// No Node APIs here, so any component may import them.

/** The id a heading gets: lower case, letters and digits, dashes between words. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A heading's text without its inline Markdown: what a reader sees, and what its id is made from. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
}

/** Code in Markdown: fenced blocks (the figures' markers among them) and `inline` spans. Left as typed. */
const CODE = /^```[\s\S]*?^```[ \t]*$|`[^`\n]*`/gm;

function curl(text: string): string {
  return text
    .replace(/(?<=[\p{L}\p{N}])'(?=\p{L})/gu, "’") // you'll, ATS's
    .replace(/(?<=s)'(?=[\s,.;:!?)]|$)/gm, "’"); // the vendors' own
}

/**
 * Straight apostrophes the way the rest of the site prints them: you'll → you’ll, the vendors' own →
 * the vendors’ own. Only an apostrophe inside a word or after a plural s changes (posts write their
 * quotes as “ ” already), and code stays as typed.
 */
export function curlyApostrophes(markdown: string): string {
  let out = "";
  let last = 0;
  for (const m of markdown.matchAll(CODE)) {
    out += curl(markdown.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + curl(markdown.slice(last));
}

/** curlyApostrophes on every text of a post's frontmatter; addresses (any "url") stay as written. */
export function typographic<T>(value: T, key = ""): T {
  if (typeof value === "string") return (key === "url" ? value : curl(value)) as T;
  if (Array.isArray(value)) return value.map((v) => typographic(v)) as T;
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typographic(v, k)])) as T;
  }
  return value;
}

/** Where a link goes, the way a reader names a site: "support.greenhouse.io" (no https://, no www.). */
export function hostOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

/** "13 November 2026", the way the legal pages write their dates; never broken across two lines. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .replace(/ /g, " ");
}
