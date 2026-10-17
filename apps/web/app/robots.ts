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
      // "/app/" + "/app$", never a bare "/app": that would also match /apple-icon.png.
      disallow: ["/app/", "/app$", "/api/", "/sso-callback", "/dev/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
