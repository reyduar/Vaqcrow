import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCEPT_INVITATION_PATH } from "@/application/auth/accept-invitation";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";
import AcceptInvitationPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const EMAIL = "op@vaqcrow.test";
const PASSWORD = "secret-123";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The route must serve the exact path the invite email's redirectTo points at. */
describe("/accept-invitation route (#390/WU5)", () => {
  it("serves the acceptance path the invite email links to", () => {
    expect(ACCEPT_INVITATION_PATH).toBe("/accept-invitation");
  });

  it("stays honest with no session: the missing-invitation state, never a fake form", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    render(
      <SessionStoreProvider port={new FakeAuthSession()}>
        <AcceptInvitationPage />
      </SessionStoreProvider>
    );

    expect(await screen.findByText("Tu invitación no está activa")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Activá tu cuenta de operador" })).toBeNull();
  });

  it("renders the acceptance form for a signed-in invitee", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    const fake = new FakeAuthSession();
    fake.seedAccount({ email: EMAIL, password: PASSWORD, role: "ADMIN", displayName: "Operador invitado" });
    await fake.signIn({ email: EMAIL, password: PASSWORD });

    render(
      <SessionStoreProvider port={fake}>
        <AcceptInvitationPage />
      </SessionStoreProvider>
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Activá tu cuenta de operador" })
    ).toBeInTheDocument();
  });
});
