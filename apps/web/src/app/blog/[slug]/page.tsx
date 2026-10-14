import { AppShell } from "@/presentation/components/app-shell";
import { BlogArticleContainer } from "@/presentation/components/blog/blog-article";

/**
 * `/blog/[slug]` — one public article (Feature #498, WU3). Public and shareable
 * by link (same top-level placement as `/blog`): no `RouteGate`, no auth. The
 * client container owns the not-found state, so an unknown slug is a rendered
 * dead end rather than a Next `notFound()`.
 */
export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <AppShell>
      <BlogArticleContainer slug={slug} />
    </AppShell>
  );
}
