import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import { ASSISTANT_COPY } from "@/application/assistant/copy";
import { HELP_COPY } from "@/application/help/faq";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/help"
}));

import { HelpContent } from "./help-content";

const EMAIL = "persona@example.test";
const PASSWORD = "secret-123";

/**
 * `/help` content (#499/WU3): the same chat the floating assistant mounts, shown
 * to a signed-in PYME/INVERSOR; an anonymous visitor keeps exactly today's
 * FAQ-only page. The chat's port is the null object without an API base URL.
 */
async function renderContent(role: PrincipalRole | null = null) {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
  const fake = new FakeAuthSession();
  if (role) {
    fake.seedAccount({ email: EMAIL, password: PASSWORD, role, displayName: "Cuenta" });
    await fake.signIn({ email: EMAIL, password: PASSWORD });
  }
  render(
    <SessionStoreProvider port={fake}>
      <HelpContent />
    </SessionStoreProvider>
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("HelpContent (#499, D7)", () => {
  it("keeps the anonymous visitor on the FAQ-only page (S2)", async () => {
    await renderContent(null);

    expect(screen.getByRole("heading", { level: 1, name: HELP_COPY.hero.title })).toBeInTheDocument();
    expect(screen.queryByLabelText(ASSISTANT_COPY.inputLabel)).toBeNull();
  });

  it.each(["PYME", "INVERSOR"] as const)("adds the chat for a signed-in %s (S1)", async (role) => {
    await renderContent(role);

    // The chat is present and enabled, and the FAQ explorer stays.
    expect(await screen.findByLabelText(ASSISTANT_COPY.inputLabel)).not.toBeDisabled();
    expect(screen.getByRole("button", { name: ASSISTANT_COPY.send })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: HELP_COPY.hero.title })).toBeInTheDocument();
  });

  it("does not show the chat to an ADMIN (D7)", async () => {
    await renderContent("ADMIN");

    // The session settles to ADMIN; the chat never appears.
    await screen.findByRole("heading", { level: 1, name: HELP_COPY.hero.title });
    expect(screen.queryByLabelText(ASSISTANT_COPY.inputLabel)).toBeNull();
  });
});
