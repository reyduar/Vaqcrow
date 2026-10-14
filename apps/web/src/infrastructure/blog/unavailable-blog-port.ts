import type { BlogListResult, BlogPort, BlogPostResult } from "@/application/blog/blog-port";

/**
 * Null-object blog port used when no backend base URL is configured (#480):
 * both reads answer `not_configured` — the honest "no API wired up", which the
 * pages render as a calm notice, **not** as a service failure and never as an
 * invented list or article.
 */
export const UNAVAILABLE_BLOG_PORT: BlogPort = Object.freeze({
  async listPosts(): Promise<BlogListResult> {
    return { ok: false, code: "not_configured" };
  },
  async findPostBySlug(): Promise<BlogPostResult> {
    return { ok: false, code: "not_configured" };
  }
});
