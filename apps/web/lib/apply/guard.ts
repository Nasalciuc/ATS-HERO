/**
 * Where the apply agent may go, decided before a browser starts (APLICARE-CU-AGENT.md §4.1, §5).
 *
 * - LinkedIn: never (AGENTS.md rule 11; its User Agreement 8.2 forbids bots and automation).
 * - Indeed Apply and Workday: not now (an Indeed account, or a candidate account per employer).
 * - Greenhouse, Lever, Ashby: the ATSs the agent is built for first. Breezy joins with our own test
 *   job (AA-2), under that job's exact subdomain only.
 * - localhost: the apply lab's synthetic forms, and only when the caller allows it.
 *
 * The browser is then held to `allowedDomains`: agent-browser blocks navigation and sub-resources
 * outside the list. The lists name each ATS's own domains; the third-party hosts its form loads (a
 * CDN, its CAPTCHA) are added after we see a real form of that ATS, on our test job first.
 */

export type Ats = "greenhouse" | "lever" | "ashby" | "lab";

export type Refusal = "invalid_url" | "not_https" | "linkedin" | "indeed" | "workday" | "unsupported";

export type Target =
  | { ok: true; ats: Ats; url: string; allowedDomains: string[] }
  | { ok: false; reason: Refusal; host: string | null };

const ATS_HOSTS: [Ats, RegExp, string[]][] = [
  ["greenhouse", /(^|\.)greenhouse\.io$/, ["greenhouse.io", "*.greenhouse.io"]],
  ["lever", /(^|\.)lever\.co$/, ["lever.co", "*.lever.co"]],
  ["ashby", /(^|\.)ashbyhq\.com$/, ["ashbyhq.com", "*.ashbyhq.com"]],
];

const NEVER: [Refusal, RegExp][] = [
  ["linkedin", /(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/],
  ["indeed", /(^|\.)indeed\.[a-z.]+$/],
  ["workday", /(^|\.)myworkdayjobs\.com$|(^|\.)myworkdaysite\.com$|(^|\.)workday\.com$/],
];

const LOCAL = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function postingTarget(raw: string, opts: { allowLocal?: boolean } = {}): Target {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid_url", host: null };
  }
  // a user name or password in the link: never sent anywhere
  if (url.username || url.password) return { ok: false, reason: "invalid_url", host: null };
  const host = url.hostname.toLowerCase();
  if (opts.allowLocal && LOCAL.has(host) && (url.protocol === "http:" || url.protocol === "https:"))
    return { ok: true, ats: "lab", url: url.href, allowedDomains: [host === "[::1]" ? "::1" : host] };
  for (const [reason, re] of NEVER) if (re.test(host)) return { ok: false, reason, host };
  if (url.protocol !== "https:") return { ok: false, reason: "not_https", host };
  for (const [ats, re, domains] of ATS_HOSTS) if (re.test(host)) return { ok: true, ats, url: url.href, allowedDomains: domains };
  return { ok: false, reason: "unsupported", host };
}
