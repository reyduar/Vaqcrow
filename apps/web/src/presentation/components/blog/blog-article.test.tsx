import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { BlogPort, BlogPost } from "@/application/blog/blog-port";
import { BLOG_COPY } from "@/application/blog/copy";
import { BlogArticle } from "./blog-article";

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

const SLUG = "vaqcrow-explicado";

function post(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    slug: SLUG,
    title: "Vaqcrow, explicado",
    summary: "Cómo funciona el financiamiento por revenue share sobre Stellar.",
    publishedAt: "2026-10-14T12:00:00.000Z",
    tags: ["stellar", "revenue-share"],
    body: "# Sección\n\nUn párrafo con **negrita**.",
    ...overrides
  };
}

function port(overrides: Partial<BlogPort> = {}): BlogPort {
  return { listPosts: vi.fn(), findPostBySlug: vi.fn().mockResolvedValue({ ok: true, post: post() }), ...overrides };
}

function renderArticle(p: BlogPort | null) {
  return render(<BlogArticle slug={SLUG} port={p} />, { wrapper });
}

describe("BlogArticle", () => {
  it("renders the title, the publication date and the Markdown body, with no byline", async () => {
    renderArticle(port());

    expect(await screen.findByRole("heading", { level: 1, name: "Vaqcrow, explicado" })).toBeInTheDocument();
    expect(screen.getByText("14/10/2026")).toBeInTheDocument();
    // The body's own heading is shifted below the page title.
    expect(screen.getByRole("heading", { level: 2, name: "Sección" })).toBeInTheDocument();
    expect(screen.getByText(/Un párrafo con/)).toBeInTheDocument();
    // D6: the only visible metadata is the date; there is no author byline.
    expect(screen.queryByText(/por Ariel|Ariel Duarte/)).not.toBeInTheDocument();
  });

  it("shows a loading state before the article resolves", () => {
    renderArticle({ listPosts: vi.fn(), findPostBySlug: () => new Promise(() => {}) });

    expect(screen.getByText(BLOG_COPY.article.loading)).toBeInTheDocument();
  });

  // Issue #480: a missing backend is not a failure.
  it("shows the no-backend notice when not configured", async () => {
    renderArticle(port({ findPostBySlug: vi.fn().mockResolvedValue({ ok: false, code: "not_configured" }) }));

    expect(await screen.findByText("Esta instancia no tiene configurada la API")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an in-component not-found state with a way back to the blog", async () => {
    renderArticle(port({ findPostBySlug: vi.fn().mockResolvedValue({ ok: false, code: "not_found" }) }));

    expect(
      await screen.findByRole("heading", { level: 1, name: BLOG_COPY.article.notFoundTitle })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: BLOG_COPY.article.notFoundCta })).toHaveAttribute("href", "/blog");
  });

  it("shows the error state and retries through the port", async () => {
    const findPostBySlug = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "network" })
      .mockResolvedValueOnce({ ok: true, post: post() });

    renderArticle({ listPosts: vi.fn(), findPostBySlug });

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(BLOG_COPY.article.errorTitle)).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: BLOG_COPY.article.retry }));

    await waitFor(() => expect(findPostBySlug).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { level: 1, name: "Vaqcrow, explicado" })).toBeInTheDocument();
  });
});
