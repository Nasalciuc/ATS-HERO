"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import * as CookieConsent from "vanilla-cookieconsent";
import "vanilla-cookieconsent/dist/cookieconsent.css";
import { consentConfig, consentEnabled, isConsentRoute } from "@/lib/consent";

// Mounted once in Providers. It shows the cookie banner on the public pages only (lib/consent.ts) and
// hides it when the visitor moves into /app. The library keeps the choice in the cc_cookie cookie and
// hides the banner from crawlers and automated browsers by itself.

// One start for the whole page life, shared by the banner and the "Cookie settings" button, so a click
// that comes while the library is still starting waits for it instead of starting it twice.
let ready: Promise<void> | null = null;
function start(): Promise<void> {
  ready ??= CookieConsent.run(consentConfig());
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
      if (ready) CookieConsent.hide();
      return;
    }
    if (!ready) {
      void start();
    } else if (!CookieConsent.validConsent()) {
      CookieConsent.show();
    }
  }, [onPublicPage]);

  return null;
}
