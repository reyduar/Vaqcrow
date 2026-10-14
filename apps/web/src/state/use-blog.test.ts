import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { BlogPost, BlogPort, BlogPostSummary } from "@/application/blog/blog-port";
import { useBlogPost, useBlogPosts } from "./use-blog";

// `.ts` (no JSX): the wrapper is built with `createElement`.
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

const SLUG = "vaqcrow-explicado";

function summary(overrides: Partial<BlogPostSummary> = {}): BlogPostSummary {
  return {
    slug: SLUG,
    title: "Vaqcrow, explicado",
    summary: "Cómo funciona el financiamiento por revenue share sobre Stellar.",
    publishedAt: "2026-10-14T12:00:00.000Z",
    ...overrides
  };
}

function post(overrides: Partial<BlogPost> = {}): BlogPost {
  return { ...summary(), tags: ["stellar"], body: "# Encabezado", ...overrides };
}

describe("useBlogPosts", () => {
  it("fetches nothing with a null port", async () => {
    const { result } = renderHook(() => useBlogPosts(null), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.items).toEqual([]);
    expect(result.current.loadFailed).toBe(false);
  });

  it("loads the published list through the port", async () => {
    const listPosts = vi.fn().mockResolvedValue({ ok: true, items: [summary()] });
    const port: BlogPort = { listPosts, findPostBySlug: vi.fn() };

    const { result } = renderHook(() => useBlogPosts(port), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(listPosts).toHaveBeenCalledTimes(1);
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.items[0]!.title).toBe("Vaqcrow, explicado");
  });

  it("reports a failure without fabricating data", async () => {
    const port: BlogPort = { listPosts: vi.fn().mockResolvedValue({ ok: false, code: "network" }), findPostBySlug: vi.fn() };

    const { result } = renderHook(() => useBlogPosts(port), { wrapper });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.items).toEqual([]);
    expect(result.current.loadErrorCode).toBe("network");
  });

  it("surfaces not_configured when no backend is wired up", async () => {
    const port: BlogPort = { listPosts: vi.fn().mockResolvedValue({ ok: false, code: "not_configured" }), findPostBySlug: vi.fn() };

    const { result } = renderHook(() => useBlogPosts(port), { wrapper });

    await waitFor(() => expect(result.current.loadErrorCode).toBe("not_configured"));
    expect(result.current.items).toEqual([]);
  });

  it("reloads through the port", async () => {
    const listPosts = vi.fn().mockResolvedValue({ ok: true, items: [summary()] });
    const port: BlogPort = { listPosts, findPostBySlug: vi.fn() };

    const { result } = renderHook(() => useBlogPosts(port), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    result.current.reload();

    await waitFor(() => expect(listPosts).toHaveBeenCalledTimes(2));
  });
});

describe("useBlogPost", () => {
  it("fetches nothing with a null port", async () => {
    const { result } = renderHook(() => useBlogPost(SLUG, null), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.post).toBeNull();
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.notFound).toBe(false);
  });

  it("loads one post through the port", async () => {
    const findPostBySlug = vi.fn().mockResolvedValue({ ok: true, post: post() });
    const port: BlogPort = { listPosts: vi.fn(), findPostBySlug };

    const { result } = renderHook(() => useBlogPost(SLUG, port), { wrapper });

    await waitFor(() => expect(result.current.post).not.toBeNull());
    expect(findPostBySlug).toHaveBeenCalledWith(SLUG);
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.notFound).toBe(false);
    expect(result.current.post?.title).toBe("Vaqcrow, explicado");
  });

  it("keeps a 404 apart from a load failure", async () => {
    const port: BlogPort = { listPosts: vi.fn(), findPostBySlug: vi.fn().mockResolvedValue({ ok: false, code: "not_found" }) };

    const { result } = renderHook(() => useBlogPost(SLUG, port), { wrapper });

    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.post).toBeNull();
  });

  it("reports a genuine failure", async () => {
    const port: BlogPort = { listPosts: vi.fn(), findPostBySlug: vi.fn().mockResolvedValue({ ok: false, code: "network" }) };

    const { result } = renderHook(() => useBlogPost(SLUG, port), { wrapper });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.notFound).toBe(false);
    expect(result.current.loadErrorCode).toBe("network");
  });

  it("surfaces not_configured when no backend is wired up", async () => {
    const port: BlogPort = { listPosts: vi.fn(), findPostBySlug: vi.fn().mockResolvedValue({ ok: false, code: "not_configured" }) };

    const { result } = renderHook(() => useBlogPost(SLUG, port), { wrapper });

    await waitFor(() => expect(result.current.loadErrorCode).toBe("not_configured"));
  });
});
