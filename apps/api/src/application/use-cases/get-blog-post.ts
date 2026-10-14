import { parseBlogPost } from "@vaqcrow/contracts";
import type { BlogPost } from "@vaqcrow/contracts";
import { parseFrontMatter } from "../blog/front-matter.js";
import type { BlogContentSourcePort } from "../ports/blog-content-source-port.js";
import type { BlogPostRepositoryPort } from "../ports/blog-post-repository-port.js";

/**
 * The single public article (#498/WU2).
 *
 * Resolves a **published** post through the repository, then reads its Markdown
 * through the content source (the API serves the bundled `docs/guides/blog/`
 * files — owner decision D2), parses the front matter and returns the contract
 * shape with the front matter stripped from the body.
 *
 * An unknown or unpublished slug is the only `not_found`. A repository failure,
 * a source read failure and — importantly — a published row whose file is
 * missing or unreadable are all `unavailable`: a published row with no file is a
 * server-side fault, never a silent empty article. The server-owned
 * `sourcePath` never crosses the use-case boundary.
 */

export interface GetBlogPostDependencies {
  readonly repository: Pick<BlogPostRepositoryPort, "findPublished">;
  readonly source: Pick<BlogContentSourcePort, "read">;
}

export type GetBlogPostResult =
  | { readonly ok: true; readonly value: BlogPost }
  | { readonly ok: false; readonly error: { readonly code: "not_found" | "unavailable" } };

export async function getBlogPost(
  dependencies: GetBlogPostDependencies,
  slug: string
): Promise<GetBlogPostResult> {
  const found = await dependencies.repository.findPublished(slug);
  if (!found.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }
  if (found.value === undefined) {
    return { ok: false, error: { code: "not_found" } };
  }

  const record = found.value;
  const read = await dependencies.source.read(record.sourcePath);
  if (!read.ok || read.value === undefined) {
    // The row is published but its Markdown cannot be read; that is a
    // server-side fault, never a 200 with an empty article.
    return { ok: false, error: { code: "unavailable" } };
  }

  try {
    const { attributes, body } = parseFrontMatter(read.value);
    return {
      ok: true,
      value: parseBlogPost({
        slug: record.slug,
        title: record.title,
        summary: record.summary,
        publishedAt: record.publishedAt,
        tags: [...attributes.tags],
        body
      })
    };
  } catch {
    return { ok: false, error: { code: "unavailable" } };
  }
}
