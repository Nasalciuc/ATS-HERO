import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, SITE_URL, type PublicRoute } from "@/lib/site";
import { allPosts } from "@/lib/blog/posts";
import { PRIVACY_UPDATED } from "@/views/PrivacyPage";
import { TERMS_UPDATED } from "@/views/TermsPage";

// lastModified only where a page owns a real "updated" date (AGENTS.md rule 11: changed with the
// content, never computed). No priority / changeFrequency: Google ignores them, and a wrong value
// is worse than none. Each blog post is listed with its own updatedAt; /blog changes when a post
// does, so it takes the newest one.
export default function sitemap(): MetadataRoute.Sitemap {
  const posts = allPosts();
  const newestPost = posts.map((p) => p.updatedAt).sort().at(-1);
  const LAST_MODIFIED: Partial<Record<PublicRoute, string>> = {
    "/privacy": PRIVACY_UPDATED.iso,
    "/terms": TERMS_UPDATED.iso,
    ...(newestPost ? { "/blog": newestPost } : {}),
  };
  const dated = (iso?: string) => (iso ? { lastModified: new Date(`${iso}T00:00:00Z`) } : {});

  return [
    ...PUBLIC_ROUTES.map((route) => ({ url: `${SITE_URL}${route}`, ...dated(LAST_MODIFIED[route]) })),
    ...posts.map((post) => ({ url: `${SITE_URL}/blog/${post.slug}`, ...dated(post.updatedAt) })),
  ];
}
