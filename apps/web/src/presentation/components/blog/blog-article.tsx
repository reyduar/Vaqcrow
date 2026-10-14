"use client";

import Link from "next/link";
import { useState } from "react";
import type { BlogPort } from "@/application/blog/blog-port";
import { BLOG_COPY } from "@/application/blog/copy";
import { formatPublishedDate } from "@/application/blog/format";
import { createBrowserBlogPort } from "@/infrastructure/blog/create-blog-port";
import { useBlogPost } from "@/state/use-blog";
import { BackendNotice } from "../backend-notice";
import { ErrorState } from "../error-state";
import { Skeleton } from "../skeleton";
import { MarkdownBody } from "./markdown-body";

/**
 * `/blog/[slug]` — one public article (Feature #498, WU3). It follows the guide
 * layout (D5): the eyebrow pill, the `<h1>` title, the publication date and the
 * Markdown body rendered through `MarkdownBody`. D6: the only visible metadata
 * is the publication date — there is no author byline. An unknown or
 * unpublished slug renders an in-component not-found state (not `notFound()`),
 * like the campaign detail; with no backend configured it renders the calm
 * `BackendNotice`.
 */

const { article } = BLOG_COPY;

/** An unknown or unpublished article: a clear dead end with a way back. */
export function BlogArticleNotFound() {
  return (
    <div className="mx-auto mt-8 flex w-full max-w-[560px] flex-col items-center gap-4 rounded-card border border-border px-8 py-12 text-center">
      <h1 className="m-0 text-[30px] leading-tight font-bold tracking-[-0.02em]">{article.notFoundTitle}</h1>
      <p className="m-0 max-w-[44ch] text-base text-pretty text-text-secondary">{article.notFoundBody}</p>
      <Link
        href="/blog"
        className="inline-flex h-12 items-center rounded-control border border-control px-[18px] text-[15px] font-semibold text-text-primary hover:bg-page-surface"
      >
        {article.notFoundCta}
      </Link>
    </div>
  );
}

export function BlogArticle({ slug, port }: { readonly slug: string; readonly port: BlogPort | null }) {
  const state = useBlogPost(slug, port);

  if (state.isLoading) return <Skeleton shapes={["line", "card", "line"]} label={article.loading} />;
  if (state.notFound) return <BlogArticleNotFound />;
  if (state.loadErrorCode === "not_configured") return <BackendNotice />;
  if (state.loadFailed) {
    return (
      <ErrorState
        title={article.errorTitle}
        message={article.errorMessage}
        onRetry={state.reload}
        retryLabel={article.retry}
      />
    );
  }
  if (state.post === null) return <BackendNotice />;

  const post = state.post;

  return (
    <article className="flex flex-col gap-8 pt-4 pb-16">
      <header className="flex flex-col gap-4">
        <span className="inline-flex w-fit items-center rounded-pill bg-brand-accent-tint px-2.5 py-1 text-xs font-semibold text-brand-accent-text">
          {article.eyebrow}
        </span>
        <h1 className="m-0 text-[clamp(34px,4.4vw,48px)] leading-[1.08] font-bold tracking-[-0.03em] text-balance">
          {post.title}
        </h1>
        <p className="m-0 max-w-[68ch] text-[18px] leading-[1.55] text-pretty text-text-secondary">{post.summary}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[13px] text-text-secondary">
            {article.publishedLabel}{" "}
            <time dateTime={post.publishedAt}>{formatPublishedDate(post.publishedAt)}</time>
          </span>
          {post.tags.length > 0 ? (
            <ul aria-label={article.tagsLabel} className="m-0 flex list-none flex-wrap gap-2 p-0">
              {post.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-pill bg-page-surface px-2.5 py-1 text-xs font-semibold text-text-secondary"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <MarkdownBody markdown={post.body} />

      <footer>
        <Link
          href="/blog"
          className="inline-flex h-12 items-center rounded-control border border-control px-[18px] text-[15px] font-semibold text-text-primary hover:bg-page-surface"
        >
          {article.backToList}
        </Link>
      </footer>
    </article>
  );
}

/** Browser-wired entry point: the public `/blog/[slug]` route mounts this. */
export function BlogArticleContainer({ slug }: { readonly slug: string }) {
  const [port] = useState(() => createBrowserBlogPort());
  return <BlogArticle slug={slug} port={port} />;
}
