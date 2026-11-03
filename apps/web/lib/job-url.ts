/**
 * A job's link, as the Tracker keeps it (TRACKER-V2-DESIGN.md §6, §7.1).
 *
 * - `safeJobUrl`: only http and https links are kept. The Tracker renders the link as an <a href>,
 *   so a `javascript:` or `data:` link must never be stored.
 * - `jobUrlKey`: the same job saved twice opens the row that exists. Two links name one job when
 *   they differ only in the scheme, the host's case, a leading "www.", a trailing slash, the
 *   fragment, the order of the query or the tracking parameters a board or a campaign adds. Every
 *   other query parameter stays: on many boards it is the job's id (Indeed's `?jk=…`).
 */

const TRACKING = /^(utm_[a-z]+|gclid|fbclid|msclkid|mc_cid|mc_eid|gh_src|_hsenc|_hsmi)$/i;

export const MAX_JOB_URL_CHARS = 500;

/** The link if it is an http(s) URL we can keep, otherwise null. */
export function safeJobUrl(raw: string | null | undefined): string | null {
  const text = raw?.trim();
  if (!text || text.length > MAX_JOB_URL_CHARS) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null; // a link with credentials in it is not a job link
  return url.toString();
}

/** One key per job: see the file's comment. Null when the link isn't one we keep. */
export function jobUrlKey(raw: string | null | undefined): string | null {
  const safe = safeJobUrl(raw);
  if (!safe) return null;
  const url = new URL(safe);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const port = url.port ? `:${url.port}` : "";
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "";
  const params = [...url.searchParams.entries()]
    .filter(([name]) => !TRACKING.test(name))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  return `${host}${port}${path}${query}`;
}
