import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import { ASSISTANT_COPY } from "@/application/assistant/copy";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";

// The quick links are `next/link`s; no router behaviour is asserted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/"
}));

import { HelpAssistant } from "./help-assistant";

const TOGGLE = "Abrir ayuda";
const EMAIL = "persona@example.test";
const PASSWORD = "secret-123";

/**
 * Mounts the floating assistant under the session provider the app always has
 * (#499/WU3): the role decides whether the panel shows the chat or the FAQ view.
 * With no API base URL the assistant's port is the null object, so these tests
 * never touch the network.
 */
async function renderAssistant(role: PrincipalRole | null = null) {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
  const fake = new FakeAuthSession();
  if (role) {
    fake.seedAccount({ email: EMAIL, password: PASSWORD, role, displayName: "Cuenta" });
    await fake.signIn({ email: EMAIL, password: PASSWORD });
  }
  render(
    <SessionStoreProvider port={fake}>
      <HelpAssistant />
    </SessionStoreProvider>
  );
  return fake;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("HelpAssistant (Feature #418, WU4)", () => {
  it("keeps the panel hidden until the toggle is used, then opens it", async () => {
    await renderAssistant();

    const toggle = screen.getByRole("button", { name: TOGGLE });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the panel when the toggle is used again", async () => {
    await renderAssistant();

    const toggle = screen.getByRole("button", { name: TOGGLE });
    fireEvent.click(toggle);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("names the dialog for assistive technology", async () => {
    await renderAssistant();
    fireEvent.click(screen.getByRole("button", { name: TOGGLE }));

    expect(screen.getByRole("dialog", { name: "Asistente de ayuda" })).toBeInTheDocument();
  });

  it("greets the visitor and points the three quick links at /help and #limites", async () => {
    await renderAssistant();
    fireEvent.click(screen.getByRole("button", { name: TOGGLE }));

    const panel = within(screen.getByRole("dialog"));
    expect(
      panel.getByText("Hola. Todavía no estoy conectado, pero estas respuestas te pueden servir:")
    ).toBeInTheDocument();
    expect(panel.getByRole("link", { name: "¿Qué es el revenue share?" })).toHaveAttribute("href", "/help");
    expect(panel.getByRole("link", { name: "¿Vaqcrow guarda mis fondos?" })).toHaveAttribute("href", "/help");
    expect(panel.getByRole("link", { name: "¿Qué es real y qué es simulado?" })).toHaveAttribute("href", "#limites");
  });

  it("shows the disabled question input with its sr-only label and the help-center link", async () => {
    await renderAssistant();
    fireEvent.click(screen.getByRole("button", { name: TOGGLE }));

    const panel = within(screen.getByRole("dialog"));
    const input = panel.getByLabelText("Escribí tu pregunta");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("placeholder", "Escribir pregunta · próximamente");
    expect(panel.getByRole("link", { name: "Ir al centro de ayuda" })).toHaveAttribute("href", "/help");
  });

  it("closes the panel on Escape", async () => {
    await renderAssistant();
    fireEvent.click(screen.getByRole("button", { name: TOGGLE }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: TOGGLE })).toHaveAttribute("aria-expanded", "false");
  });

  it.each(["PYME", "INVERSOR"] as const)(
    "shows the chat to a signed-in %s, replacing the disabled field (S1)",
    async (role) => {
      await renderAssistant(role);
      fireEvent.click(screen.getByRole("button", { name: TOGGLE }));

      const panel = within(screen.getByRole("dialog"));
      // The chat's own input is enabled and the disabled FAQ field is gone.
      expect(panel.getByLabelText(ASSISTANT_COPY.inputLabel)).not.toBeDisabled();
      expect(panel.getByRole("button", { name: ASSISTANT_COPY.send })).toBeInTheDocument();
      expect(panel.getByText(ASSISTANT_COPY.greeting)).toBeInTheDocument();
      expect(panel.queryByText("Próximamente con respuestas de la documentación")).toBeNull();
      // The signed-in header names the documentation source.
      expect(panel.getByText(ASSISTANT_COPY.subtitle)).toBeInTheDocument();
    }
  );

  it.each(["PYME", "INVERSOR"] as const)(
    "keeps the FAQ quick links and «Ir al centro de ayuda» next to the chat for a signed-in %s (#559)",
    async (role) => {
      await renderAssistant(role);
      fireEvent.click(screen.getByRole("button", { name: TOGGLE }));

      const panel = within(screen.getByRole("dialog"));
      expect(panel.getByRole("button", { name: ASSISTANT_COPY.send })).toBeInTheDocument();
      expect(panel.getByRole("link", { name: "¿Qué es el revenue share?" })).toHaveAttribute("href", "/help");
      expect(panel.getByRole("link", { name: "¿Vaqcrow guarda mis fondos?" })).toHaveAttribute("href", "/help");
      expect(panel.getByRole("link", { name: "¿Qué es real y qué es simulado?" })).toHaveAttribute(
        "href",
        "#limites"
      );
      expect(panel.getByRole("link", { name: "Ir al centro de ayuda" })).toHaveAttribute("href", "/help");
      // The anonymous greeting and its disabled field stay out of the chat view:
      // the only question field is the chat's own, enabled one.
      expect(panel.queryByText(/Todavía no estoy conectado/)).toBeNull();
      expect(panel.getByLabelText(ASSISTANT_COPY.inputLabel)).not.toBeDisabled();
      expect(panel.queryByPlaceholderText("Escribir pregunta · próximamente")).toBeNull();
    }
  );

  it("keeps an anonymous visitor on the FAQ view (S2)", async () => {
    await renderAssistant(null);
    fireEvent.click(screen.getByRole("button", { name: TOGGLE }));

    const panel = within(screen.getByRole("dialog"));
    expect(panel.getByLabelText("Escribí tu pregunta")).toBeDisabled();
    expect(panel.queryByRole("button", { name: ASSISTANT_COPY.send })).toBeNull();
    expect(panel.getByText("Próximamente con respuestas de la documentación")).toBeInTheDocument();
  });

  it("keeps an ADMIN on the FAQ view (D7)", async () => {
    await renderAssistant("ADMIN");
    fireEvent.click(screen.getByRole("button", { name: TOGGLE }));

    const panel = within(screen.getByRole("dialog"));
    expect(panel.getByLabelText("Escribí tu pregunta")).toBeDisabled();
    expect(panel.queryByRole("button", { name: ASSISTANT_COPY.send })).toBeNull();
  });
});
