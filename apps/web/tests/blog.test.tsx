// The blog's posts are Markdown files checked at build time (lib/blog/schema.ts). These checks keep
// what the schema can't see honest:
// - every figure a body places (```blog-<name>```) exists and has its data in the frontmatter;
// - the table of contents links to ids the rendered body really has;
// - every post sends the reader to the check, and "Keep reading" names real posts;
// - links that leave the site open in a new tab without handing it our page (noopener);
// - /blog links every post once (for people and screen readers), whichever layout its size gets;
// - the row that opens on phones lists the same sections as the side column, and every source
//   shows the site it is on.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The post page imports these client components (Clerk, router hooks); the other page tests mock them the same way.
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

import fs from "node:fs";
import path from "node:path";
import { allPosts, parsePost } from "@/lib/blog/posts";
import { curlyApostrophes, hostOf, slugify, typographic } from "@/lib/blog/text";
import PostCover from "@/components/blog/PostCover";
import { BLOCK_DATA } from "@/components/blog/blocks";
import ArticleBody from "@/components/blog/ArticleBody";
import { Sources } from "@/components/blog/parts";
import BlogPostPage, { tocOf } from "@/views/BlogPostPage";
import BlogListPage, { SIDE_LAYOUT_FROM } from "@/views/BlogListPage";
import { blogJsonLd, blogPostJsonLd } from "@/lib/structured-data";
import { AUTHORS } from "@/lib/blog/authors";
import { SITE_URL } from "@/lib/site";

