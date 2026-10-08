import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";
import LoginPage from "./login/page";
import SignupPage from "./signup/page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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

  it("/login returns to a safe ?returnTo= after signing in", async () => {
    push.mockReset();
    const fake = new FakeAuthSession();
    fake.seedAccount({ email: "lucia@example.test", password: "12345678", role: "INVERSOR", displayName: "Lucía Fernández" });

    const element = await LoginPage({ searchParams: Promise.resolve({ returnTo: "/explore" }) });
    render(<SessionStoreProvider port={fake}>{element}</SessionStoreProvider>);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "lucia@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/explore"));
  });
});
