// JSON-LD for the landing page: who we are (Organization), the site (WebSite), what the product is
// (WebApplication) and the FAQ (FAQPage); and for the blog: the Blog on /blog, a BlogPosting and its
// breadcrumbs on each post. Search engines and AI search use it to understand the page;
// it earns no rich result on its own. Everything here must match what the page shows and what the
// Terms say (AGENTS.md rule 10): no ratings or reviews, no price other than the one in the Terms.
import { SITE_URL } from "@/lib/site";
import { FAQS, faqAnswerText } from "@/lib/faq";
import { AUTHORS } from "@/lib/blog/authors";
import type { Post } from "@/lib/blog/schema";

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
        // The three tools as they work today. components/Tool.tsx keeps the Figma copy until the
        // landing frame is updated (rule 6; ATS-REAL-VS-NOI.md §6 in the App Builder project).
        featureList: [
          "Guided CV builder with PDF and DOCX export",
          "What an ATS parser reads from your CV, field by field, with the problems to fix",
          "Job Fit: each requirement of a job post, met or not, and where your CV shows it",
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

const ORGANIZATION = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: "ATS Hero",
  url: HOME,
  logo: `${SITE_URL}/apple-icon.png`,
};

/** /blog: the blog and its posts, newest first, the way the page lists them. */
export function blogJsonLd(posts: Post[]): JsonLd {
  const url = `${SITE_URL}/blog`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${url}#blog`,
        name: "The ATS Hero blog",
        url,
        inLanguage: "en",
        publisher: { "@id": ORGANIZATION_ID },
        blogPost: posts.map((post) => ({
          "@type": "BlogPosting",
          headline: post.title,
          url: `${url}/${post.slug}`,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
        })),
      },
      ORGANIZATION,
    ],
  };
}

/**
 * A post: who wrote it and when (the dates its page shows), what it cites (its Sources list) and
 * where it sits (Home › Blog › the post). The author is a Person with the role the byline shows.
 */
export function blogPostJsonLd(post: Post): JsonLd {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const author = AUTHORS[post.author];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.description,
        url,
        mainEntityOfPage: url,
        inLanguage: "en",
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        author: { "@type": "Person", name: author.name, jobTitle: author.role },
        publisher: { "@id": ORGANIZATION_ID },
        isPartOf: { "@id": `${SITE_URL}/blog#blog` },
        citation: post.sources.map((source) => source.url),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "ATS Hero", item: HOME },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
      ORGANIZATION,
    ],
  };
}

/** JSON for a <script type="application/ld+json">: "<" is escaped so no string can close the tag. */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
