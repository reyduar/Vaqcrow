import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BLOG_COPY } from "@/application/blog/copy";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";

// The public shell reads the current path and the router; both are stubbed so
// the page renders without a Next.js runtime (same pattern as `/(app)` tests).
vi.mock("next/navigation", () => ({
  usePathname: () => "/blog",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

import BlogPage from "./page";

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderPage() {
  return render(
    <SessionStoreProvider port={new FakeAuthSession()}>
      <BlogPage />
    </SessionStoreProvider>
  );
}

describe("/blog", () => {
  it("renders the public blog shell with its guide-style heading", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: BLOG_COPY.list.title })).toBeInTheDocument();
    expect(screen.getByText(BLOG_COPY.list.subtitle)).toBeInTheDocument();
  });

  it("renders the honest no-backend notice instead of an empty list when no API is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Esta instancia no tiene configurada la API")).toBeInTheDocument()
    );
    expect(screen.queryByText(BLOG_COPY.list.emptyTitle)).not.toBeInTheDocument();
  });
});
