import { describe, expect, it, vi } from "vitest";
import { SupabaseBlogPostRepository } from "./supabase-blog-post-repository.js";

/**
 * The blog repository adapter (#498/WU2). It reads `public.blog_post` as
 * service_role, lists only published rows newest-first and collapses every
 * PostgREST failure to a sanitized `unavailable`; a malformed row throws and is
 * caught the same way. The fake client records the chain the adapter builds.
 */
interface ChainCalls {
  select?: string;
  not?: readonly unknown[];
  order?: readonly unknown[];
  eq?: readonly unknown[];
}

function fakeClient(result: { readonly data: unknown; readonly error: unknown }): {
  readonly client: never;
  readonly from: ReturnType<typeof vi.fn>;
  readonly calls: ChainCalls;
} {
  const calls: ChainCalls = {};
  const builder = {
    select: vi.fn((columns: string) => {
      calls.select = columns;
      return builder;
    }),
    not: vi.fn((...args: unknown[]) => {
      calls.not = args;
      return builder;
    }),
    eq: vi.fn((...args: unknown[]) => {
      calls.eq = args;
      return builder;
    }),
    order: vi.fn((...args: unknown[]) => {
      calls.order = args;
      return Promise.resolve(result);
    }),
    maybeSingle: vi.fn(() => Promise.resolve(result))
  };
  const from = vi.fn(() => builder);
  return { client: { from } as never, from, calls };
}

const ROW = {
  slug: "vaqcrow-sobre-stellar",
  title: "Vaqcrow sobre Stellar",
  summary: "Cómo funciona.",
  published_at: "2026-10-14T12:00:00.000Z",
  source_path: "blog/vaqcrow-sobre-stellar.md"
};

describe("SupabaseBlogPostRepository.listPublished", () => {
  it("lists published rows newest-first and maps the summary columns", async () => {
    const { client, from, calls } = fakeClient({ data: [ROW], error: null });
    const result = await new SupabaseBlogPostRepository(client).listPublished();

    expect(from).toHaveBeenCalledWith("blog_post");
    expect(calls.select).toBe("slug,title,summary,published_at");
    expect(calls.not).toEqual(["published_at", "is", null]);
    expect(calls.order).toEqual(["published_at", { ascending: false }]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          slug: ROW.slug,
          title: ROW.title,
          summary: ROW.summary,
          publishedAt: ROW.published_at
        }
      ]
    });
  });

  it("answers an empty published list with an empty array", async () => {
    const { client } = fakeClient({ data: [], error: null });
    expect(await new SupabaseBlogPostRepository(client).listPublished()).toEqual({ ok: true, value: [] });
  });

  it("collapses a PostgREST error to unavailable", async () => {
    const { client } = fakeClient({ data: null, error: { code: "PGRST100", message: "boom", details: "d", hint: "h" } });
    const result = await new SupabaseBlogPostRepository(client).listPublished();

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("boom");
  });

  it("maps a malformed row to unavailable instead of a half-built summary", async () => {
    const { client } = fakeClient({ data: [{ ...ROW, title: null }], error: null });
    expect(await new SupabaseBlogPostRepository(client).listPublished()).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});

describe("SupabaseBlogPostRepository.findPublished", () => {
  it("reads one published row by slug, carrying the source path for the content source", async () => {
    const { client, calls } = fakeClient({ data: ROW, error: null });
    const result = await new SupabaseBlogPostRepository(client).findPublished(ROW.slug);

    expect(calls.select).toBe("slug,title,summary,published_at,source_path");
    expect(calls.eq).toEqual(["slug", ROW.slug]);
    expect(calls.not).toEqual(["published_at", "is", null]);
    expect(result).toEqual({
      ok: true,
      value: {
        slug: ROW.slug,
        title: ROW.title,
        summary: ROW.summary,
        publishedAt: ROW.published_at,
        sourcePath: ROW.source_path
      }
    });
  });

  it("answers undefined when no published row carries the slug", async () => {
    const { client } = fakeClient({ data: null, error: null });
    expect(await new SupabaseBlogPostRepository(client).findPublished("nope")).toEqual({
      ok: true,
      value: undefined
    });
  });

  it("collapses a PostgREST error to unavailable", async () => {
    const { client } = fakeClient({ data: null, error: { code: "PGRST100", message: "boom" } });
    expect(await new SupabaseBlogPostRepository(client).findPublished(ROW.slug)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("maps a row with an empty source path to unavailable", async () => {
    const { client } = fakeClient({ data: { ...ROW, source_path: "" }, error: null });
    expect(await new SupabaseBlogPostRepository(client).findPublished(ROW.slug)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});
