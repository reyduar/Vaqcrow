import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/"
}));

import Home from "./page";

describe("Home", () => {
  it("is a landing skeleton with the shell header, not a redirect to the journey", async () => {
    render(
      <SessionStoreProvider port={new FakeAuthSession()}>
        <Home />
      </SessionStoreProvider>
    );

    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Vaqcrow" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Crear cuenta" })).toHaveAttribute("href", "/signup");
    expect(screen.getByText("No apto para producción")).toBeInTheDocument();
  });
});
