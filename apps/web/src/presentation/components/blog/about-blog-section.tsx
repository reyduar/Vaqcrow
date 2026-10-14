"use client";

import Link from "next/link";
import { useState } from "react";
import { IoArrowForwardOutline, IoNewspaperOutline } from "react-icons/io5";
import { ABOUT_COPY } from "@/application/about/copy";
import type { BlogPostSummary, BlogPort } from "@/application/blog/blog-port";
import { formatPublishedDate } from "@/application/blog/format";
import { createBrowserBlogPort } from "@/infrastructure/blog/create-blog-port";
import { useBlogPosts } from "@/state/use-blog";
import { BackendNotice } from "../backend-notice";
import { EmptyState } from "../empty-state";
import { ErrorState } from "../error-state";
import { Skeleton } from "../skeleton";

/**
 * The «Blog» section of `/about` (Feature #498, WU3; owner decision D4 — the
 * Blog is linked only here, never from the header or footer). It slots into
 * `AboutContent`'s `gap-24` stack and lists the published articles (title,
 * summary, date) linking to each `/blog/<slug>`, plus a «Ver todos los
 * artículos» link to `/blog`. With no backend configured it renders the calm
 * `BackendNotice`, never an invented list.
 */

const { blog } = ABOUT_COPY;

const ROW_CLASS =
  "group flex w-full flex-col gap-2 rounded-card border border-border bg-raised p-5 no-underline transition-colors hover:border-control";

function BlogRow({ item }: { readonly item: BlogPostSummary }) {
  return (
    <Link href={`/blog/${item.slug}`} className={ROW_CLASS}>
      <span className="text-[13px] font-semibold text-brand-accent-text">
        {blog.publishedLabel}{" "}
        <time dateTime={item.publishedAt} className="font-normal text-text-secondary">
          {formatPublishedDate(item.publishedAt)}
        </time>
      </span>
      <h3 className="m-0 text-[18px] leading-[1.3] font-bold text-text-primary group-hover:text-brand-accent-text">
        {item.title}
      </h3>
      <p className="m-0 text-sm leading-[1.55] text-text-secondary">{item.summary}</p>
    </Link>
  );
}

export function AboutBlogSection({ port }: { readonly port: BlogPort | null }) {
  const state = useBlogPosts(port);

  return (
    <section aria-labelledby={blog.headingId} className="flex flex-col gap-8">
      <div className="flex max-w-[720px] flex-col gap-3">
        <span className="text-[13px] font-semibold text-brand-accent-text">{blog.eyebrow}</span>
        <h2
          id={blog.headingId}
          className="m-0 text-[clamp(30px,3.4vw,40px)] leading-[1.15] font-bold tracking-[-0.025em]"
        >
          {blog.title}
        </h2>
        <p className="m-0 text-[18px] leading-[1.55] text-text-secondary">{blog.intro}</p>
      </div>

      {state.isLoading ? (
        <Skeleton shapes={["card", "line"]} label={blog.loading} />
      ) : state.loadErrorCode === "not_configured" ? (
        <BackendNotice />
      ) : state.loadFailed ? (
        <ErrorState
          title={blog.errorTitle}
          message={blog.errorMessage}
          onRetry={state.reload}
          retryLabel={blog.retry}
        />
      ) : state.items.length === 0 ? (
        <EmptyState title={blog.emptyTitle} body={blog.emptyBody} icon={IoNewspaperOutline} />
      ) : (
        <ul aria-label="Artículos publicados" className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
          {state.items.map((item) => (
            <li key={item.slug} className="flex">
              <BlogRow item={item} />
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/blog"
        className="inline-flex w-fit items-center gap-2 text-[15px] font-semibold text-brand-accent-text no-underline hover:underline"
      >
        {blog.seeAll}
        <IoArrowForwardOutline aria-hidden="true" focusable="false" className="text-[17px]" />
      </Link>
    </section>
  );
}

/** Browser-wired entry point mounted by `AboutContent`. */
export function AboutBlogContainer() {
  const [port] = useState(() => createBrowserBlogPort());
  return <AboutBlogSection port={port} />;
}
