/**
 * Who runs ATS Hero and how to reach us, for the legal pages. Fill the operator in before the pages
 * go live; until then the gaps show on the page. Each address must receive mail before it is shown.
 */
export const OPERATOR = {
  name: "[FILL: operator’s legal name]",
  address: "[FILL: registered address], Republic of Moldova",
};

export const PRIVACY_EMAIL = "privacy@atshero.app";
export const SUPPORT_EMAIL = "support@atshero.app";

/** The date a legal page last changed. Change it with the content, never compute it. */
export type LegalDate = { iso: string; label: string };
