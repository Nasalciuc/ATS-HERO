"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import * as CookieConsent from "vanilla-cookieconsent";
import "vanilla-cookieconsent/dist/cookieconsent.css";
import { consentConfig, consentEnabled, isConsentRoute } from "@/lib/consent";

// Mounted once in Providers. It shows the cookie banner on the public pages only (lib/consent.ts) and
// hides it when the visitor moves into /app. The library keeps the choice in the cc_cookie cookie and
// hides the banner from crawlers and automated browsers by itself.
let started = false;

export default function ConsentBanner() {
  const pathname = usePathname();
  const onPublicPage = isConsentRoute(pathname ?? "");

  useEffect(() => {
    if (!consentEnabled()) return;
    if (!onPublicPage) {
      if (started) CookieConsent.hide();
      return;
    }
    if (!started) {
      started = true;
      void CookieConsent.run(consentConfig());
    } else if (!CookieConsent.validConsent()) {
      CookieConsent.show();
    }
  }, [onPublicPage]);

  return null;
}
