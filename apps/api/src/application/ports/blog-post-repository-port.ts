/**
 * The public blog read model (#498/WU2, owner decision D3).
 *
 * One record per **published** post (`published_at is not null`). The body is
 * never part of the read model: `public.blog_post` only maps a stable URL slug
 * to a Markdown source file under `docs/guides/` plus the listing metadata. The
 * adapter resolves the row; a separate content source reads the file.
 *
 * Plain data only: this port lives in `application/` and imports no Fastify,
 * Supabase or Node core.
 */

/** A published article's listing entry. */
export interface BlogPostSummaryRecord {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  /** `public.blog_post.published_at` (ISO 8601). */
  readonly publishedAt: string;
}

/**
 * A published article plus the server-owned `sourcePath` (relative to
 * `docs/guides/`) the content source reads. `sourcePath` never crosses the wire.
 */
export interface BlogPostRecord extends BlogPostSummaryRecord {
  readonly sourcePath: string;
}

export type BlogPostRepositoryError = { readonly code: "unavailable" };

export type BlogPostRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: BlogPostRepositoryError };

export interface BlogPostRepositoryPort {
  /** Every published post, newest `publishedAt` first. */
  listPublished(): Promise<BlogPostRepositoryResult<readonly BlogPostSummaryRecord[]>>;

  /**
   * The row for a **published** post, or `undefined` when no published post
   * carries that slug (unknown or unpublished are the same absence, so the
   * route answers 404 for both).
   */
  findPublished(slug: string): Promise<BlogPostRepositoryResult<BlogPostRecord | undefined>>;
}
