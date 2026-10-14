import type { BlogPort } from "@/application/blog/blog-port";
import { HttpBlogGateway } from "./http-blog-gateway";
import { UNAVAILABLE_BLOG_PORT } from "./unavailable-blog-port";

export { UNAVAILABLE_BLOG_PORT };

/** Builds the blog port from the API base URL; `null` without a backend. */
export function createBlogPort(baseUrl: string | undefined): BlogPort | null {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  return HttpBlogGateway.create(trimmed);
}

/**
 * Browser default. The blog is public, so no auth token is attached; without a
 * configured base URL it is the null object so the pages stay honest.
 */
export function createBrowserBlogPort(): BlogPort {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return UNAVAILABLE_BLOG_PORT;
  return HttpBlogGateway.create(baseUrl);
}
