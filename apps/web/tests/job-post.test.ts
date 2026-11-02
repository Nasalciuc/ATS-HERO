// Job Fit's job link (lib/job-post): what the page counts as a link, which addresses our server may
// open, how the job text comes out of a page, and how reading fails. The pages are served here, on
// this machine; nothing goes to a real site.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import zlib from "node:zlib";
import type { AddressInfo } from "node:net";
import { jobLinkIn } from "@/lib/job-post/link";
import { isPublicAddress } from "@/lib/job-post/address";
import { extractJobPost, htmlToText } from "@/lib/job-post/extract";
import { readJobPost } from "@/lib/job-post/read";

const REQUIREMENTS = `<h2>Requirements</h2><ul><li>3+ years of game design</li><li>Unity &amp; Jira</li><li>Level design for F2P games</li></ul>
<p>Nice to have: narrative design experience, A/B testing, economy balancing, live operations and analytics dashboards.</p>`;

const JSON_LD_PAGE = `<!doctype html><html><head><title>Game Designer</title>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", name: "Lumen Games" },
    { "@type": "JobPosting", title: "Game Designer (Content)", hiringOrganization: { "@type": "Organization", name: "Lumen Games" }, description: REQUIREMENTS },
  ],
})}</script></head><body><nav>Jobs · Companies · Sign in</nav><main>Apply now</main></body></html>`;

const PLAIN_PAGE = `<html><head><title>Game Designer at Lumen</title><script>window.x = "Note to AI agents"</script></head><body>
<header>Logo · Menu</header><nav>Home · Jobs</nav>
<main><h1>Game Designer</h1>${REQUIREMENTS}</main><footer>© 2026 · Privacy</footer></body></html>`;

