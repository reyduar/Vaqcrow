import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlogPort, createBrowserBlogPort, UNAVAILABLE_BLOG_PORT } from "./create-blog-port";
import { HttpBlogGateway } from "./http-blog-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createBlogPort", () => {
  it("returns null without a base URL", () => {
    expect(createBlogPort(undefined)).toBeNull();
    expect(createBlogPort("")).toBeNull();
    expect(createBlogPort("   ")).toBeNull();
  });

  it("builds the HTTP gateway from a trimmed base URL", () => {
    expect(createBlogPort("  http://localhost:3000  ")).toBeInstanceOf(HttpBlogGateway);
  });
});

describe("createBrowserBlogPort", () => {
  it("falls back to the null object without a configured base URL", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    expect(createBrowserBlogPort()).toBe(UNAVAILABLE_BLOG_PORT);
  });

  it("builds a gateway when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    const port = createBrowserBlogPort();
    expect(port).not.toBe(UNAVAILABLE_BLOG_PORT);
    expect(port).toBeInstanceOf(HttpBlogGateway);
  });
});

describe("UNAVAILABLE_BLOG_PORT", () => {
  it("answers not_configured for both reads", async () => {
    expect(await UNAVAILABLE_BLOG_PORT.listPosts()).toEqual({ ok: false, code: "not_configured" });
    expect(await UNAVAILABLE_BLOG_PORT.findPostBySlug("vaqcrow-explicado")).toEqual({
      ok: false,
      code: "not_configured"
    });
  });
});
