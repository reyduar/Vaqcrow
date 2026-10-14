import { describe, expect, it } from "vitest";
import type {
  BlogPostRepositoryPort,
  BlogPostSummaryRecord
} from "../ports/blog-post-repository-port.js";
import { listBlogPosts } from "./list-blog-posts.js";

/**
 * The blog listing use case (#498/WU2). A repository failure and a malformed
 * record both map to `unavailable`, never a half-built or silently shortened
 * list; the envelope is validated against the contract.
 */
const RECORD: BlogPostSummaryRecord = {
  slug: "vaqcrow-sobre-stellar",
  title: "Vaqcrow sobre Stellar",
  summary: "Cómo funciona la financiación por ingresos con una bóveda Soroban.",
  publishedAt: "2026-10-14T12:00:00.000Z"
};

function fakeRepository(
  value: Awaited<ReturnType<BlogPostRepositoryPort["listPublished"]>>
): Pick<BlogPostRepositoryPort, "listPublished"> {
  return { listPublished: async () => value };
}

describe("listBlogPosts", () => {
  it("shapes the published records into the contract envelope", async () => {
    const result = await listBlogPosts({ repository: fakeRepository({ ok: true, value: [RECORD] }) });

    expect(result).toEqual({ ok: true, value: { items: [RECORD] } });
  });

  it("lists nothing (200, empty) when the repository returns no published posts", async () => {
    const result = await listBlogPosts({ repository: fakeRepository({ ok: true, value: [] }) });

    expect(result).toEqual({ ok: true, value: { items: [] } });
  });

  it("maps a repository failure to unavailable, never an empty list", async () => {
    const result = await listBlogPosts({
      repository: fakeRepository({ ok: false, error: { code: "unavailable" } })
    });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps a malformed record to unavailable instead of a half-built entry", async () => {
    const malformed = { ...RECORD, slug: "Not A Slug" };
    const result = await listBlogPosts({ repository: fakeRepository({ ok: true, value: [malformed] }) });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});
