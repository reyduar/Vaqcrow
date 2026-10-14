import { z } from "zod";

/**
 * The public blog contracts (#498/WU2).
 *
 * One article is a Markdown file under `docs/guides/blog/` (owner decision D3:
 * the body lives in the repository, never in the database); `public.blog_post`
 * only maps a stable URL slug to its source file plus the listing metadata.
 * These schemas are the wire shape `apps/web` consumes: the listing summary
 * (`GET /blog`) carries only public facts, the full post (`GET /blog/:slug`)
 * adds the front-matter `tags` and the Markdown `body` with the front matter
 * already stripped. The server-owned `source_path` never crosses this boundary.
 */

/**
 * A blog slug: the URL segment `/blog/<slug>` and the natural primary key. The
 * same shape the `public.blog_post.slug` check enforces, so a database row can
 * always satisfy the wire contract.
 */
export const blogSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export type BlogSlug = z.infer<typeof blogSlugSchema>;

/** A published article's listing entry: no body, no tags, no source path. */
export const blogPostSummarySchema = z.strictObject({
  slug: blogSlugSchema,
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  /** `public.blog_post.published_at`; the only visible date (owner decision D6). */
  publishedAt: z.iso.datetime({ offset: true })
});

export type BlogPostSummary = z.infer<typeof blogPostSummarySchema>;

/** `GET /blog` response: one unpaginated, newest-first list. */
export const blogPostListSchema = z.strictObject({
  items: z.array(blogPostSummarySchema)
});

export type BlogPostList = z.infer<typeof blogPostListSchema>;

/**
 * One full article (`GET /blog/:slug`): the summary plus the parsed front-matter
 * `tags` and the Markdown `body` with the front matter stripped.
 */
export const blogPostSchema = blogPostSummarySchema.extend({
  tags: z.array(z.string()),
  body: z.string()
});

export type BlogPost = z.infer<typeof blogPostSchema>;

export function parseBlogPostList(input: unknown): BlogPostList {
  return blogPostListSchema.parse(input);
}

export function parseBlogPost(input: unknown): BlogPost {
  return blogPostSchema.parse(input);
}
