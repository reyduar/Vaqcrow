import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";

// The shared shell reads the current path and the router; both are stubbed so
// the page renders without a Next.js runtime.
vi.mock("next/navigation", () => ({
  usePathname: () => "/blog/vaqcrow-explicado",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

import BlogArticlePage from "./page";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/blog/[slug]", () => {
  it("renders the honest no-backend notice when no API is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");

    render(
      <SessionStoreProvider port={new FakeAuthSession()}>
        {await BlogArticlePage({ params: Promise.resolve({ slug: "vaqcrow-explicado" }) })}
      </SessionStoreProvider>
    );

    expect(await screen.findByText("Esta instancia no tiene configurada la API")).toBeInTheDocument();
  });
});
