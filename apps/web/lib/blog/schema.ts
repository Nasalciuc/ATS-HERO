// The frontmatter of a post in content/blog/<slug>.md. A post that doesn't match fails the build
// (lib/blog/posts.ts throws) and tests/blog.test.ts names the field.
//
// Besides the usual fields, the frontmatter holds the data of the post's figures: the body places
// them with a marker (```blog-levels``` and so on, see components/blog/ArticleBody.tsx), so the
// prose stays plain Markdown and the numbers stay in one checked place.
import { z } from "zod";
import { AUTHOR_IDS } from "./authors";
import { TOPIC_IDS } from "./topics";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "write the date as YYYY-MM-DD");
const text = z.string().trim().min(1);

const levelNote = z.object({ meaning: text, example: text }).strict();

const atsBase = { ats: text, note: text, comparedWith: text };
const atsScore = z.discriminatedUnion("kind", [
  // a grade per candidate, the first one shown as picked (Workday HiredScore's A–D)
  z.object({ ...atsBase, kind: z.literal("grades"), shows: z.array(text).min(2) }).strict(),
  // named levels, the first one shown as picked (Greenhouse's Strong / Good / Partial / Limited)
  z.object({ ...atsBase, kind: z.literal("levels"), shows: z.array(text).min(2) }).strict(),
  z.object({ ...atsBase, kind: z.literal("stars"), filled: z.number().int().min(1), of: z.number().int().min(2) }).strict(),
  z.object({ ...atsBase, kind: z.literal("label"), shows: z.array(text).length(1) }).strict(),
]);

export const COVERS = ["score", "fields", "formats"] as const;
export type Cover = (typeof COVERS)[number];

export const postSchema = z
  .object({
    /** The page's <title> adds " — ATS Hero": 60 characters keeps the whole of it in the results. */
    title: z.string().trim().min(10).max(60),
    /** The meta description: long enough to be used, short enough not to be cut. */
    description: z.string().trim().min(120).max(160),
    /** The line under the title, on the list and in the post's header. */
    dek: text,
    topic: z.enum(TOPIC_IDS),
    cover: z.enum(COVERS),
    author: z.enum(AUTHOR_IDS),
    publishedAt: isoDate,
    updatedAt: isoDate,
    /** When the facts were last checked against their sources (shown in the author box). */
    checkedAt: isoDate.optional(),
    shortAnswer: z.array(z.object({ lead: text, text }).strict()).length(3).optional(),
    levels: z
      .object({ critical: levelNote, major: levelNote, missing: levelNote, tip: levelNote })
      .strict()
      .optional(),
    atsScores: z.array(atsScore).min(1).optional(),
    titleFilter: z.object({ parsed: text, issue: text, filter: text, result: text, caption: text }).strict().optional(),
    lab: z
      .object({
        date: isoDate,
        results: z
          .array(z.object({ passed: z.number().int().min(0), runs: z.number().int().min(1), label: text }).strict())
          .min(1),
        note: text,
      })
      .strict()
      .optional(),
    faq: z.array(z.object({ q: text, a: text }).strict()).default([]),
    sources: z.array(z.object({ title: text, url: z.string().url().startsWith("https://") }).strict()).min(1),
    related: z.array(z.string()).default([]),
  })
  .strict()
  .refine((p) => p.updatedAt >= p.publishedAt, { message: "updatedAt is before publishedAt", path: ["updatedAt"] });

export type PostMeta = z.infer<typeof postSchema>;
export type AtsScore = NonNullable<PostMeta["atsScores"]>[number];

export interface Heading {
  id: string;
  text: string;
}

export interface Post extends PostMeta {
  slug: string;
  /** The Markdown after the frontmatter. */
  body: string;
  /** The body's ## headings, in order: the table of contents and the headings' ids. */
  headings: Heading[];
  readingMinutes: number;
}
