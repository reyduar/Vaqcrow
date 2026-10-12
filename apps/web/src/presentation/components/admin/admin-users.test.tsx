import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it } from "vitest";
import type {
  AdminUser,
  AdminUsersPage,
  AdminUsersQuery,
  AuditLogPage,
  AuditLogQuery,
  ChangeUserRoleCommand,
  ChangeableUserRole,
  InviteOperatorCommand,
  InviteOperatorResult,
  SetUserActiveCommand
} from "@vaqcrow/contracts";
import type {
  AdminUsersMutationResult,
  AdminUsersPageResult,
  AdminUsersPort,
  AuditLogResult,
  InviteOperatorOutcome
} from "@/application/admin/users";
import { AdminUsers } from "./admin-users";

const SELF: AdminUser = {
  userId: "11111111-1111-4111-8111-111111111111",
  displayName: "M. Pereyra",
  email: "m.pereyra@vaqcrow.demo",
  role: "ADMIN",
  status: "active",
  lastActivityAt: "2026-09-13T12:00:00.000Z",
  kycStatus: "not_applicable",
  isSelf: true
};

const INVESTOR: AdminUser = {
  userId: "22222222-2222-4222-8222-222222222222",
  displayName: "Lucía Fernández",
  email: "lucia.f@demo.ar",
  role: "INVERSOR",
  status: "active",
  lastActivityAt: "2026-09-11T12:00:00.000Z",
  kycStatus: "approved_simulated",
  isSelf: false
};

const PYME: AdminUser = {
  userId: "33333333-3333-4333-8333-333333333333",
  displayName: "Panadería Horizonte SRL",
  email: "admin@horizonte.demo",
  role: "PYME",
  status: "inactive",
  lastActivityAt: null,
  kycStatus: "not_started",
  isSelf: false
};

const INVITED: AdminUser = {
  userId: "44444444-4444-4444-8444-444444444444",
  displayName: "L. Gómez",
  email: "l.gomez@vaqcrow.demo",
  role: "ADMIN",
  status: "invited",
  lastActivityAt: null,
  kycStatus: "not_applicable",
  isSelf: false
};

function usersPage(items: AdminUser[], over: Partial<AdminUsersPage> = {}): AdminUsersPageResult {
  return {
    ok: true,
    page: { items, total: over.total ?? items.length, page: over.page ?? 1, pageSize: over.pageSize ?? 20 }
  };
}

function auditPage(items: AuditLogPage["items"], over: Partial<AuditLogPage> = {}): AuditLogResult {
  return { ok: true, page: { items, total: over.total ?? items.length, page: over.page ?? 1, pageSize: over.pageSize ?? 10 } };
}

const AUDIT_ENTRY: AuditLogPage["items"][number] = {
  id: "55555555-5555-4555-8555-555555555555",
  occurredAt: "2026-09-13T09:15:00.000Z",
  actorUserId: "11111111-1111-4111-8111-111111111111",
  actorDisplayName: "M. Pereyra",
  action: "user.deactivated",
  targetType: "user",
  targetId: "22222222-2222-4222-8222-222222222222",
  summary: "M. Pereyra desactivó a Lucía Fernández"
};

interface FakeOptions {
  readonly users?: (query: AdminUsersQuery) => AdminUsersPageResult;
  readonly audit?: (query: AuditLogQuery) => AuditLogResult;
  readonly activation?: AdminUsersMutationResult;
  readonly role?: AdminUsersMutationResult;
  readonly invite?: InviteOperatorOutcome;
}

class FakeAdminUsersPort implements AdminUsersPort {
  readonly listQueries: AdminUsersQuery[] = [];
  readonly auditQueries: AuditLogQuery[] = [];
  readonly activationCalls: SetUserActiveCommand[] = [];
  readonly roleCalls: ChangeUserRoleCommand[] = [];
  readonly inviteCalls: InviteOperatorCommand[] = [];

  constructor(private readonly options: FakeOptions = {}) {}

  async listUsers(query: AdminUsersQuery): Promise<AdminUsersPageResult> {
    this.listQueries.push(query);
    return (this.options.users ?? (() => usersPage([SELF, INVESTOR, PYME, INVITED])))(query);
  }

  async listAudit(query: AuditLogQuery): Promise<AuditLogResult> {
    this.auditQueries.push(query);
    return (this.options.audit ?? (() => auditPage([AUDIT_ENTRY])))(query);
  }

