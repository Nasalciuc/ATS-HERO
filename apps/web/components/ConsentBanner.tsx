"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import * as CookieConsent from "vanilla-cookieconsent";
import "vanilla-cookieconsent/dist/cookieconsent.css";
import {
  CONSENT_MODE_DENIED,
  VIRTUAL_PAGE_VIEW_EVENT,
  consentConfig,
  consentEnabled,
  consentModeFor,
  gtmContainerId,
  gtmScriptUrl,
  isConsentRoute,
  type ConsentModeState,
} from "@/lib/consent";

// Mounted once in Providers. It shows the cookie banner on the public pages only (lib/consent.ts) and
// hides it when the visitor moves into /app. The library keeps the choice in the cc_cookie cookie and
// hides the banner from crawlers and automated browsers by itself.
//
// Google Tag Manager (which holds the GA4 tag) loads only after the visitor allows analytics ("basic"
// Consent Mode: nothing from Google before the choice), and only on a public page. Once it is loaded it
// cannot be unloaded, so moving into /app reloads the page: /app starts clean, without it (AGENTS.md rule 3).

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

// One start for the whole page life, shared by the banner and the "Cookie settings" button, so a click
// that comes while the library is still starting waits for it instead of starting it twice.
let ready: Promise<void> | null = null;
let gtmLoaded = false;
// The CSP comes with the document, so it is the one of the page the visitor first loaded. If that was
// /app (no Google hosts) and they then moved to a public page client-side, Google Tag Manager would be
// blocked: in that case loading it means reloading the public page first, to get the public-page CSP.
const documentStartedPublic = typeof window !== "undefined" && isConsentRoute(window.location.pathname);
let lastPagePath: string | null = null;

// The Google tag reads gtag() commands as Arguments objects, so this pushes `arguments`, not an array.
function gtag(..._args: unknown[]): void {
  // eslint-disable-next-line prefer-rest-params
  (window.dataLayer ??= []).push(arguments);
}

function loadGtm(mode: ConsentModeState): void {
  const id = gtmContainerId();
  if (!id || gtmLoaded) return;
  gtmLoaded = true;
  lastPagePath = window.location.pathname;
  gtag("consent", "default", CONSENT_MODE_DENIED);
  gtag("consent", "update", mode);
  window.dataLayer!.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = gtmScriptUrl(id);
  document.head.appendChild(script);
}

/** Runs on every page load with a valid choice and whenever the choice changes. */
function applyConsent(): void {
  if (!isConsentRoute(window.location.pathname)) return;
  const mode = consentModeFor(CookieConsent.getUserPreferences().acceptedCategories);
  if (gtmLoaded) {
    // A later Decline: Google stops storing anything, and the library deletes the _ga cookies (autoClear).
    gtag("consent", "update", mode);
  } else if (mode.analytics_storage === "granted") {
    if (documentStartedPublic) loadGtm(mode);
    else window.location.reload();
  }
}

function start(): Promise<void> {
  ready ??= CookieConsent.run({ ...consentConfig(), onConsent: applyConsent, onChange: applyConsent });
  return ready;
}

/**
 * Opens the settings window, so a visitor can change an earlier choice. It calls the library directly
 * rather than relying on a data-cc attribute, which the library only binds to elements that exist when
 * it starts (a button reached by client-side navigation would never work).
 */
export async function openCookieSettings(): Promise<void> {
  if (!consentEnabled() || !isConsentRoute(window.location.pathname)) return;
  await start();
  CookieConsent.showPreferences();
}

export default function ConsentBanner() {
  const pathname = usePathname();
  const onPublicPage = isConsentRoute(pathname ?? "");

  useEffect(() => {
    if (!consentEnabled()) return;
    if (!onPublicPage) {
      // Google Tag Manager cannot be unloaded: a full reload brings /app up without it.
      if (gtmLoaded) {
        window.location.reload();
        return;
      }
      if (ready) CookieConsent.hide();
      return;
    }
    if (!ready) {
      void start();
    } else if (!CookieConsent.validConsent()) {
      CookieConsent.show();
    }
  }, [onPublicPage]);

  // A client-side move between public pages: GA4 counts the first page by itself, the rest come from here
  // (GA4's own history-based page views are off, so a move into /app is never reported).
  useEffect(() => {
    if (!gtmLoaded || !onPublicPage || !pathname || pathname === lastPagePath) return;
    lastPagePath = pathname;
    window.dataLayer?.push({
      event: VIRTUAL_PAGE_VIEW_EVENT,
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, onPublicPage]);

  return null;
}
