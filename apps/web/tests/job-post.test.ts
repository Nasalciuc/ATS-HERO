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
  it.each(["8.8.8.8", "151.101.1.69", "2606:4700::6810:84e5", "::ffff:8.8.8.8"])("public: %s", (ip) => expect(isPublicAddress(ip)).toBe(true));
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "224.0.0.1", "255.255.255.255", "198.18.0.1", "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "2001:db8::1", "not an ip",
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
    expect(await readJobPost("https://www.linkedin.com/jobs/view/123")).toEqual({ ok: false, reason: "linkedin" });
    expect(await readJobPost(`${base}/to-linkedin`, onlyLocalhost)).toEqual({ ok: false, reason: "linkedin" });
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
    expect(await readJobPost("https://jobs.example.com:8443/1")).toEqual({ ok: false, reason: "private_address" });
  });
});
