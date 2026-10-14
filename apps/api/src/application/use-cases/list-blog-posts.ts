import { parseBlogPostList } from "@vaqcrow/contracts";
import type { BlogPostList } from "@vaqcrow/contracts";
import type { BlogPostRepositoryPort, BlogPostSummaryRecord } from "../ports/blog-post-repository-port.js";

/**
 * The public blog listing (#498/WU2).
 *
 * Reads every published post and shapes it into the portable
 * `blogPostListSchema`. A repository failure and a malformed record both map to
 * `unavailable`, never a half-built or silently shortened list.
 */

export interface ListBlogPostsDependencies {
  readonly repository: Pick<BlogPostRepositoryPort, "listPublished">;
}

export type ListBlogPostsResult =
  | { readonly ok: true; readonly value: BlogPostList }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export async function listBlogPosts(dependencies: ListBlogPostsDependencies): Promise<ListBlogPostsResult> {
  const listed = await dependencies.repository.listPublished();
  if (!listed.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  try {
    return { ok: true, value: parseBlogPostList({ items: listed.value.map(toSummary) }) };
  } catch {
    return { ok: false, error: { code: "unavailable" } };
  }
}

function toSummary(record: BlogPostSummaryRecord): BlogPostSummaryRecord {
  return {
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    publishedAt: record.publishedAt
  };
}
