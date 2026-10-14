import { blogSlugSchema } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { BlogContentSourcePort } from "../../../application/ports/blog-content-source-port.js";
import type { BlogPostRepositoryPort } from "../../../application/ports/blog-post-repository-port.js";
import { getBlogPost } from "../../../application/use-cases/get-blog-post.js";
import { listBlogPosts } from "../../../application/use-cases/list-blog-posts.js";

/**
 * The public blog surface (#498/WU2, S2/S3).
 *
 * `GET /blog` is PUBLIC (no token): it lists every published post — the
 * `public.blog_post` rows whose `published_at` is not null — as one unpaginated
 * `{ items }` list. `GET /blog/:slug` is PUBLIC too: it serves one article with
 * its front matter stripped from the body (S8). A malformed or unknown slug is
 * a `404`; a repository failure or a published row whose Markdown cannot be read
 * is a sanitized `503`, never a 200 with an empty article.
 *
 * The listing is public but changes only on a deploy (owner decision D2/D3), so
 * it carries a short revalidating `Cache-Control` for the CDN/browser.
 */
export interface BlogRouteDependencies {
  readonly posts: Pick<BlogPostRepositoryPort, "listPublished" | "findPublished">;
  readonly source: Pick<BlogContentSourcePort, "read">;
}

const CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=30";

export function registerBlogRoute(app: FastifyInstance, dependencies: BlogRouteDependencies): void {
  app.get("/blog", async (_request, reply) => {
    const result = await listBlogPosts({ repository: dependencies.posts });

    if (!result.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.header("cache-control", CACHE_CONTROL).code(200).send(result.value);
  });

  app.get<{ Params: { slug: string } }>("/blog/:slug", async (request, reply) => {
    // A malformed slug is a 404, not a 400: the route only ever speaks about an
    // article that exists and is published, and a bad slug names no article.
    const parsed = blogSlugSchema.safeParse(request.params.slug);
    if (!parsed.success) {
      return reply.code(404).send({ code: "not_found" });
    }

    const result = await getBlogPost(
      { repository: dependencies.posts, source: dependencies.source },
      parsed.data
    );

    if (!result.ok) {
      return result.error.code === "not_found"
        ? reply.code(404).send({ code: "not_found" })
        : reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send(result.value);
  });
}
