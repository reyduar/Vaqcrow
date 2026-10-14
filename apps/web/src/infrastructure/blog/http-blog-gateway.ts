import axios, { type AxiosInstance } from "axios";
import { parseBlogPost, parseBlogPostList } from "@vaqcrow/contracts";
import type { BlogListResult, BlogPort, BlogPostResult } from "@/application/blog/blog-port";

/**
 * HTTP adapter for the public Blog (Feature #498, WU3) talking to `GET /blog`
 * and `GET /blog/:slug`. Both routes are public, so no `Authorization` header is
 * ever attached.
 *
 * The slug segment is percent-encoded before it reaches the URL, so a route
 * param can never smuggle a path traversal or a query separator into the
 * request. A malformed success body collapses to `unavailable` instead of
 * rendering; a 404 on an article is its own `not_found`; every other non-200
 * status is the sanitized `unavailable`, and a transport failure is `network`.
 */
export class HttpBlogGateway implements BlogPort {
  constructor(private readonly client: AxiosInstance) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string): HttpBlogGateway {
    return new HttpBlogGateway(axios.create({ baseURL: baseUrl, validateStatus: () => true }));
  }

  async listPosts(): Promise<BlogListResult> {
    try {
      const response = await this.client.get("/blog", { validateStatus: () => true });
      if (response.status !== 200) return { ok: false, code: "unavailable" };
      try {
        return { ok: true, items: parseBlogPostList(response.data).items };
      } catch {
        return { ok: false, code: "unavailable" };
      }
    } catch {
      return { ok: false, code: "network" };
    }
  }

  async findPostBySlug(slug: string): Promise<BlogPostResult> {
    try {
      const response = await this.client.get(`/blog/${encodeURIComponent(slug)}`, {
        validateStatus: () => true
      });
      if (response.status === 404) return { ok: false, code: "not_found" };
      if (response.status !== 200) return { ok: false, code: "unavailable" };
      try {
        return { ok: true, post: parseBlogPost(response.data) };
      } catch {
        return { ok: false, code: "unavailable" };
      }
    } catch {
      return { ok: false, code: "network" };
    }
  }
}