const JS_SHELL = `<html><head><title>Loading…</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;

/** Russian in windows-1251, as some sites in Moldova still serve it. */
function cp1251(s: string): Buffer {
  return Buffer.from([...s].map((c) => {
    const code = c.codePointAt(0)!;
    if (code >= 0x410 && code <= 0x44f) return 0xc0 + (code - 0x410);
    if (code < 0x80) return code;
    throw new Error(`no cp1251 byte for ${c}`);
  }));
}
const RU = `<html><head><meta charset="windows-1251"></head><body><main><h1>Геймдизайнер</h1><p>Требования: опыт от 3 лет в геймдизайне, знание Unity и Jira, опыт работы с балансом экономики в мобильных играх, умение писать документацию для команды, работа с аналитикой и проведение тестов.</p></main></body></html>`;

let server: http.Server;
let endlessClosed = false;
let base = "";
let local = "";

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const path = req.url ?? "/";
    const html = (body: string | Buffer, extra: Record<string, string> = {}) =>
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...extra }).end(body);
    if (path === "/jsonld") return html(JSON_LD_PAGE);
    if (path === "/plain") return html(PLAIN_PAGE);
    if (path === "/gzip") return html(zlib.gzipSync(PLAIN_PAGE), { "content-encoding": "gzip" });
    if (path === "/ru") return res.writeHead(200, { "content-type": "text/html" }).end(Buffer.concat([cp1251(RU)]));
    if (path === "/shell") return html(JS_SHELL);
    if (path === "/redirect") return res.writeHead(302, { location: "/jsonld" }).end();
    if (path === "/to-private") return res.writeHead(302, { location: `${local}/jsonld` }).end();
    if (path === "/to-linkedin") return res.writeHead(301, { location: "https://www.linkedin.com/jobs/view/1" }).end();
    if (path === "/to-linkedin-dot") return res.writeHead(301, { location: "https://www.linkedin.com./jobs/view/1" }).end();
    if (path === "/endless-redirect") {
      // a redirect whose body never ends: the reader must close it, not read it
      res.on("close", () => (endlessClosed = true));
      res.writeHead(302, { location: "/gone" });
      const chunk = Buffer.alloc(64 * 1024, 120);
      const pump = () => {
        while (!res.destroyed && res.write(chunk));
        if (!res.destroyed) res.once("drain", pump);
      };
      return pump();
    }
    if (path === "/loop") return res.writeHead(302, { location: "/loop" }).end();
    if (path === "/forbidden") return res.writeHead(403).end("no bots");
    if (path === "/gone") return res.writeHead(404).end("not here");
    if (path === "/pdf") return res.writeHead(200, { "content-type": "application/pdf" }).end("%PDF-1.7");
    if (path === "/huge") return html("<p>" + "x".repeat(4 * 1024 * 1024) + "</p>");
    res.writeHead(500).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  base = `http://localhost:${port}`;
  local = `http://127.0.0.1:${port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

// The test server is on this machine: "localhost" is let through, any other name is not.
const onlyLocalhost = { allowAddress: (_a: string, host: string) => host === "localhost", anyPort: true };

describe("what counts as a link in the job field", () => {
  it("a field that holds only a link, with or without https://", () => {
    expect(jobLinkIn("https://wantapply.com/game-designer-content-at-glera-games")).toBe("https://wantapply.com/game-designer-content-at-glera-games");
    expect(jobLinkIn("  wantapply.com/game-designer  \n")).toBe("https://wantapply.com/game-designer");
  });
  it("text with a link in it is the post itself; a word is not a link", () => {
    expect(jobLinkIn("Game Designer at Lumen. Apply at https://lumen.example/jobs")).toBeNull();
    expect(jobLinkIn("Unity")).toBeNull();
    expect(jobLinkIn("http://localhost/x")).toBeNull();
    expect(jobLinkIn("ftp://files.example.com/job.txt")).toBeNull();
  });
});

describe("which addresses our server may open", () => {
  it.each(["8.8.8.8", "151.101.1.69", "2606:4700::6810:84e5", "2a00:1450:4001::1", "::ffff:8.8.8.8", "2002:808:808::1"])(
    "public: %s",
    (ip) => expect(isPublicAddress(ip)).toBe(true),
  );
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "224.0.0.1", "255.255.255.255", "198.18.0.1", "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "2001:db8::1", "not an ip",
    // outside global unicast, or carrying a private IPv4
    "fec0::1", "::ffff:0:7f00:1", "100::1", "64:ff9b:1::a00:1", "2001::1", "2002:a9fe:a9fe::1", "2002:7f00:1::", "3fff::1",
  ])("not public: %s", (ip) => expect(isPublicAddress(ip)).toBe(false));
});

describe("the job text out of a page", () => {
  it("from the structured data first: title, employer, the description as plain text", () => {
    const post = extractJobPost(JSON_LD_PAGE)!;
    expect(post).toMatchObject({ from: "structured_data", title: "Game Designer (Content)", company: "Lumen Games" });
    expect(post.text).toContain("• Unity & Jira");
    expect(post.text).toContain("Nice to have: narrative design");
    expect(post.text).not.toMatch(/<|Sign in/);
  });

  it("otherwise from the page's main block, without scripts, navigation, header or footer", () => {
    const post = extractJobPost(PLAIN_PAGE)!;
    expect(post.from).toBe("page_text");
    expect(post.text).toContain("• Level design for F2P games");
    expect(post.text).not.toMatch(/AI agents|Logo|Home · Jobs|Privacy/);
  });

  it("nothing from a page that loads its text with JavaScript", () => {
    expect(extractJobPost(JS_SHELL)).toBeNull();
  });

  it("entities and line breaks as text", () => {
    expect(htmlToText("<p>R&amp;D&nbsp;team &#8211; 3&#x2B; years</p>next<br>line")).toBe("R&D team – 3+ years\nnext\nline");
  });

  it("a page that leaves out </head>, an unclosed <nav>, an unclosed <script>", () => {
    // HTML lets a page end its head at <body>: the job is still there, the title isn't text
    expect(extractJobPost(`<html><head><title>Game Designer</title><body><main>${REQUIREMENTS}</main></body></html>`)?.text).not.toContain("Game Designer\n");
    expect(extractJobPost(`<html><head><title>Game Designer</title><body><main>${REQUIREMENTS}</main></body></html>`)?.text).toContain("Unity & Jira");
    // an unclosed block around the job keeps what follows it
    expect(extractJobPost(`<body><nav>Home<main>${REQUIREMENTS}</main></body>`)?.text).toContain("Unity & Jira");
    // an unclosed script takes the rest of the page, as in a browser, and nothing before it
    const unclosed = extractJobPost(`<body><main>${REQUIREMENTS}<script>var secret = "x"; </main></body>`);
    expect(unclosed?.text).toContain("Unity & Jira");
    expect(unclosed?.text).not.toContain("secret");
  });

  // What a second review found the first rewrite got wrong; each of these kept the job before it.
  describe("pages that once lost their job or leaked a script", () => {
    const JOB = `<h1>Senior Game Designer</h1><p>We are hiring a game designer for our mobile studio. You will own the economy balance and write design docs for the team.</p><ul><li>Unity &amp; Jira</li><li>3+ years in game design</li><li>Analytics and A/B tests</li></ul>`;
    const ld = (description: string) =>
      `<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title: "Frontend Developer", hiringOrganization: { name: "Acme" }, description })}</script>`;
    const text = (html: string) => extractJobPost(html)?.text ?? "";

    it("a JSON-LD description that mentions a tag (a Vue job) keeps the rest of the job", () => {
      const t = text(`<html><head>${ld(`<p>Build Vue single-file components (&lt;template&gt;, &lt;script setup&gt;).</p>${JOB}`)}</head><body></body></html>`);
      expect(t).toContain("(<template>, <script setup>)");
      expect(t).toContain("• Unity & Jira");
    });

    it("a JSON-LD block after a commented-out script is still found", () => {
      expect(extractJobPost(`<html><head><!-- <script src="/old.js"> -->${ld(JOB)}</head><body><div id="root"></div></body></html>`)?.from).toBe("structured_data");
    });

    it("a script or comment in the head that mentions <head> or <body> doesn't end the head", () => {
      const t = text(`<html><head><title>T</title><script>var t = '<body class="x">'; window.secretToken = "abc123";</script></head><body><main>${JOB}</main></body></html>`);
      expect(t).not.toContain("secretToken");
      expect(t).toContain("• Unity & Jira");
      expect(text(`<!DOCTYPE html><!-- <head> is generated by the CMS --><html><head><title>T</title></head><body><main>${JOB}</main></body></html>`)).toContain("• Unity & Jira");
    });

    it("a closer belongs to its own tag: </main-nav> doesn't close <main>", () => {
      expect(text(`<body><main><main-nav><a>Jobs</a></main-nav><section>${JOB}</section></main></body>`)).toContain("• Unity & Jira");
    });

    it("<svg/> closes itself, and an unclosed <svg> hides nothing after it", () => {
      expect(text(`<body><span><svg class="dot"/></span><main>${JOB}</main><footer><svg><path d=""/></svg></footer></body>`)).toContain("• Unity & Jira");
      expect(text(`<body><header><svg class="logo"></header><main>${JOB}</main></body>`)).toContain("• Unity & Jira");
    });

    it("a form that wraps the whole page (ASP.NET) keeps the job", () => {
      expect(text(`<body><form id="aspnetForm" action="/job.aspx"><div>${JOB}</div></form></body>`)).toContain("• Unity & Jira");
    });

    it("the job's own header (its title) stays; the page's header goes", () => {
      const t = text(`<body><header>Site menu</header><article><header><h1>Lead Game Designer</h1></header>${JOB}</article></body>`);
      expect(t).toContain("Lead Game Designer");
      expect(t).not.toContain("Site menu");
    });

    it("a title or employer name is at most 200 characters", () => {
      const post = extractJobPost(`<html><head><title>${"Game Designer ".repeat(100)}</title></head><body><main>${JOB}</main></body></html>`)!;
      expect(post.title!.length).toBeLessThanOrEqual(200);
    });
  });

  it("a letter whose lowercase is longer (İ) shifts nothing", () => {
    const post = extractJobPost(`<body>${"İ".repeat(50)}<script>x()</script><main>${REQUIREMENTS}</main></body>`)!;
    expect(post.text).toContain("• Unity & Jira");
    expect(post.text).not.toContain("x()");
  });

  // A page of openers with no closer used to take hours: each opener scanned to the end of the page.
  it.each([
    ["<", "<"],
    ["<li", "<li"],
    ["<!--", "<!--"],
    ["<svg", "<svg"],
    ["<nav", "<nav"],
    ["<script", "<script"],
    ['<script type="application/ld+json">', '<script type="application/ld+json">'],
    ["<main", "<main"],
    ["<a ", "<a "],
    ["&", "&aaaaaaaa"],
    ["aA (mixed case)", "aA"],
    ["İ", "İ"],
    ["</main-x", "</main-x"],
    ["<svg/>", "<svg/>"],
    ["<!---->", "<!---->"],
    ["<SCRIPT>x</SCRIPT>", "<SCRIPT>x</SCRIPT>"],
  ])("3 MB of %s is read in under 2 seconds (it used to take hours)", (_name, unit) => {
    const page = `<html><body>${unit.repeat(Math.floor((3 * 1024 * 1024) / unit.length))}</body></html>`;
    const t0 = performance.now();
    extractJobPost(page);
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});

describe("reading a link", () => {
  it("reads a page's structured data, also after a redirect", async () => {
    for (const path of ["/jsonld", "/redirect"]) {
      const r = await readJobPost(`${base}${path}`, onlyLocalhost);
      expect(r).toMatchObject({ ok: true, from: "structured_data", company: "Lumen Games" });
    }
  });

  it("reads a gzipped page and a Russian page in windows-1251", async () => {
    expect(await readJobPost(`${base}/gzip`, onlyLocalhost)).toMatchObject({ ok: true, from: "page_text" });
    const ru = await readJobPost(`${base}/ru`, onlyLocalhost);
    expect(ru).toMatchObject({ ok: true });
    if (ru.ok) expect(ru.text).toContain("Требования: опыт от 3 лет");
  });

  it("never opens a private address, even through a redirect", async () => {
    expect(await readJobPost(`${local}/jsonld`, { anyPort: true })).toEqual({ ok: false, reason: "private_address" });
    expect(await readJobPost(`${base}/to-private`, onlyLocalhost)).toEqual({ ok: false, reason: "private_address" });
    expect(await readJobPost("http://169.254.169.254/latest/meta-data/")).toEqual({ ok: false, reason: "private_address" });
  });

  it("never opens LinkedIn, even through a redirect", async () => {
    for (const link of ["https://www.linkedin.com/jobs/view/123", "https://www.linkedin.com./jobs/view/123", "https://LNKD.IN./abc", "https://linkedin.com../x"])
      expect(await readJobPost(link)).toEqual({ ok: false, reason: "linkedin" });
    expect(await readJobPost(`${base}/to-linkedin`, onlyLocalhost)).toEqual({ ok: false, reason: "linkedin" });
    expect(await readJobPost(`${base}/to-linkedin-dot`, onlyLocalhost)).toEqual({ ok: false, reason: "linkedin" });
  });

  it("says why a page can't be read", async () => {
    expect(await readJobPost(`${base}/forbidden`, onlyLocalhost)).toEqual({ ok: false, reason: "blocked" });
    expect(await readJobPost(`${base}/gone`, onlyLocalhost)).toEqual({ ok: false, reason: "not_found" });
    expect(await readJobPost(`${base}/pdf`, onlyLocalhost)).toEqual({ ok: false, reason: "not_a_page" });
    expect(await readJobPost(`${base}/shell`, onlyLocalhost)).toEqual({ ok: false, reason: "no_text" });
    expect(await readJobPost(`${base}/huge`, onlyLocalhost)).toEqual({ ok: false, reason: "too_large" });
    expect(await readJobPost(`${base}/loop`, onlyLocalhost)).toEqual({ ok: false, reason: "unreachable" });
  });

  it("refuses what isn't a web link, a link with a password, and other ports", async () => {
    expect(await readJobPost("ftp://example.com/job")).toEqual({ ok: false, reason: "invalid_url" });
    expect(await readJobPost("https://user:pw@jobs.example.com/1")).toEqual({ ok: false, reason: "invalid_url" });
    expect(await readJobPost("https://jobs.example.com:8443/1")).toEqual({ ok: false, reason: "other_port" });
  });

  it("closes a redirect without reading its body", async () => {
    expect(await readJobPost(`${base}/endless-redirect`, onlyLocalhost)).toEqual({ ok: false, reason: "not_found" });
    await new Promise((r) => setTimeout(r, 200));
    expect(endlessClosed).toBe(true);
  });

  it("a slow name lookup counts toward the deadline", async () => {
    const slow = () => new Promise<{ address: string; family: number }[]>((r) => setTimeout(() => r([{ address: "127.0.0.1", family: 4 }]), 3000));
    const t0 = Date.now();
    expect(await readJobPost(`${base}/jsonld`, { ...onlyLocalhost, resolve: slow, timeoutMs: 300 })).toEqual({ ok: false, reason: "unreachable" });
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
