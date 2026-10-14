import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import { ABOUT_COPY } from "@/application/about/copy";
import type { BlogPort, BlogPostSummary } from "@/application/blog/blog-port";
import { AboutBlogSection } from "./about-blog-section";

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

const { blog } = ABOUT_COPY;

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
  return { listPosts: vi.fn().mockResolvedValue({ ok: true, items: [] }), findPostBySlug: vi.fn(), ...overrides };
}

function renderSection(p: BlogPort | null) {
  return render(<AboutBlogSection port={p} />, { wrapper });
}

describe("AboutBlogSection", () => {
  it("renders the section heading, the intro and the link to /blog", () => {
    renderSection(port());

    expect(screen.getByRole("heading", { level: 2, name: blog.title })).toBeInTheDocument();
    expect(screen.getByText(blog.intro)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: blog.seeAll })).toHaveAttribute("href", "/blog");
  });

  it("lists the published posts with title, summary and date, linking to each article", async () => {
    const item = summary();
    renderSection(port({ listPosts: vi.fn().mockResolvedValue({ ok: true, items: [item] }) }));

    const link = await screen.findByRole("link", { name: new RegExp(item.title) });
    expect(link).toHaveAttribute("href", `/blog/${item.slug}`);
    expect(within(link).getByText(item.summary)).toBeInTheDocument();
    expect(within(link).getByText("14/10/2026")).toBeInTheDocument();
  });

  it("shows an empty state when no article is published", async () => {
    renderSection(port());

    expect(await screen.findByText(blog.emptyTitle)).toBeInTheDocument();
  });

  // Issue #480: a missing backend is not a failure.
  it("shows the no-backend notice when not configured", async () => {
    renderSection(port({ listPosts: vi.fn().mockResolvedValue({ ok: false, code: "not_configured" }) }));

    expect(await screen.findByText("Esta instancia no tiene configurada la API")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the error state and retries through the port", async () => {
    const listPosts = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "network" })
      .mockResolvedValueOnce({ ok: true, items: [summary()] });

    renderSection({ listPosts, findPostBySlug: vi.fn() });

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(blog.errorTitle)).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: blog.retry }));

    await waitFor(() => expect(listPosts).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("link", { name: /Vaqcrow, explicado/ })).toBeInTheDocument();
  });
});
