// Cookie consent for the public pages: where the banner may appear, what a visitor can choose, and how
// a choice maps to Google Consent Mode v2. Decided in MARKETING-CE-FACEM.md (M-1, M-5) and allowed by
// AGENTS.md rule 3 (enumerated hosts on the public pages only). The Privacy page lists the cookie below
// (AGENTS.md rule 11).
import type { CookieConsentConfig } from "vanilla-cookieconsent";
// Relative on purpose: next.config.ts imports this file (through lib/csp.ts), and it has no "@/" alias.
import { PUBLIC_ROUTES } from "./site";

/** The visitor's choice, kept by the library in a first-party cookie (name and lifetime are its defaults, spelled out). */
export const CONSENT_COOKIE = "cc_cookie";
export const CONSENT_DAYS = 182;

export const CATEGORY_NECESSARY = "necessary";
export const CATEGORY_ANALYTICS = "analytics";

/**
 * AGENTS.md rule 11, enforced in code: the banner sets cc_cookie, and after Allow Google Analytics sets
 * the _ga cookies, so the Privacy page has to list both before any visitor can see the banner. Set this
 * to true in the same commit that adds those rows to views/PrivacyPage.tsx; tests/consent.test.ts fails
 * while the flag and the page disagree. Until then, setting NEXT_PUBLIC_GTM_ID alone changes nothing.
 */
export const PRIVACY_LISTS_CONSENT: boolean = true;

/**
 * On only when a Google Tag Manager container is configured (without one there is nothing to ask consent
 * for) and the Privacy page already lists the cookies (PRIVACY_LISTS_CONSENT). Otherwise: no banner, no
 * cookie, no settings button.
 */
export function consentEnabled(
  gtmId: string | undefined = process.env.NEXT_PUBLIC_GTM_ID,
  privacyReady: boolean = PRIVACY_LISTS_CONSENT,
): boolean {
  return privacyReady && gtmContainerId(gtmId) !== null;
}

/** A Google Tag Manager container ID, like GTM-XXXXXXX. Anything else is ignored, never put in a URL. */
export const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;

export function gtmContainerId(raw: string | undefined = process.env.NEXT_PUBLIC_GTM_ID): string | null {
  const id = (raw ?? "").trim();
  return GTM_ID_PATTERN.test(id) ? id : null;
}

/** The only script the consent can load: the GTM container, which holds the GA4 tag. */
export const GTM_HOST = "https://www.googletagmanager.com";
export function gtmScriptUrl(id: string): string {
  return `${GTM_HOST}/gtm.js?id=${encodeURIComponent(id)}`;
}

/**
 * The hosts the public pages' CSP allows once the banner is on (AGENTS.md rule 3: enumerated, never a
 * wildcard, public pages only). GA4 sends hits to www/region1 google-analytics.com and to
 * (region1.)analytics.google.com; GTM loads from www.googletagmanager.com. Google Signals and ads stay
 * off, so no doubleclick or google.com hosts are needed. img-src already allows https:.
 */
export const GOOGLE_CSP_HOSTS = {
  scriptSrc: [GTM_HOST],
  connectSrc: [
    GTM_HOST,
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://analytics.google.com",
    "https://region1.analytics.google.com",
  ],
} as const;

/** The custom dataLayer event for a client-side move between public pages (GA4's first page_view is automatic). */
export const VIRTUAL_PAGE_VIEW_EVENT = "virtual_page_view";

/** The banner shows on the public pages (the sitemap's list) and nowhere else: never in /app, /api or /dev. */
export function isConsentRoute(pathname: string): boolean {
  return (PUBLIC_ROUTES as readonly string[]).includes(pathname);
}

export type ConsentValue = "granted" | "denied";
export type ConsentModeState = {
  ad_storage: ConsentValue;
  analytics_storage: ConsentValue;
  ad_user_data: ConsentValue;
  ad_personalization: ConsentValue;
};

/** The state before the visitor chooses, and after "Reject": everything denied. */
export const CONSENT_MODE_DENIED: ConsentModeState = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

/**
 * Accepted categories → the four Consent Mode v2 keys. The site runs no ads, so the three ad keys stay
 * denied whatever is accepted; only analytics can be granted.
 */
export function consentModeFor(accepted: readonly string[]): ConsentModeState {
  return {
    ...CONSENT_MODE_DENIED,
    analytics_storage: accepted.includes(CATEGORY_ANALYTICS) ? "granted" : "denied",
  };
}

/**
 * Two equal buttons, no pre-ticked box, no dark patterns (M-5), in English. The first layer says what we
 * ask for without naming a tool; the settings layer and the Privacy page name the provider (rule 11).
 * The look is in app/styles.css ("Cookie consent"), scoped to #cc-main.
 */
export function consentConfig(): CookieConsentConfig {
  return {
    revision: 1,
    cookie: { name: CONSENT_COOKIE, expiresAfterDays: CONSENT_DAYS, sameSite: "Lax" },
    guiOptions: {
      consentModal: { layout: "box", position: "bottom left", equalWeightButtons: true, flipButtons: false },
      preferencesModal: { layout: "box", equalWeightButtons: true, flipButtons: false },
    },
    categories: {
      [CATEGORY_NECESSARY]: { enabled: true, readOnly: true },
      [CATEGORY_ANALYTICS]: {
        enabled: false,
        // Rejecting later removes what Google Analytics set: _ga, _ga_<container> and the older _gid.
        autoClear: { cookies: [{ name: /^_ga/ }, { name: "_gid" }] },
      },
    },
    language: {
      default: "en",
      translations: {
        en: {
          consentModal: {
            title: "Help us improve your experience",
            description:
              'Allow us to analyze your usage data to improve your experience. Nothing is measured unless you allow it. <a href="/privacy">Privacy page</a>',
            acceptAllBtn: "Allow",
            acceptNecessaryBtn: "Decline",
          },
          preferencesModal: {
            title: "Cookie settings",
            acceptAllBtn: "Allow",
            acceptNecessaryBtn: "Decline",
            savePreferencesBtn: "Save my choice",
            closeIconLabel: "Close",
            sections: [
              {
                title: "You decide",
                description:
                  'Change it at any time. What we store and for how long is on the <a href="/privacy">Privacy page</a>.',
              },
              {
                title: "Strictly necessary",
                description: "Needed for sign-in and to remember this choice. Always on.",
                linkedCategory: CATEGORY_NECESSARY,
              },
              {
                title: "Usage analysis",
                description:
                  "Helps us see which pages are used so we can improve the site. Done with Google Analytics, which sets the _ga cookies. Off unless you allow it, and never runs inside the app.",
                linkedCategory: CATEGORY_ANALYTICS,
              },
            ],
          },
        },
      },
    },
  };
}