  async setUserActive(_userId: string, command: SetUserActiveCommand): Promise<AdminUsersMutationResult> {
    this.activationCalls.push(command);
    return this.options.activation ?? { ok: true };
  }

  async changeUserRole(_userId: string, command: ChangeUserRoleCommand): Promise<AdminUsersMutationResult> {
    this.roleCalls.push(command);
    return this.options.role ?? { ok: true };
  }

  async inviteOperator(command: InviteOperatorCommand): Promise<InviteOperatorOutcome> {
    this.inviteCalls.push(command);
    return (
      this.options.invite ?? {
        ok: true,
        invitation: { userId: "66666666-6666-4666-8666-666666666666", email: command.email, status: "invited" } as InviteOperatorResult
      }
    );
  }
}

function swr({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function renderUsers(port = new FakeAdminUsersPort()) {
  render(swr({ children: <AdminUsers port={port} /> }));
  return port;
}

describe("AdminUsers", () => {
  it("renders the title, subtitle, table headers and one row per user", async () => {
    renderUsers();

    expect(await screen.findByRole("heading", { level: 1, name: "Usuarios" })).toBeInTheDocument();
    expect(
      screen.getByText("Roles y acceso. Los cambios de rol piden confirmación y quedan auditados.")
    ).toBeInTheDocument();
    for (const header of ["Usuario", "Rol", "Estado", "Última actividad", "Acciones"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    const investorRow = await screen.findByRole("row", { name: /Lucía Fernández/ });
    expect(within(investorRow).getByText("lucia.f@demo.ar")).toBeInTheDocument();
    expect(within(investorRow).getByText("Inversor")).toBeInTheDocument();
    expect(screen.getByText("Panadería Horizonte SRL")).toBeInTheDocument();
    expect(screen.getByText("11/09/2026")).toBeInTheDocument();
    expect(screen.getAllByText("Sin actividad")).toHaveLength(2);
  });

  it("labels the simulated KYC read-only, honestly", async () => {
    renderUsers();
    expect(await screen.findByText("KYC aprobado (simulado)")).toBeInTheDocument();
    expect(screen.getByText("KYC sin iniciar")).toBeInTheDocument();
    expect(screen.getAllByText("KYC no aplica").length).toBeGreaterThan(0);
  });

  it("shows 'Tu cuenta' on the signed-in admin's row and no toggle", async () => {
    renderUsers();
    await screen.findByText("M. Pereyra");
    expect(screen.getByText("Tu cuenta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Desactivar a M\. Pereyra/ })).toBeNull();
  });

  it("offers Desactivar on an active row, Activar on an inactive one and no action on an invited one", async () => {
    renderUsers();
    await screen.findByText("Lucía Fernández");
    expect(screen.getByRole("button", { name: "Desactivar a Lucía Fernández" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activar a Panadería Horizonte SRL" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /a L\. Gómez/ })).toBeNull();
  });

  it("confirms a deactivation through the template's alertdialog before acting", async () => {
    const port = renderUsers();
    await screen.findByText("Lucía Fernández");

    fireEvent.click(screen.getByRole("button", { name: "Desactivar a Lucía Fernández" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Desactivar a Lucía Fernández")).toBeInTheDocument();
    expect(within(dialog).getByText("Pierde el acceso. Sus aportes y campañas no se modifican.")).toBeInTheDocument();
    expect(port.activationCalls).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(port.activationCalls).toEqual([{ active: false }]));
  });

  it("does not act when the alertdialog is cancelled", async () => {
    const port = renderUsers();
    await screen.findByText("Lucía Fernández");

    fireEvent.click(screen.getByRole("button", { name: "Desactivar a Lucía Fernández" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(port.activationCalls).toHaveLength(0);
  });

  it("changes a role through the confirmation, targeting only the other role", async () => {
    const port = renderUsers();
    await screen.findByText("Lucía Fernández");

    fireEvent.click(screen.getByRole("button", { name: "Cambiar rol de Lucía Fernández" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Cambiar rol de Lucía Fernández")).toBeInTheDocument();
    expect(within(dialog).getByText("Su cuenta pasa a PyME. El cambio queda auditado.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(port.roleCalls).toEqual([{ role: "PYME" }]));
  });

  it("never offers a role change on an admin row", async () => {
    renderUsers();
    await screen.findByText("M. Pereyra");
    expect(screen.queryByRole("button", { name: "Cambiar rol de M. Pereyra" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cambiar rol de L. Gómez" })).toBeNull();
  });

  it("surfaces a sanitized self-deactivation conflict", async () => {
    const port = renderUsers(new FakeAdminUsersPort({ activation: { ok: false, code: "self" } }));
    await screen.findByText("Lucía Fernández");

    fireEvent.click(screen.getByRole("button", { name: "Desactivar a Lucía Fernández" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No podés desactivar tu propia cuenta.");
  });

  it("invites an operator by email and shows the success state", async () => {
    const port = renderUsers();
    await screen.findByText("Lucía Fernández");

    fireEvent.click(screen.getByRole("button", { name: "Invitar operador" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Correo"), { target: { value: "nuevo@vaqcrow.demo" } });
    fireEvent.submit(within(dialog).getByRole("button", { name: "Enviar invitación" }).closest("form") as HTMLFormElement);

    expect(await within(dialog).findByText("Invitación enviada a nuevo@vaqcrow.demo.")).toBeInTheDocument();
    expect(port.inviteCalls).toEqual([{ email: "nuevo@vaqcrow.demo" }]);
  });

  it("shows the invitation error copy and rejects an invalid email before calling", async () => {
    const port = renderUsers(new FakeAdminUsersPort({ invite: { ok: false, code: "email_exists" } }));
    await screen.findByText("Lucía Fernández");

    fireEvent.click(screen.getByRole("button", { name: "Invitar operador" }));
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Correo"), { target: { value: "nope" } });
    fireEvent.submit(within(dialog).getByRole("button", { name: "Enviar invitación" }).closest("form") as HTMLFormElement);
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Ingresá un correo válido.");
    expect(port.inviteCalls).toHaveLength(0);

    fireEvent.change(within(dialog).getByLabelText("Correo"), { target: { value: "dup@vaqcrow.demo" } });
    fireEvent.submit(within(dialog).getByRole("button", { name: "Enviar invitación" }).closest("form") as HTMLFormElement);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ya existe una cuenta con ese correo.");
  });

  it("searches through the port and resets to the first page", async () => {
    const port = renderUsers(
      new FakeAdminUsersPort({
        users: (query) => (query.search === "Lucía" ? usersPage([INVESTOR]) : usersPage([SELF, INVESTOR]))
      })
    );
    await screen.findByText("M. Pereyra");

    const input = screen.getByRole("searchbox", { name: "Buscar usuarios" });
    fireEvent.change(input, { target: { value: "Lucía" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => expect(port.listQueries.at(-1)?.search).toBe("Lucía"));
    expect(port.listQueries.at(-1)?.page).toBe(1);
    expect(screen.queryByText("M. Pereyra")).toBeNull();
  });

  it("drives the role and status filters and paging server-side", async () => {
    const port = renderUsers(
      new FakeAdminUsersPort({ users: (query) => usersPage([PYME], { page: query.page, total: 41 }) })
    );
    await screen.findByText("Panadería Horizonte SRL");

    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "PYME" } });
    await waitFor(() => expect(port.listQueries.at(-1)?.role).toBe("PYME"));

    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "inactive" } });
    await waitFor(() => expect(port.listQueries.at(-1)?.status).toBe("inactive"));

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(port.listQueries.at(-1)?.page).toBe(2));
  });

  it("shows a sanitized error and recovers through retry", async () => {
    let calls = 0;
    const port = renderUsers(
      new FakeAdminUsersPort({
        users: () => {
          calls += 1;
          return calls === 1 ? { ok: false, code: "unavailable" } : usersPage([INVESTOR]);
        }
      })
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos cargar los datos.");
    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Lucía Fernández")).toBeInTheDocument();
    void port;
  });

  it("renders the audit log and searches it", async () => {
    const port = renderUsers(
      new FakeAdminUsersPort({
        audit: (query) => (query.search === "rol" ? auditPage([AUDIT_ENTRY]) : auditPage([AUDIT_ENTRY]))
      })
    );

    expect(await screen.findByRole("heading", { level: 2, name: "Registro de auditoría" })).toBeInTheDocument();
    expect(await screen.findByText("M. Pereyra desactivó a Lucía Fernández")).toBeInTheDocument();

    const input = screen.getByRole("searchbox", { name: "Buscar en la auditoría" });
    fireEvent.change(input, { target: { value: "rol" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await waitFor(() => expect(port.auditQueries.at(-1)?.search).toBe("rol"));
  });

  it("shows an honest empty state", async () => {
    renderUsers(new FakeAdminUsersPort({ users: () => usersPage([]) }));
    expect(await screen.findByText("No hay usuarios.")).toBeInTheDocument();
  });
});