const posts = allPosts();
const MARKERS = /^```blog-([a-z-]+)[ \t]*$/gm;

const sample = (frontmatter: string, body = "Text.") => `---\n${frontmatter}\n---\n\n${body}\n`;
const VALID = [
  "title: A post about how an ATS reads",
  `description: "${"A description long enough to be used by search engines and short enough not to be cut. ".repeat(2).slice(0, 140)}"`,
  "dek: The line under the title.",
  "topic: how-ats-works",
  "cover: score",
  "author: vladimir-nasalciuc",
  "publishedAt: 2026-11-13",
  "updatedAt: 2026-11-13",
  "sources:",
  "  - title: A source",
  "    url: https://example.com/a",
].join("\n");

describe("blog posts", () => {
  it("has at least one post, and every post's frontmatter matches the schema", () => {
    expect(posts.length).toBeGreaterThan(0);
  });

  it("stops a post that misses a field, and names the file and the field", () => {
    expect(() => parsePost("broken-post", sample(VALID.replace(/sources:[\s\S]*$/, "")))).toThrow(
      /content\/blog\/broken-post\.md: sources/,
    );
    expect(() => parsePost("long-title", sample(VALID.replace("title: A post about how an ATS reads", `title: ${"x".repeat(61)}`)))).toThrow(
      /title/,
    );
    expect(() => parsePost("Bad_Name", sample(VALID))).toThrow(/file name/);
    expect(parsePost("good-post", sample(VALID)).slug).toBe("good-post");
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: every figure it places exists and has its data", (_slug, post) => {
    const used = [...post.body.matchAll(MARKERS)].map((m) => m[1]);
    for (const name of used) {
      expect(Object.keys(BLOCK_DATA), `unknown figure blog-${name}`).toContain(name);
      const field = BLOCK_DATA[name];
      if (field) expect(post[field], `blog-${name} needs "${field}" in the frontmatter`).toBeDefined();
    }
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: sends the reader to the check", (_slug, post) => {
    expect(/^```blog-cta[ \t]*$/m.test(post.body) || post.body.includes("](/app/improve)")).toBe(true);
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: names only real posts under Keep reading", (slug, post) => {
    for (const other of post.related) {
      expect(other).not.toBe(slug);
      expect(posts.map((p) => p.slug)).toContain(other);
    }
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: the contents link to ids the page has, each once", (_slug, post) => {
    const toc = tocOf(post);
    expect(new Set(toc.map((h) => h.id)).size).toBe(toc.length);
    const html = renderToStaticMarkup(<BlogPostPage post={post} related={[]} />);
    for (const heading of toc) {
      expect(html.match(new RegExp(`id="${heading.id}"`, "g")) ?? [], `#${heading.id}`).toHaveLength(1);
      expect(heading.id).toBe(heading.id === "short-answer" || heading.id === "faq" || heading.id === "sources" ? heading.id : slugify(heading.text));
    }
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: the body renders its figures, not code blocks", (_slug, post) => {
    const html = renderToStaticMarkup(<ArticleBody post={post} />);
    expect(html).not.toContain("language-blog-");
    expect(html).not.toContain("<pre");
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: links that leave the site open apart, with noopener", (_slug, post) => {
    const html = renderToStaticMarkup(<BlogPostPage post={post} related={[]} />);
    const external = [...html.matchAll(/<a [^>]*href="https?:\/\/[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(external.length).toBeGreaterThan(0);
    for (const tag of external) {
      expect(tag).toContain('target="_blank"');
      expect(tag).toContain('rel="noopener noreferrer"');
    }
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: its JSON-LD says what the page shows", (_slug, post) => {
    const graph = blogPostJsonLd(post)["@graph"] as Record<string, any>[];
    const article = graph.find((n) => n["@type"] === "BlogPosting")!;
    expect(article.headline).toBe(post.title);
    expect(article.description).toBe(post.description);
    expect(article.datePublished).toBe(post.publishedAt);
    expect(article.dateModified).toBe(post.updatedAt);
    expect(article.author).toEqual({ "@type": "Person", name: AUTHORS[post.author].name, jobTitle: AUTHORS[post.author].role });
    expect(article.citation).toEqual(post.sources.map((s) => s.url));
    const crumbs = graph.find((n) => n["@type"] === "BreadcrumbList")!.itemListElement as { item: string }[];
    expect(crumbs.map((c) => c.item)).toEqual([`${SITE_URL}/`, `${SITE_URL}/blog`, `${SITE_URL}/blog/${post.slug}`]);
  });

  it("the /blog JSON-LD lists every post, newest first", () => {
    const blog = (blogJsonLd(posts)["@graph"] as Record<string, any>[]).find((n) => n["@type"] === "Blog")!;
    expect(blog.blogPost.map((p: { url: string }) => p.url)).toEqual(posts.map((p) => `${SITE_URL}/blog/${p.slug}`));
  });

  it("lists every post on /blog, newest first", () => {
    const html = renderToStaticMarkup(<BlogListPage posts={posts} />);
    for (const post of posts) expect(html).toContain(`href="/blog/${post.slug}"`);
    const dates = posts.map((p) => p.publishedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it.each([1, 2, 3, 4, 5, 8])("/blog with %i posts links each one once, newest first, in the layout for its size", (n) => {
    const day = (i: number) => `2026-11-${String(28 - i).padStart(2, "0")}`;
    const many = Array.from({ length: n }, (_, i) => ({
      ...posts[0],
      slug: `guide-${i}`,
      title: `Guide number ${i} on reading CVs`,
      publishedAt: day(i),
      updatedAt: day(i),
    }));
    const html = renderToStaticMarkup(<BlogListPage posts={many} />);
    // The link people and screen readers use; a cover or "Read the guide" is a hidden second target.
    const visible = [...html.matchAll(/<a [^>]*href="\/blog\/(guide-\d+)"[^>]*>/g)]
      .filter((m) => !m[0].includes('aria-hidden="true"'))
      .map((m) => m[1]);
    expect(visible).toEqual(many.map((p) => p.slug));
    expect(html.includes('<article class="blog-feature">'), "the wide card").toBe(n < SIDE_LAYOUT_FROM);
    expect(html.includes('class="blog-latest"'), "the Latest column").toBe(n >= SIDE_LAYOUT_FROM);
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: the row that opens on phones lists the side's sections", (_slug, post) => {
    const html = renderToStaticMarkup(<BlogPostPage post={post} related={[]} />);
    const part = (start: string, end: string) => {
      const from = html.indexOf(start);
      expect(from, start).toBeGreaterThan(-1);
      return html.slice(from, html.indexOf(end, from));
    };
    const hrefs = (s: string) => [...s.matchAll(/href="(#[^"]+)"/g)].map((m) => m[1]);
    const fold = hrefs(part('<details class="blog-fold"', "</details>"));
    expect(fold).toEqual(tocOf(post).map((h) => `#${h.id}`));
    expect(hrefs(part('<nav class="blog-toc"', "</nav>"))).toEqual(fold);
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: every source shows the site it is on", (_slug, post) => {
    const html = renderToStaticMarkup(<Sources post={post} />);
    for (const source of post.sources) {
      expect(html).toContain(`<span class="blog-sources__host">${hostOf(source.url)}</span>`);
    }
    expect(hostOf("https://www.icims.com/subprocessors/")).toBe("icims.com");
    expect(hostOf("https://support.greenhouse.io/hc/en-us/articles/1")).toBe("support.greenhouse.io");
  });

  it("prints apostrophes the way the site does, and leaves code and addresses as typed", () => {
    expect(curlyApostrophes("you'll see the ATS's own docs, the vendors' own, and the 90's")).toBe(
      "you’ll see the ATS’s own docs, the vendors’ own, and the 90’s",
    );
    expect(curlyApostrophes("run `don't` here\n\n```blog-x\nit's\n```\n\nit's done")).toBe(
      "run `don't` here\n\n```blog-x\nit's\n```\n\nit’s done",
    );
    expect(curlyApostrophes("“quoted” and 'single' quotes")).toBe("“quoted” and 'single' quotes");
    expect(typographic({ title: "It's", sources: [{ title: "Bob's page", url: "https://e.com/it's" }] })).toEqual({
      title: "It’s",
      sources: [{ title: "Bob’s page", url: "https://e.com/it's" }],
    });
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: no straight apostrophe inside a word reaches the page", (_slug, post) => {
    const html = renderToStaticMarkup(<BlogPostPage post={post} related={[]} />);
    // React writes ' as &#x27;
    expect(html.match(/\p{L}&#x27;\p{L}/gu) ?? []).toEqual([]);
  });

  it("the covers' pictures exist, in every size their srcset names", () => {
    for (const cover of ["score", "fields", "formats"] as const) {
      for (const size of ["hero", "card", "thumb"] as const) {
        const html = renderToStaticMarkup(<PostCover cover={cover} size={size} />);
        const files = [...html.matchAll(/(?:src|srcSet|srcset)="([^"]+)"/g)].flatMap((m) =>
          m[1].split(",").map((part) => part.trim().split(/\s+/)[0]),
        );
        for (const file of files) expect(fs.existsSync(path.join(process.cwd(), "public", file)), file).toBe(true);
      }
    }
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: the share row carries the post's own address", (_slug, post) => {
    const html = renderToStaticMarkup(<BlogPostPage post={post} related={[]} />);
    const own = encodeURIComponent(`${SITE_URL}/blog/${post.slug}`);
    expect(html).toContain(`href="https://www.linkedin.com/sharing/share-offsite/?url=${own}"`);
  });
});
