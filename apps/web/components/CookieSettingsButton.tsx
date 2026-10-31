"use client";
import { consentEnabled } from "@/lib/consent";
import { openCookieSettings } from "@/components/ConsentBanner";

/**
 * "Change your choice" on the Privacy page: reopens the cookie settings after Allow or Decline. Renders
 * nothing while the banner is off (lib/consent.ts), so the page reads exactly as before until then.
 * A footer link would be the usual place too, but the footer comes from Figma (AGENTS.md rules 6 and 8).
 */
export default function CookieSettingsButton() {
  if (!consentEnabled()) return null;
  return (
    <p>
      You can change your choice at any time:{" "}
      <button type="button" className="legal-inline-button" onClick={() => void openCookieSettings()}>
        Cookie settings
      </button>
      .
    </p>
  );
}
