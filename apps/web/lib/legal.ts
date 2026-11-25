/**
 * Who runs ATS Hero and how to reach us, for the legal pages. Until a company is registered the
 * operator is Scaler himself (PL-2); when it is, both pages change to it, with their dates.
 * Each address must receive mail before it is shown.
 */
export const OPERATOR = {
  name: "Vladimir Nasalciuc",
  address: "Chișinău, Republic of Moldova",
};

export const PRIVACY_EMAIL = "privacy@atshero.app";
export const SUPPORT_EMAIL = "support@atshero.app";

/** The date a legal page last changed. Change it with the content, never compute it. */
export type LegalDate = { iso: string; label: string };
