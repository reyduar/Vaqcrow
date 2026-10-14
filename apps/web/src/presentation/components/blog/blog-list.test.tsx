import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { BlogPort, BlogPostSummary } from "@/application/blog/blog-port";
import { BLOG_COPY } from "@/application/blog/copy";
import { BlogList } from "./blog-list";

// A fresh cache per render: SWR's global cache would otherwise leak a loaded
// list from one test into the next (the states all share one key).
const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

function summary(overrides: Partial<BlogPostSummary> = {}): BlogPostSummary {
  return {
    slug: "vaqcrow-explicado",
    title: "Vaqcrow, explicado",
    summary: "Cómo funciona el financiamiento por revenue share sobre Stellar.",
    publishedAt: "2026-10-14T12:00:00.000Z",
    ...overrides
  };
}

function port(overrides: Partial<BlogPort> = {}): BlogPort {
  return {
    listPosts: vi.fn().mockResolvedValue({ ok: true, items: [] }),
    findPostBySlug: vi.fn(),
    ...overrides
  };
}

function renderList(p: BlogPort | null) {
  return render(<BlogList port={p} />, { wrapper });
}

describe("BlogList", () => {
  it("renders the guide-style hero", () => {
    renderList(port());

    expect(screen.getByRole("heading", { level: 1, name: BLOG_COPY.list.title })).toBeInTheDocument();
    expect(screen.getByText(BLOG_COPY.list.subtitle)).toBeInTheDocument();
    expect(screen.getByText(BLOG_COPY.list.note)).toBeInTheDocument();
  });

  it("shows a loading state before the list resolves", async () => {
    const pending: BlogPort = { listPosts: () => new Promise(() => {}), findPostBySlug: vi.fn() };

    renderList(pending);

    expect(screen.getByText(BLOG_COPY.list.loading)).toBeInTheDocument();
  });

  it("lists the published posts with title, summary and date, linking to the article", async () => {
    const item = summary();
    renderList(port({ listPosts: vi.fn().mockResolvedValue({ ok: true, items: [item] }) }));

    const link = await screen.findByRole("link", { name: new RegExp(item.title) });
    expect(link).toHaveAttribute("href", `/blog/${item.slug}`);
    expect(within(link).getByText(item.summary)).toBeInTheDocument();
    expect(within(link).getByText("14/10/2026")).toBeInTheDocument();
  });

  it("shows an empty state when no article is published", async () => {
    renderList(port());

    expect(await screen.findByText(BLOG_COPY.list.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(BLOG_COPY.list.emptyBody)).toBeInTheDocument();
  });

  // Issue #480: a missing backend is not a failure.
  it("shows the no-backend notice (not the error state) when not configured", async () => {
    renderList(port({ listPosts: vi.fn().mockResolvedValue({ ok: false, code: "not_configured" }) }));

    expect(await screen.findByText("Esta instancia no tiene configurada la API")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(BLOG_COPY.list.emptyTitle)).not.toBeInTheDocument();
  });

  it("shows the error state and retries through the port", async () => {
    const listPosts = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "network" })
      .mockResolvedValueOnce({ ok: true, items: [summary()] });

    renderList({ listPosts, findPostBySlug: vi.fn() });

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(BLOG_COPY.list.errorTitle)).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: BLOG_COPY.list.retry }));

    await waitFor(() => expect(listPosts).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("link", { name: /Vaqcrow, explicado/ })).toBeInTheDocument();
  });
});
