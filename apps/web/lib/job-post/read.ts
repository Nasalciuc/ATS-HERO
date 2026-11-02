/**
 * Job Fit: our server opens a job link the person pasted, once, and returns the job text
 * (POST /api/job-post). Server-only.
 *
 * - Public addresses only: the name is resolved first, every address it has must be public
 *   (lib/job-post/address.ts), and the connection goes to that address, not to a second lookup
 *   (so a name can't switch to an internal address between the check and the connection).
 * - Every redirect is checked the same way, at most 4 of them.
 * - LinkedIn is never opened (AGENTS.md rule 11), not even through a redirect.
 * - 8 seconds in all, name lookups included; at most 3 MB; only HTML pages on ports 80 and 443.
 *   Nothing is kept: not the link, not the page.
 * - The site sees our server and an honest user agent, never the person's address or cookies.
 */
import http from "node:http";
import https from "node:https";
import { lookup as dnsLookup } from "node:dns/promises";
import type { LookupFunction } from "node:net";
import zlib from "node:zlib";
import { isPublicAddress } from "./address";
import { extractJobPost, type JobPost } from "./extract";
import { isLinkedIn, type JobLinkFailure } from "./link";

export const USER_AGENT = "Mozilla/5.0 (compatible; ATSHeroBot/1.0; +https://atshero.app)";
const TIMEOUT_MS = 8_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 4;

export type JobPostResult = ({ ok: true } & JobPost) | { ok: false; reason: JobLinkFailure };

type Resolved = { address: string; family: number }[];

export interface ReadOptions {
  /** may we connect to this address? Default: public addresses only. Tests serve pages locally. */
  allowAddress?: (address: string, host: string) => boolean;
  /** any port, not just 80 and 443: tests only */
  anyPort?: boolean;
  timeoutMs?: number;
  /** the name lookup: tests only (a slow one, to check the deadline holds) */
  resolve?: (host: string) => Promise<Resolved>;
}

class Refused extends Error {
  constructor(readonly reason: JobLinkFailure) {
    super(reason);
  }
}

/** The URL, if it's one we may open at all (before any lookup). */
function checkUrl(raw: string, anyPort = false): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Refused("invalid_url");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Refused("invalid_url");
  if (url.username || url.password) throw new Refused("invalid_url");
  if (url.port && url.port !== "80" && url.port !== "443" && !anyPort) throw new Refused("other_port");
  if (isLinkedIn(url.hostname)) throw new Refused("linkedin");
  return url;
}

const systemLookup = (host: string) => dnsLookup(host, { all: true, verbatim: false }); // IPv4 first

/**
 * The address to connect to: every address of the name must be allowed; the first one is used.
 * The lookup counts toward the deadline like the rest: a slow name server can't stretch it.
 */
async function addressOf(
  url: URL,
  allow: (a: string, h: string) => boolean,
  deadline: number,
  resolve: (host: string) => Promise<Resolved>,
): Promise<{ address: string; family: number }> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const left = deadline - Date.now();
  if (left <= 0) throw new Refused("unreachable");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Refused("unreachable")), left);
  });
  let addresses: Resolved;
  try {
    addresses = await Promise.race([resolve(host), late]);
  } catch {
    throw new Refused("unreachable");
  } finally {
    clearTimeout(timer);
  }
  if (!addresses.length || addresses.some((a) => !allow(a.address, host))) throw new Refused("private_address");
  return addresses[0];
}

interface Page {
  status: number;
  location: string | null;
  contentType: string;
  body: Buffer;
}

function get(url: URL, pinned: { address: string; family: number }, deadline: number): Promise<Page> {
  // the connection uses the address we checked, whatever a second lookup would say
  const lookup: LookupFunction = (_host, opts, cb) => {
    if (opts && typeof opts === "object" && opts.all) cb(null, [{ address: pinned.address, family: pinned.family }]);
    else cb(null, pinned.address, pinned.family);
  };
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const left = deadline - Date.now();
    if (left <= 0) return reject(new Refused("unreachable"));
    let req: http.ClientRequest | undefined;
    // the whole answer within the time left, not just no silence that long
    const timer = setTimeout(() => {
      req?.destroy();
      reject(new Refused("unreachable"));
    }, left);
    const done = <T,>(fn: (v: T) => void) => (v: T) => {
      clearTimeout(timer);
      fn(v);
    };
    resolve = done(resolve);
    reject = done(reject);
    req = client.get(
      url,
      {
        lookup,
        timeout: left,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en,ro;q=0.8,ru;q=0.7",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        const contentType = String(res.headers["content-type"] ?? "");
        if (status >= 300 && status < 400) {
          // the redirect's own body is never read: close the connection, or it would be read to
          // its end (endless, if the site wants) after the deadline is gone
          res.destroy();
          return resolve({ status, location, contentType, body: Buffer.alloc(0) });
        }
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          encoding === "gzip" ? res.pipe(zlib.createGunzip()) : encoding === "deflate" ? res.pipe(zlib.createInflate()) : encoding === "br" ? res.pipe(zlib.createBrotliDecompress()) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req?.destroy();
            reject(new Refused("too_large"));
            return;
          }
          chunks.push(c);
        });
        stream.on("end", () => resolve({ status, location, contentType, body: Buffer.concat(chunks) }));
        stream.on("error", () => reject(new Refused("unreachable")));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Refused("unreachable"));
    });
    req.on("error", (e) => reject(e instanceof Refused ? e : new Refused("unreachable")));
  });
}

/** The page's text in its own encoding (the header's charset, else the page's <meta>, else UTF-8). */
function decode(body: Buffer, contentType: string): string {
  const head = body.subarray(0, 2048).toString("latin1");
  const charset = (contentType.match(/charset=["']?([\w-]+)/i)?.[1] ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

export async function readJobPost(raw: string, opts: ReadOptions = {}): Promise<JobPostResult> {
  const allow = opts.allowAddress ?? ((address: string) => isPublicAddress(address));
  const deadline = Date.now() + (opts.timeoutMs ?? TIMEOUT_MS);
  try {
    let url = checkUrl(raw, opts.anyPort);
    for (let hop = 0; ; hop++) {
      const page = await get(url, await addressOf(url, allow, deadline, opts.resolve ?? systemLookup), deadline);
      if (page.status >= 300 && page.status < 400) {
        if (!page.location || hop >= MAX_REDIRECTS) return { ok: false, reason: "unreachable" };
        url = checkUrl(new URL(page.location, url).href, opts.anyPort);
        continue;
      }
      if (page.status === 401 || page.status === 403 || page.status === 429) return { ok: false, reason: "blocked" };
      if (page.status === 404 || page.status === 410) return { ok: false, reason: "not_found" };
      if (page.status < 200 || page.status >= 300) return { ok: false, reason: "unreachable" };
      if (!/text\/html|application\/xhtml\+xml/i.test(page.contentType)) return { ok: false, reason: "not_a_page" };
      const post = extractJobPost(decode(page.body, page.contentType));
      return post ? { ok: true, ...post } : { ok: false, reason: "no_text" };
    }
  } catch (e) {
    if (e instanceof Refused) return { ok: false, reason: e.reason };
    return { ok: false, reason: "unreachable" };
  }
}
