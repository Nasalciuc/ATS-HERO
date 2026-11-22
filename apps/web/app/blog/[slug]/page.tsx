import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogPostPage from "@/views/BlogPostPage";
import { allPosts, postBySlug, relatedPosts } from "@/lib/blog/posts";
import { AUTHORS } from "@/lib/blog/authors";

type Props = { params: Promise<{ slug: string }> };

// Every post is built ahead of time; any other /blog/… is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return allPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = postBySlug((await params).slug);
  if (!post) return {};
  return {
    title: `${post.title} — ATS Hero`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [AUTHORS[post.author].name],
    },
  };
}

export default async function BlogPost({ params }: Props) {
  const post = postBySlug((await params).slug);
  if (!post) notFound();
  return <BlogPostPage post={post} related={relatedPosts(post)} />;
}
