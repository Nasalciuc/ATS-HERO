// The site's security headers, built in one place so next.config.ts stays small and tests can check
// them. The Content-Security-Policy is the same everywhere except that, once the cookie banner is on
// (lib/consent.ts), the public pages also allow the Google Tag Manager and Google Analytics hosts.
// /app, /api and /dev never get them (AGENTS.md rule 3).
// Relative imports on purpose: next.config.ts imports this file and has no "@/" alias.
import { GOOGLE_CSP_HOSTS, consentEnabled } from "./consent";
import { PUBLIC_ROUTES } from "./site";

type Header = { key: string; value: string };
export type HeaderRule = { source: string; headers: Header[] };

export function buildCsp({ google = false }: { google?: boolean } = {}): string {
  // React's dev build needs eval() for debugging features. Production stays strict —
  // never widen this branch to cover prod.
  const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const gScript = google ? " " + GOOGLE_CSP_HOSTS.scriptSrc.join(" ") : "";
  const gConnect = google ? " " + GOOGLE_CSP_HOSTS.connectSrc.join(" ") : "";
  return [
    "default-src 'self'",
    // TODO(security-hardening): replace 'unsafe-inline' in script-src with nonce-based CSP.
    // Needs: nonce generated in proxy.ts, forwarded via header, read in layout.tsx, passed to
    // ClerkProvider's nonce prop. Tracked as a post-launch hardening item, not a launch blocker.
    // 'wasm-unsafe-eval' is REQUIRED for PDF export + preview: @react-pdf/renderer lays out
    // pages with yoga-layout 3, which is WebAssembly-only (no asm.js fallback). Without it the
    // browser refuses WebAssembly.instantiate() and "Download PDF" fails in production.
    // It permits compiling WASM only — eval()/new Function() stay blocked.
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${devEval} https://*.clerk.accounts.dev https://challenges.cloudflare.com${gScript}`,
    // No clerk-telemetry.com: Clerk's telemetry is off (app/layout.tsx), and the privacy page says no analytics.
    "connect-src 'self' https://*.clerk.accounts.dev " + (process.env.NEXT_PUBLIC_AI_URL ?? "") + gConnect,
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    // blob: — only CvTemplatePreview (PDFViewer: the PDF in an iframe with a blob: src) needs
    // it, and nothing renders that component since the Complete pop-up draws pages with PDF.js
    // on a canvas. Drop blob: here when CvTemplatePreview is deleted.
    "frame-src 'self' blob: https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
  ].join("; ");
}

/**
 * Every path gets the base headers; when the banner is on, each public page gets a second rule with the
 * Google hosts. Next.js lets the later rule's Content-Security-Policy win for the paths it matches, and the
 * public paths are exact ("/" matches only the home page), so nothing under /app is ever matched.
 */
export function securityHeaders({ consent = consentEnabled() }: { consent?: boolean } = {}): HeaderRule[] {
  const rules: HeaderRule[] = [
    {
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: buildCsp() },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ];
  if (consent) {
    const csp = buildCsp({ google: true });
    for (const route of PUBLIC_ROUTES) rules.push({ source: route, headers: [{ key: "Content-Security-Policy", value: csp }] });
  }
  return rules;
}
