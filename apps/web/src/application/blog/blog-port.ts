import type { BlogPost, BlogPostSummary } from "@vaqcrow/contracts";

/**
 * The public blog capability (Feature #498, WU3). Vendor-free and React-free:
 * the HTTP adapter lives in `infrastructure/blog/`.
 *
 * It mirrors `GET /blog` and `GET /blog/:slug` — two public reads: the
 * newest-first listing and one full article. The wire shapes are already what
 * the pages render (there is no API-relative field to resolve, unlike the
 * marketplace/detail gateways), so the contract types are reused directly
 * instead of re-declared, which keeps the port from drifting from the API.
 *
 * The article `body` is Markdown and the front matter was already stripped by
 * the API. It is untrusted content: it is parsed and rendered, never executed.
 */
export type { BlogPost, BlogPostSummary };

/**
 * Sanitized failure codes: the API's `unavailable`, the transport's `network`,
 * a missing article's `not_found`, and the local `not_configured` emitted only
 * by the null-object port when no API base URL is configured. `not_configured`
 * is never a server code and must never be treated as a service failure.
 */
export type BlogErrorCode = "unavailable" | "network" | "not_found" | "not_configured";

export type BlogListResult =
  | { readonly ok: true; readonly items: readonly BlogPostSummary[] }
  | { readonly ok: false; readonly code: BlogErrorCode };

export type BlogPostResult =
  | { readonly ok: true; readonly post: BlogPost }
  | { readonly ok: false; readonly code: BlogErrorCode };

export interface BlogPort {
  /** The published articles, newest first. */
  listPosts(): Promise<BlogListResult>;
  /** One article by its stable URL slug; an unknown or unpublished slug is `not_found`. */
  findPostBySlug(slug: string): Promise<BlogPostResult>;
}
