/**
 * Job Fit: a job post given as a link. Shared by the page (is the field just a link?) and the
 * server route that reads it (lib/job-post/read.ts). Nothing here opens a connection.
 */

/** Why a link couldn't be read, in the words the page shows. */
export type JobLinkFailure =
  | "invalid_url"
  | "linkedin"
  | "private_address"
  | "other_port"
  | "blocked"
  | "not_found"
  | "unreachable"
  | "not_a_page"
  | "too_large"
  | "no_text"
  | "too_many_requests";

export const JOB_LINK_MSG: Record<JobLinkFailure, string> = {
  invalid_url: "This doesn't look like a link to a job post. Paste the job text instead.",
  linkedin: "We don't open LinkedIn pages. Copy the job text from LinkedIn and paste it here.",
  private_address: "This link doesn't lead to a public web page. Paste the job text instead.",
  other_port: "We only open ordinary web links, without a port number such as :8443. Paste the job text instead.",
  blocked: "This site doesn't let us read the page. Copy the job text and paste it here.",
  not_found: "This link leads to a missing page: the job may be closed. Check the link, or paste the job text.",
  unreachable: "We couldn't open this link. Check it, or copy the job text and paste it here.",
  not_a_page: "This link isn't a web page we can read. Paste the job text instead.",
  too_large: "This page is too large for us to read. Copy the job text and paste it here.",
  no_text:
    "We opened the page but found no job text in it: the site may load it with JavaScript. Copy the job text and paste it here.",
  too_many_requests: "Too many links in a row. Wait a minute, or paste the job text.",
};

/**
 * LinkedIn is never opened (AGENTS.md rule 11: no scraping or automation of LinkedIn). A name may
 * end with dots ("www.linkedin.com." is the same site), so they go before the check.
 */
export const isLinkedIn = (host: string) => /(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/i.test(host.replace(/\.+$/, ""));

/**
 * The link, when the job field holds only a link (with or without "https://"); null when it holds
 * text, even text with a link in it: then the text is the post.
 */
export function jobLinkIn(field: string): string | null {
  const s = field.trim();
  if (!s || /\s/.test(s) || s.length > 2000) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : /^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+(\/\S*)?$/u.test(s) ? `https://${s}` : null;
  if (!withScheme) return null;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes(".") ? url.href : null;
  } catch {
    return null;
  }
}
