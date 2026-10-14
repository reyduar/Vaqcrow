import { describe, expect, it } from "vitest";
import {
  blogPostListSchema,
  blogPostSchema,
  blogPostSummarySchema,
  blogSlugSchema,
  parseBlogPost,
  parseBlogPostList
} from "./index.js";

/**
 * The public blog contracts (#498/WU2). These fix the wire shape before the
 * schemas exist: a summary carries only public facts (`slug`, `title`,
 * `summary`, `publishedAt`), a full post adds `tags` and the Markdown `body`,
 * the source file path never travels, and both levels are strict so a response
 * that drifted from the contract is an error, never a half-trusted object.
 */
const SUMMARY = {
  slug: "vaqcrow-sobre-stellar",
  title: "Vaqcrow sobre Stellar",
  summary: "Cómo funciona la financiación por ingresos con una bóveda Soroban.",
  publishedAt: "2026-10-14T12:00:00.000Z"
};

const POST = { ...SUMMARY, tags: ["stellar", "soroban"], body: "# Cuerpo\n\nTexto." };

describe("blog contracts", () => {
  it("accepts a published post summary and its list envelope", () => {
    expect(parseBlogPostList({ items: [SUMMARY] })).toEqual({ items: [SUMMARY] });
  });

  it("accepts a full post with tags and body", () => {
    expect(parseBlogPost(POST)).toEqual(POST);
  });

  it("accepts an empty list", () => {
    expect(parseBlogPostList({ items: [] })).toEqual({ items: [] });
  });

  it("is strict: an unknown key is rejected at every level, and the source path never travels", () => {
    expect(blogPostSummarySchema.safeParse({ ...SUMMARY, sourcePath: "blog/x.md" }).success).toBe(false);
    expect(blogPostSchema.safeParse({ ...POST, sourcePath: "blog/x.md" }).success).toBe(false);
    expect(blogPostListSchema.safeParse({ items: [SUMMARY], page: 1 }).success).toBe(false);
  });

  it("only accepts a slug-segment slug", () => {
    expect(blogSlugSchema.safeParse("vaqcrow-sobre-stellar").success).toBe(true);
    expect(blogSlugSchema.safeParse("a1-b2-c3").success).toBe(true);
    for (const bad of ["Vaqcrow", "vaq crow", "-leading", "trailing-", "double--hyphen", "", "con_underscore", "a/b"]) {
      expect(blogSlugSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it("requires a non-empty title and summary, and an ISO datetime with an offset", () => {
    expect(blogPostSummarySchema.safeParse({ ...SUMMARY, title: "  " }).success).toBe(false);
    expect(blogPostSummarySchema.safeParse({ ...SUMMARY, summary: "" }).success).toBe(false);
    expect(blogPostSummarySchema.safeParse({ ...SUMMARY, publishedAt: "2026-10-14" }).success).toBe(false);
    expect(blogPostSummarySchema.safeParse({ ...SUMMARY, publishedAt: "2026-10-14T12:00:00" }).success).toBe(false);
    // An explicit numeric offset is accepted alongside `Z`.
    expect(blogPostSummarySchema.safeParse({ ...SUMMARY, publishedAt: "2026-10-14T12:00:00+00:00" }).success).toBe(
      true
    );
  });

  it("does not require tags on a summary but does on a full post", () => {
    expect(blogPostSummarySchema.safeParse(SUMMARY).success).toBe(true);
    expect(blogPostSchema.safeParse({ ...SUMMARY, body: "x" }).success).toBe(false);
  });

  it("throws on invalid input through the parse wrappers", () => {
    expect(() => parseBlogPost({ ...POST, slug: "Nope" })).toThrow();
    expect(() => parseBlogPostList({ items: [{ ...SUMMARY, title: "" }] })).toThrow();
  });
});
