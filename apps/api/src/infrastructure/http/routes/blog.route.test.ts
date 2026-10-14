import { parseBlogPost, parseBlogPostList } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlogContentSourcePort } from "../../../application/ports/blog-content-source-port.js";
import type {
  BlogPostRecord,
  BlogPostRepositoryPort,
  BlogPostSummaryRecord
} from "../../../application/ports/blog-post-repository-port.js";
import { buildApp } from "../build-app.js";
import { fakeAuthPort } from "../test-support/auth.js";
import type { BlogRouteDependencies } from "./blog.route.js";

/**
 * The public blog surface (#498/WU2, S2/S3). `GET /blog` lists published posts
 * and `GET /blog/:slug` serves one article with its front matter stripped from
 * the body. Both need no token; a malformed/unknown slug is 404 and any
 * repository or content-source failure is a sanitized 503.
 */
const SUMMARY: BlogPostSummaryRecord = {
  slug: "vaqcrow-sobre-stellar",
  title: "Vaqcrow sobre Stellar",
  summary: "Cómo funciona.",
  publishedAt: "2026-10-14T12:00:00.000Z"
};

const RECORD: BlogPostRecord = { ...SUMMARY, sourcePath: "blog/vaqcrow-sobre-stellar.md" };
const SOURCE = "---\ntitle: Otro\ntags: [stellar, soroban]\n---\n# Cuerpo";

function blog(
  options: {
    listed?: Awaited<ReturnType<BlogPostRepositoryPort["listPublished"]>>;
    found?: Awaited<ReturnType<BlogPostRepositoryPort["findPublished"]>>;
    read?: Awaited<ReturnType<BlogContentSourcePort["read"]>>;
  } = {}
): BlogRouteDependencies {
  return {
    posts: {
      listPublished: async () => options.listed ?? { ok: true as const, value: [] },
      findPublished: async () => options.found ?? { ok: true as const, value: undefined }
    },
    source: { read: async () => options.read ?? { ok: true as const, value: undefined } }
  };
}

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /blog", () => {
  it("is reachable without a token and answers the contract envelope with a short cache header", async () => {
    app = buildApp({ auth: { port: fakeAuthPort() }, blog: blog({ listed: { ok: true, value: [SUMMARY] } }) });

    const response = await app.inject({ method: "GET", url: "/blog" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.headers["cache-control"]).toBe("public, max-age=60, stale-while-revalidate=30");
    expect(parseBlogPostList(response.json()).items).toEqual([SUMMARY]);
  });

  it("answers an empty published list with 200 and no items", async () => {
    app = buildApp({ auth: { port: fakeAuthPort() }, blog: blog({ listed: { ok: true, value: [] } }) });

    const response = await app.inject({ method: "GET", url: "/blog" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [] });
  });

  it("answers a sanitized 503 when the repository is unavailable", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      blog: blog({ listed: { ok: false, error: { code: "unavailable" } } })
    });

    const response = await app.inject({ method: "GET", url: "/blog" });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
  });
});

describe("GET /blog/:slug", () => {
  const url = `/blog/${SUMMARY.slug}`;

  it("serves one published article with the front matter stripped from the body, without a token", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      blog: blog({ found: { ok: true, value: RECORD }, read: { ok: true, value: SOURCE } })
    });

    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(200);
    const body = parseBlogPost(response.json());
    expect(body.body).toBe("# Cuerpo");
    expect(body.body).not.toContain("---");
    expect(body.tags).toEqual(["stellar", "soroban"]);
    expect(body.title).toBe(SUMMARY.title);
    expect(body).not.toHaveProperty("sourcePath");
  });

  it("answers 404 for a malformed slug before touching the repository", async () => {
    const findPublished = vi.fn(async () => ({ ok: true as const, value: undefined }));
    app = buildApp({
      auth: { port: fakeAuthPort() },
      blog: {
        posts: { listPublished: async () => ({ ok: true as const, value: [] }), findPublished },
        source: { read: async () => ({ ok: true as const, value: undefined }) }
      }
    });

    const response = await app.inject({ method: "GET", url: "/blog/Not-A-Slug" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
    expect(findPublished).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown or unpublished slug", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      blog: blog({ found: { ok: true, value: undefined } })
    });

    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("answers a sanitized 503 when the repository is unavailable", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      blog: blog({ found: { ok: false, error: { code: "unavailable" } } })
    });

    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
  });

  it("answers a sanitized 503 when a published row's file is missing or unreadable", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      blog: blog({ found: { ok: true, value: RECORD }, read: { ok: true, value: undefined } })
    });

    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
  });

  it("answers a sanitized 503 when the content source fails", async () => {
    app = buildApp({
      auth: { port: fakeAuthPort() },
      blog: blog({ found: { ok: true, value: RECORD }, read: { ok: false, error: { code: "unavailable" } } })
    });

    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
  });
});
