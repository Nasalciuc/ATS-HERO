import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, SITE_URL, type PublicRoute } from "@/lib/site";
import { PRIVACY_UPDATED } from "@/views/PrivacyPage";
import { TERMS_UPDATED } from "@/views/TermsPage";

// lastModified only where a page owns a real "updated" date (AGENTS.md rule 11: changed with the
// content, never computed). No priority / changeFrequency: Google ignores them, and a wrong value
// is worse than none.
const LAST_MODIFIED: Partial<Record<PublicRoute, string>> = {
  "/privacy": PRIVACY_UPDATED.iso,
  "/terms": TERMS_UPDATED.iso,
};

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => {
    const iso = LAST_MODIFIED[route];
    return {
      url: `${SITE_URL}${route}`,
      ...(iso ? { lastModified: new Date(`${iso}T00:00:00Z`) } : {}),
    };
  });
}
