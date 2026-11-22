import type { Metadata } from "next";
import BlogListPage from "@/views/BlogListPage";
import { allPosts } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Blog — ATS Hero",
  description:
    "How an ATS really reads your CV: what real ATSs do with a CV, where scores come from and what our lab measured, with every source linked.",
  alternates: { canonical: "/blog" },
};

export default function Blog() {
  return <BlogListPage posts={allPosts()} />;
}
