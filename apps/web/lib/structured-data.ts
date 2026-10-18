// JSON-LD for the landing page: who we are (Organization), the site (WebSite), what the product is
// (WebApplication) and the FAQ (FAQPage). Search engines and AI search use it to understand the page;
// it earns no rich result on its own. Everything here must match what the page shows and what the
// Terms say (AGENTS.md rule 10): no ratings or reviews, no price other than the one in the Terms.
import { SITE_URL } from "@/lib/site";
import { FAQS, faqAnswerText } from "@/lib/faq";

export type JsonLd = { "@context": "https://schema.org"; "@graph": Record<string, unknown>[] };

const HOME = `${SITE_URL}/`;
export const ORGANIZATION_ID = `${HOME}#organization`;
export const WEBSITE_ID = `${HOME}#website`;

/**
 * Free while ATS Hero is in beta (TermsPage: "ATS Hero is free while it is in beta"). When a price is
 * published, change this together with the Terms; tests/structured-data.test.ts checks both.
 */
export const OFFER_PRICE = "0";

export function homeJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "ATS Hero",
        url: HOME,
        logo: `${SITE_URL}/apple-icon.png`,
        // sameAs: add profile URLs (LinkedIn page, GitHub, Product Hunt) once they exist and are ours.
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: "ATS Hero",
        url: HOME,
        inLanguage: "en",
        publisher: { "@id": ORGANIZATION_ID },
      },
      {
        "@type": "WebApplication",
        "@id": `${HOME}#app`,
        name: "ATS Hero",
        url: HOME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web browser",
        isAccessibleForFree: OFFER_PRICE === "0",
        offers: { "@type": "Offer", price: OFFER_PRICE, priceCurrency: "USD" },
        // The three tools as the landing page describes them (components/Tool.tsx).
        featureList: [
          "Guided CV builder with PDF and DOCX export",
          "ATS score per section with the critical mistakes to fix",
          "Job match score with the keywords the posting expects",
        ],
        publisher: { "@id": ORGANIZATION_ID },
      },
      {
        "@type": "FAQPage",
        "@id": `${HOME}#faq`,
        mainEntity: FAQS.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: faqAnswerText(item) },
        })),
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json">: "<" is escaped so no string can close the tag. */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
