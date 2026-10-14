"use client";

import Link from "next/link";
import { useState } from "react";
import { IoInformationCircleOutline, IoNewspaperOutline } from "react-icons/io5";
import type { BlogPostSummary, BlogPort } from "@/application/blog/blog-port";
import { BLOG_COPY } from "@/application/blog/copy";
import { formatPublishedDate } from "@/application/blog/format";
import { createBrowserBlogPort } from "@/infrastructure/blog/create-blog-port";
import { useBlogPosts } from "@/state/use-blog";
import { BackendNotice } from "../backend-notice";
import { EmptyState } from "../empty-state";
import { ErrorState } from "../error-state";
import { Skeleton } from "../skeleton";

/**
 * `/blog` — the public Blog listing (Feature #498, WU3). It follows the guide
 * layout (D5): the eyebrow pill, the split-free `<h1>` hero with its dashed
 * note, then the reading column. The controller is pure (it takes its port as a
 * prop) so tests never touch the network; the container injects the browser one.
 * With no backend configured it renders the calm `BackendNotice` — never an
 * empty list.
 */

const { list } = BLOG_COPY;

const CARD_CLASS =
  "group flex w-full flex-col gap-3 rounded-card border border-border bg-raised p-6 no-underline transition-colors hover:border-control";

function BlogHero() {
  return (
    <section
      aria-labelledby={list.headingId}
      className="grid items-end gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-x-16"
    >
      <div className="flex flex-col gap-3.5">
        <span className="inline-flex w-fit items-center rounded-pill bg-brand-accent-tint px-2.5 py-1 text-xs font-semibold text-brand-accent-text">
          {list.eyebrow}
        </span>
        <h1
          id={list.headingId}
          className="m-0 text-[clamp(40px,5vw,56px)] leading-[1.05] font-bold tracking-[-0.035em] text-balance"
        >
          {list.title}
        </h1>
        <p className="m-0 max-w-[68ch] text-[17px] leading-[1.6] text-pretty text-text-secondary">
          {list.subtitle}
        </p>
      </div>

      <div className="flex gap-3 rounded-card border border-dashed border-control p-4">
        <IoInformationCircleOutline aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-[20px]" />
        <p className="m-0 text-sm leading-[1.55] text-pretty">{list.note}</p>
      </div>
    </section>
  );
}

function BlogCard({ item }: { readonly item: BlogPostSummary }) {
  return (
    <Link href={`/blog/${item.slug}`} className={CARD_CLASS}>
      <span className="text-[13px] font-semibold text-brand-accent-text">
        {list.publishedLabel}{" "}
        <time dateTime={item.publishedAt} className="font-normal text-text-secondary">
          {formatPublishedDate(item.publishedAt)}
        </time>
      </span>
      <h2 className="m-0 text-[20px] leading-[1.3] font-bold text-text-primary group-hover:text-brand-accent-text">
        {item.title}
      </h2>
      <p className="m-0 text-sm leading-[1.55] text-text-secondary">{item.summary}</p>
    </Link>
  );
}

export function BlogList({ port }: { readonly port: BlogPort | null }) {
  const state = useBlogPosts(port);

  return (
    <div className="flex flex-col gap-10 pt-4 pb-16">
      <BlogHero />

      {state.isLoading ? (
        <Skeleton shapes={["card", "line", "line"]} label={list.loading} />
      ) : state.loadErrorCode === "not_configured" ? (
        <BackendNotice />
      ) : state.loadFailed ? (
        <ErrorState
          title={list.errorTitle}
          message={list.errorMessage}
          onRetry={state.reload}
          retryLabel={list.retry}
        />
      ) : state.items.length === 0 ? (
        <EmptyState title={list.emptyTitle} body={list.emptyBody} icon={IoNewspaperOutline} />
      ) : (
        <ul aria-label="Artículos publicados" className="m-0 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {state.items.map((item) => (
            <li key={item.slug} className="flex">
              <BlogCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Browser-wired entry point: the public `/blog` route mounts this. */
export function BlogListContainer() {
  const [port] = useState(() => createBrowserBlogPort());
  return <BlogList port={port} />;
}
