import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Preview and development deployments on Vercel (VERCEL_ENV = preview | development) are copies of
// the site on *.vercel.app and must not be indexed. Locally VERCEL_ENV is unset, so `next dev`
// serves the production rules and they can be verified by hand.
export default function robots(): MetadataRoute.Robots {
  const indexable = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : true;
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Only what has no page to read: the API and dev-only routes. The app (/app/*) and the OAuth
      // callback stay crawlable on purpose: they carry noindex, and a crawler reads noindex only on
      // a page it may fetch. Blocked here, an /app URL that gets linked anywhere (a shared link,
      // the signed-in Navbar's "My CVs") could still be listed in Google as a bare URL with no
      // description, and its noindex would never be seen.
      disallow: ["/api/", "/dev/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
