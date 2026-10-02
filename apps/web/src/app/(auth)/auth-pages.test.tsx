import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";
import LoginPage from "./login/page";
import SignupPage from "./signup/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

async function renderPage(
  page: (props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<ReactElement>,
  searchParams: Record<string, string | string[] | undefined>
) {
  const element = await page({ searchParams: Promise.resolve(searchParams) });
  render(<SessionStoreProvider port={new FakeAuthSession()}>{element}</SessionStoreProvider>);
}

describe("auth routes", () => {
  it("/signup opens signup mode with the role from ?role=", async () => {
    await renderPage(SignupPage, { role: "pyme" });
    expect(screen.getByRole("heading", { level: 2, name: "Creá tu cuenta" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Soy PyME" })).toHaveAttribute("aria-checked", "true");
  });

  it("/login opens login mode and defaults to the investor", async () => {
    await renderPage(LoginPage, {});
    expect(screen.getByRole("heading", { level: 2, name: "Ingresá a tu cuenta" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Soy inversor" })).toHaveAttribute("aria-checked", "true");
  });
});
