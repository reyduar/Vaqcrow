import { describe, expect, it } from "vitest";
import type { BlogContentSourcePort } from "../ports/blog-content-source-port.js";
import type { BlogPostRecord, BlogPostRepositoryPort } from "../ports/blog-post-repository-port.js";
import { getBlogPost } from "./get-blog-post.js";

/**
 * The single-article use case (#498/WU2). The front matter is stripped from the
 * body; a repository failure, a source read failure and a **published row whose
 * file is missing or unreadable** all map to `unavailable` — a server-side
 * fault, never a silent empty article. An unknown/unpublished slug is the only
 * `not_found`.
 */
const RECORD: BlogPostRecord = {
  slug: "vaqcrow-sobre-stellar",
  title: "Vaqcrow sobre Stellar",
  summary: "Cómo funciona.",
  publishedAt: "2026-10-14T12:00:00.000Z",
  sourcePath: "blog/vaqcrow-sobre-stellar.md"
};

// The file's front-matter title differs from the row's; the row wins on the wire.
const SOURCE = "---\ntitle: Otro\ntags: [stellar, soroban]\n---\n# Cuerpo";

function fakeRepository(
  value: Awaited<ReturnType<BlogPostRepositoryPort["findPublished"]>>
): Pick<BlogPostRepositoryPort, "findPublished"> {
  return { findPublished: async () => value };
}

function fakeSource(
  value: Awaited<ReturnType<BlogContentSourcePort["read"]>>
): Pick<BlogContentSourcePort, "read"> {
  return { read: async () => value };
}

describe("getBlogPost", () => {
  it("strips the front matter from the body, parses its tags, and never leaks the source path", async () => {
    const result = await getBlogPost(
      { repository: fakeRepository({ ok: true, value: RECORD }), source: fakeSource({ ok: true, value: SOURCE }) },
      RECORD.slug
    );

    expect(result).toEqual({
      ok: true,
      value: {
        slug: RECORD.slug,
        title: RECORD.title,
        summary: RECORD.summary,
        publishedAt: RECORD.publishedAt,
        tags: ["stellar", "soroban"],
        body: "# Cuerpo"
      }
    });
    expect(result.ok && result.value).not.toHaveProperty("sourcePath");
  });

  it("answers not_found for an unknown or unpublished slug", async () => {
    const result = await getBlogPost(
      { repository: fakeRepository({ ok: true, value: undefined }), source: fakeSource({ ok: true, value: undefined }) },
      "nope"
    );

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
  });

  it("maps a repository failure to unavailable", async () => {
    const result = await getBlogPost(
      {
        repository: fakeRepository({ ok: false, error: { code: "unavailable" } }),
        source: fakeSource({ ok: true, value: SOURCE })
      },
      RECORD.slug
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps a source read failure to unavailable", async () => {
    const result = await getBlogPost(
      {
        repository: fakeRepository({ ok: true, value: RECORD }),
        source: fakeSource({ ok: false, error: { code: "unavailable" } })
      },
      RECORD.slug
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps a published row whose file is missing to unavailable, never an empty article", async () => {
    const result = await getBlogPost(
      { repository: fakeRepository({ ok: true, value: RECORD }), source: fakeSource({ ok: true, value: undefined }) },
      RECORD.slug
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps a row that violates the contract to unavailable", async () => {
    const broken = { ...RECORD, title: "  " };
    const result = await getBlogPost(
      { repository: fakeRepository({ ok: true, value: broken }), source: fakeSource({ ok: true, value: SOURCE }) },
      RECORD.slug
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});
