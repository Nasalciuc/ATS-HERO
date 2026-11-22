import type { Metadata } from "next";
import BlogListPage from "@/views/BlogListPage";
import JsonLd from "@/components/JsonLd";
import { allPosts } from "@/lib/blog/posts";
import { blogJsonLd } from "@/lib/structured-data";

const DESCRIPTION =
  "How an ATS really reads your CV: what real ATSs do with a CV, where scores come from and what our lab measured, with every source linked.";

export const metadata: Metadata = {
  title: "Blog — ATS Hero",
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: { type: "website", title: "The ATS Hero blog", description: DESCRIPTION, url: "/blog" },
};

export default function Blog() {
  const posts = allPosts();
  return (
    <>
      <JsonLd data={blogJsonLd(posts)} />
      <BlogListPage posts={posts} />
    </>
  );
}
