"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { BlogErrorCode, BlogPort, BlogPost, BlogPostSummary } from "@/application/blog/blog-port";

/**
 * Server state of the Blog (Feature #498, WU3).
 *
 * The listing lives in SWR under `["blog-posts"]` and one article under
 * `["blog-post", slug]`; a `null` port (no backend configured) fetches nothing.
 * A failed read never invents data: the list stays empty and `post` stays
 * `null`, with the flags as the only signal. `not_configured` is kept apart
 * from a genuine failure so a screen can render the calm no-backend notice
 * (#480) instead of an error panel, and a 404 keeps its own `notFound`.
 */

/** Sanitized load failure; the code is already provider-free. */
class BlogError extends Error {
  readonly code: BlogErrorCode;

  constructor(code: BlogErrorCode) {
    super(`blog request failed: ${code}`);
    this.name = "BlogError";
    this.code = code;
  }
}

const EMPTY: readonly BlogPostSummary[] = Object.freeze([]);

async function loadList(port: BlogPort): Promise<readonly BlogPostSummary[]> {
  const result = await port.listPosts();
  if (!result.ok) throw new BlogError(result.code);
  return result.items;
}

async function loadPost(port: BlogPort, slug: string): Promise<BlogPost> {
  const result = await port.findPostBySlug(slug);
  if (!result.ok) throw new BlogError(result.code);
  return result.post;
}

export interface BlogPostsState {
  readonly items: readonly BlogPostSummary[];
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  /** `not_configured` is not a service failure; #480. */
  readonly loadErrorCode: BlogErrorCode | null;
  readonly reload: () => void;
}

export function useBlogPosts(port: BlogPort | null): BlogPostsState {
  const { data, error, isLoading, mutate } = useSWR<readonly BlogPostSummary[]>(
    port ? ["blog-posts"] : null,
    () => loadList(port as BlogPort),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  const reload = useCallback(() => {
    void mutate();
  }, [mutate]);

  const loadErrorCode: BlogErrorCode | null =
    error === undefined ? null : error instanceof BlogError ? error.code : "unavailable";

  return {
    items: data ?? EMPTY,
    isLoading,
    loadFailed: error !== undefined,
    loadErrorCode,
    reload
  };
}

export interface BlogPostState {
  readonly post: BlogPost | null;
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  readonly notFound: boolean;
  /** `not_configured` is not a service failure; #480. */
  readonly loadErrorCode: BlogErrorCode | null;
  readonly reload: () => void;
}

export function useBlogPost(slug: string, port: BlogPort | null): BlogPostState {
  const active = port !== null && slug.length > 0;
  const { data, error, isLoading, mutate } = useSWR<BlogPost>(
    active ? ["blog-post", slug] : null,
    () => loadPost(port as BlogPort, slug),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  const reload = useCallback(() => {
    void mutate();
  }, [mutate]);

  const code = error instanceof BlogError ? error.code : undefined;
  const loadErrorCode: BlogErrorCode | null = error === undefined ? null : (code ?? "unavailable");

  return {
    post: data ?? null,
    isLoading,
    loadFailed: error !== undefined && code !== "not_found",
    notFound: code === "not_found",
    loadErrorCode,
    reload
  };
}
