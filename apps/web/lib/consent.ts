// Cookie consent for the public pages: where the banner may appear, what a visitor can choose, and how
// a choice maps to Google Consent Mode v2. Decided in MARKETING-CE-FACEM.md (M-1, M-5) and allowed by
// AGENTS.md rule 3 (enumerated hosts on the public pages only). The Privacy page lists the cookie below
// (AGENTS.md rule 11).
import type { CookieConsentConfig } from "vanilla-cookieconsent";
// Relative on purpose: next.config.ts imports this file (through lib/csp.ts), and it has no "@/" alias.
import { PUBLIC_ROUTES, SITE_URL } from "./site";

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

/**
 * The only script the consent can load: the GTM container. It holds the GA4 tag and the PostHog tag; the
 * PostHog tag loads posthog-js from PostHog's US cloud and sends only public-page events.
 */
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

/**
 * PostHog's US cloud, the second tag in the same GTM container: posthog-js and its config load from
 * us-assets.i.posthog.com, events go to us.i.posthog.com. Session replay, surveys and feature flags are
 * off in the tag, so no other PostHog host is needed. Same rule as Google: public pages only.
 */
export const POSTHOG_CSP_HOSTS = {
  scriptSrc: ["https://us-assets.i.posthog.com"],
  connectSrc: ["https://us.i.posthog.com", "https://us-assets.i.posthog.com"],
} as const;

/** Every host the public pages' CSP adds once the banner is on: Google's, then PostHog's. */
export const ANALYTICS_CSP_HOSTS = {
  scriptSrc: [...GOOGLE_CSP_HOSTS.scriptSrc, ...POSTHOG_CSP_HOSTS.scriptSrc],
  connectSrc: [...GOOGLE_CSP_HOSTS.connectSrc, ...POSTHOG_CSP_HOSTS.connectSrc],
} as const;

/** The custom dataLayer event for a client-side move between public pages (GA4's first page_view is automatic). */
export const VIRTUAL_PAGE_VIEW_EVENT = "virtual_page_view";

/**
 * The custom dataLayer event for a Decline after Allow, while GTM is loaded: the GTM tag "PostHog - opt out"
 * fires on it and stops posthog-js at once (Google's tags follow the Consent Mode update instead).
 */
export const ANALYTICS_CONSENT_DENIED_EVENT = "analytics_consent_denied";

/** Campaign tags: the only query parameters a page address keeps when it is sent to Google Analytics. */
export const ANALYTICS_QUERY_KEEP: readonly string[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
];

/**
 * The page address Google Analytics gets: origin and path, plus campaign tags. Any other query parameter
 * (which a link from elsewhere could fill with a name or an email address) and the #fragment are dropped.
 */
export function analyticsPageLocation(href: string): string {
  const url = new URL(href);
  const kept = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (ANALYTICS_QUERY_KEEP.includes(key)) kept.append(key, value);
  });
  const query = kept.toString();
  return url.origin + url.pathname + (query ? `?${query}` : "");
}

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
 * Google Analytics and PostHog set their cookies on the widest domain they can: on staging.atshero.app that
 * is atshero.app. The banner's library only clears the current host, so a subdomain of the site also needs
 * the site's own domain. Elsewhere (atshero.app itself, vercel.app previews, localhost) there is none.
 */
export function analyticsCookieParentDomain(
  hostname: string,
  siteHost: string = new URL(SITE_URL).hostname,
): string | undefined {
  return hostname.endsWith(`.${siteHost}`) && hostname !== `www.${siteHost}` ? siteHost : undefined;
}

/**
 * Two equal buttons, no pre-ticked box, no dark patterns (M-5), in English. The first layer says what we
 * ask for without naming a tool; the settings layer and the Privacy page name the provider (rule 11).
 * The look is in app/styles.css ("Cookie consent"), scoped to #cc-main: "cloud inline" at the bottom
 * centre is a slim bar on a computer (question left, answers right) and a compact card on a phone.
 */
export function consentConfig(
  hostname: string = typeof window === "undefined" ? "" : window.location.hostname,
): CookieConsentConfig {
  const parent = analyticsCookieParentDomain(hostname);
  const analyticsCookies = (domain?: string) => [
    { name: /^_ga/, ...(domain ? { domain } : {}) },
    { name: "_gid", ...(domain ? { domain } : {}) },
    { name: /^ph_/, ...(domain ? { domain } : {}) },
  ];
  return {
    revision: 1,
    cookie: { name: CONSENT_COOKIE, expiresAfterDays: CONSENT_DAYS, sameSite: "Lax" },
    guiOptions: {
      consentModal: { layout: "cloud inline", position: "bottom center", equalWeightButtons: true, flipButtons: false },
      preferencesModal: { layout: "box", equalWeightButtons: true, flipButtons: false },
    },
    categories: {
      [CATEGORY_NECESSARY]: { enabled: true, readOnly: true },
      [CATEGORY_ANALYTICS]: {
        enabled: false,
        // Rejecting later removes what Google Analytics set (_ga, _ga_<container> and the older _gid) and
        // PostHog's ph_<project>_posthog cookie, on this host and, on a subdomain such as staging, on the
        // site's own domain, where both put them. PostHog's browser storage goes when the GTM tag
        // "PostHog - opt out" stops posthog-js (opt_out_persistence_by_default).
        autoClear: { cookies: [...analyticsCookies(), ...(parent ? analyticsCookies(parent) : [])] },
      },
    },
    language: {
      default: "en",
      translations: {
        en: {
          consentModal: {
            // <mark> is the landing headline's green highlight (styles.css); the library renders the title as HTML.
            title: "Can we <mark>count your visit?</mark>",
            description:
              'Allow us to analyze your usage data to improve your experience. Nothing is measured unless you allow it. <a href="/privacy">Privacy page</a>',
            acceptAllBtn: "Allow",
            acceptNecessaryBtn: "Decline",
          },
          // The settings say what each choice is for and who does it; the cookie names, what they keep
          // and for how long stay on the Privacy page.
          preferencesModal: {
            title: "Privacy settings",
            acceptAllBtn: "Allow",
            acceptNecessaryBtn: "Decline",
            savePreferencesBtn: "Save my choice",
            closeIconLabel: "Close",
            sections: [
              {
                description:
                  'Change your choice at any time. The tools we use, what they store and for how long are on the <a href="/privacy">Privacy page</a>.',
              },
              // The purpose sits inside the title (styles.css, .cc-purpose), so it shows without opening
              // anything: a section with a description becomes a fold-out. The library names each switch
              // with the title's own words only ("Essential", "Usage analysis").
              {
                title: 'Essential<span class="cc-purpose">Always on. Sign-in and remembering this choice.</span>',
                linkedCategory: CATEGORY_NECESSARY,
              },
              {
                title:
                  'Usage analysis<span class="cc-purpose">Shows us which pages people use, so we can improve the site. Done with Google Analytics and PostHog, on the public pages only, never inside the app.</span>',
                linkedCategory: CATEGORY_ANALYTICS,
              },
            ],
          },
        },
      },
    },
  };
}
