import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvitationCredentialPort } from "@/application/ports/invitation-credential-port";
import type { OperatorInvitationPort } from "@/application/ports/operator-invitation-port";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";
import {
  AcceptInvitationScreen,
  type AcceptInvitationScreenProps
} from "./accept-invitation-screen";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const EMAIL = "op@vaqcrow.test";
const PASSWORD = "secret-123";

function credential(overrides: Partial<InvitationCredentialPort> = {}): InvitationCredentialPort {
  return { setPassword: vi.fn().mockResolvedValue({ ok: true }), ...overrides };
}

function gateway(overrides: Partial<OperatorInvitationPort> = {}): OperatorInvitationPort {
  return { accept: vi.fn().mockResolvedValue({ ok: true }), ...overrides };
}

async function renderScreen(props: AcceptInvitationScreenProps, signedIn: boolean) {
  const fake = new FakeAuthSession();
  fake.seedAccount({ email: EMAIL, password: PASSWORD, role: "ADMIN", displayName: "Operador invitado" });
  if (signedIn) await fake.signIn({ email: EMAIL, password: PASSWORD });
  const view = render(
    <SessionStoreProvider port={fake}>
      <AcceptInvitationScreen {...props} />
    </SessionStoreProvider>
  );
  if (signedIn) await screen.findByRole("heading", { level: 1, name: "Activá tu cuenta de operador" });
  return view;
}

function fillForm(name = "Ana Operadora", password = PASSWORD, confirm = PASSWORD) {
  fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Repetí la contraseña"), { target: { value: confirm } });
}

beforeEach(() => {
  push.mockReset();
});

describe("AcceptInvitationScreen", () => {
  it("shows the missing-session state and no form when the invitee holds no session", async () => {
    await renderScreen({ credential: credential(), gateway: gateway() }, false);

    expect(await screen.findByText("Tu invitación no está activa")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a ingresar" })).toHaveAttribute("href", "/login");
    expect(screen.queryByLabelText("Nombre completo")).toBeNull();
  });

  it("renders the form for a signed-in invitee", async () => {
    await renderScreen({ credential: credential(), gateway: gateway() }, true);

    expect(screen.getByLabelText("Nombre completo")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByLabelText("Repetí la contraseña")).toBeInTheDocument();
  });

  it("sets the password client-side, then the display name through the API, then sends the operator to /admin", async () => {
    const cred = credential();
    const api = gateway();
    await renderScreen({ credential: cred, gateway: api }, true);

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Activar mi cuenta" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
    expect(cred.setPassword).toHaveBeenCalledExactlyOnceWith(PASSWORD);
    expect(api.accept).toHaveBeenCalledExactlyOnceWith({ displayName: "Ana Operadora" });
  });

  it("never calls the API or navigates when the password step fails, and shows its copy", async () => {
    const cred = credential({ setPassword: vi.fn().mockResolvedValue({ ok: false, code: "weak_password" }) });
    const api = gateway();
    await renderScreen({ credential: cred, gateway: api }, true);

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Activar mi cuenta" }));

    expect(await screen.findByText("No pudimos guardar tu contraseña.")).toBeInTheDocument();
    expect(api.accept).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("never fakes success when the API call fails, and says the password was already saved", async () => {
    const api = gateway({ accept: vi.fn().mockResolvedValue({ ok: false, code: "unavailable" }) });
    await renderScreen({ credential: credential(), gateway: api }, true);

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Activar mi cuenta" }));

    expect(await screen.findByText("No pudimos guardar tu nombre.")).toBeInTheDocument();
    expect(screen.getByText("Tu contraseña ya quedó guardada; solo falta tu nombre.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("blocks the submit on a short or mismatched password, touching no port", async () => {
    const cred = credential();
    const api = gateway();
    await renderScreen({ credential: cred, gateway: api }, true);

    fillForm("Ana", PASSWORD, "different-123");
    fireEvent.click(screen.getByRole("button", { name: "Activar mi cuenta" }));

    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(cred.setPassword).not.toHaveBeenCalled();
    expect(api.accept).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
