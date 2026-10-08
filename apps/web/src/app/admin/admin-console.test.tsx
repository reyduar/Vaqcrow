import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queueDisplayState } from "@/application/admin/queue";
import type {
  AdminQueueItem,
  AdminQueuePage,
  AdminQueuePort,
  AdminQueueQuery,
  AdminQueueResult
} from "@/application/ports/admin-queue-port";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import { AdminShell } from "@/presentation/components/admin/admin-shell";
import { PymesQueue } from "@/presentation/components/admin/pymes-queue";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";
import AdminConsoleLayout from "./(console)/layout";
import AdminLoginPage from "./page";

const { pathname, push, replace } = vi.hoisted(() => ({
  pathname: { current: "/admin" },
  push: vi.fn(),
  replace: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => pathname.current
}));

function item(overrides: Partial<AdminQueueItem> = {}): AdminQueueItem {
  return {
    applicationId: "VQ-0001",
    name: "Panadería Horizonte SRL",
    sector: "Alimentos",
    state: "awaiting_assessment",
    updatedAt: "2026-09-11T12:00:00.000Z",
    ...overrides
  };
}

const PENDING = item();
const CHANGES = item({ applicationId: "VQ-0002", name: "Taller Delta", sector: "Servicio automotor", state: "changes_requested", updatedAt: "2026-09-09T12:00:00.000Z" });
const APPROVED = item({ applicationId: "VQ-0003", name: "Café Tostadero", sector: "Gastronomía", state: "approved", updatedAt: "2026-09-13T12:00:00.000Z" });
const REJECTED = item({ applicationId: "VQ-0004", name: "Gimnasio Forja", sector: "Salud y deporte", state: "rejected", updatedAt: "2026-09-02T12:00:00.000Z" });
const MISSING = item({ applicationId: "VQ-0005", name: "Sin dato", sector: "Sin dato", state: "awaiting_assessment", updatedAt: "2026-09-01T12:00:00.000Z" });

/** A test-only default for the global counts, derived from the page for convenience. */
function countsOf(items: readonly AdminQueueItem[]): AdminQueuePage["counts"] {
  const counts = { pending: 0, changes: 0, approved: 0, rejected: 0 };
  for (const entry of items) counts[queueDisplayState(entry.state)] += 1;
  return counts;
}

function pageOf(items: readonly AdminQueueItem[], over: Partial<AdminQueuePage> = {}): AdminQueueResult {
  return {
    ok: true,
    page: {
      items,
      page: over.page ?? 1,
      pageSize: over.pageSize ?? 20,
      total: over.total ?? items.length,
      counts: over.counts ?? countsOf(items)
    }
  };
}

class FakeAdminQueuePort implements AdminQueuePort {
  readonly queries: AdminQueueQuery[] = [];
  constructor(private readonly respond: (query: AdminQueueQuery) => AdminQueueResult) {}
  async list(query: AdminQueueQuery): Promise<AdminQueueResult> {
    this.queries.push(query);
    return this.respond(query);
  }
}

function swr({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function adminSession(): FakeAuthSession {
  const fake = new FakeAuthSession();
  fake.seedAccount({ email: "op@vaqcrow.test", password: "secret-123", role: "ADMIN", displayName: "Admin Vaqcrow" });
  return fake;
}

beforeEach(() => {
  pathname.current = "/admin";
  push.mockClear();
  replace.mockClear();
});

describe("/admin login", () => {
  it("shows the designed login view without the template's demo sign-in note", async () => {
    render(<SessionStoreProvider port={new FakeAuthSession()}>{AdminLoginPage()}</SessionStoreProvider>, {
      wrapper: swr
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Ingresar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Correo")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeInTheDocument();
    expect(
      screen.getByText("Solo cuentas de operador creadas por el equipo. No hay registro público.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/cualquier correo y contraseña/i)).not.toBeInTheDocument();
  });

  it("shows the quoted wrong-credentials error and keeps no session", async () => {
    const fake = adminSession();
    render(<SessionStoreProvider port={fake}>{AdminLoginPage()}</SessionStoreProvider>, { wrapper: swr });
    await screen.findByRole("heading", { level: 1, name: "Ingresar" });

    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "op@vaqcrow.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "wrong-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
    expect(push).not.toHaveBeenCalled();
  });

  it("rejects a non-admin account without revealing the console", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount({ email: "inv@vaqcrow.test", password: "secret-123", role: "INVERSOR", displayName: "Inversora" });
    render(<SessionStoreProvider port={fake}>{AdminLoginPage()}</SessionStoreProvider>, { wrapper: swr });
    await screen.findByRole("heading", { level: 1, name: "Ingresar" });

    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "inv@vaqcrow.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "secret-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
    expect(push).not.toHaveBeenCalled();
    await waitFor(async () => expect(await fake.getSession()).toEqual({ status: "signed-out" }));
  });

  it("sends a verified ADMIN into the queue", async () => {
    const fake = adminSession();
    render(<SessionStoreProvider port={fake}>{AdminLoginPage()}</SessionStoreProvider>, { wrapper: swr });
    await screen.findByRole("heading", { level: 1, name: "Ingresar" });

    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "op@vaqcrow.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "secret-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/pymes"));
  });

  it("sends a signed-in ADMIN visiting /admin straight to the queue", async () => {
    const fake = adminSession();
    await fake.signIn({ email: "op@vaqcrow.test", password: "secret-123" });
    render(<SessionStoreProvider port={fake}>{AdminLoginPage()}</SessionStoreProvider>, { wrapper: swr });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/pymes"));
  });
});

describe("admin console guard", () => {
  async function renderConsole(role: PrincipalRole | null, fake = new FakeAuthSession()) {
    if (role) {
      fake.seedAccount({ email: "person@vaqcrow.test", password: "secret-123", role, displayName: "Persona Demo" });
      await fake.signIn({ email: "person@vaqcrow.test", password: "secret-123" });
    }
    pathname.current = "/admin/pymes";
    render(
      <SessionStoreProvider port={fake}>
        {AdminConsoleLayout({ children: <p>Contenido de consola</p> })}
      </SessionStoreProvider>,
      { wrapper: swr }
    );
    return fake;
  }

  it("denies a signed-out visitor without rendering the console", async () => {
    await renderConsole(null);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    expect(screen.queryByText("Vaqcrow Admin")).not.toBeInTheDocument();
  });

  it("denies a signed-in non-admin without revealing the console", async () => {
    await renderConsole("PYME");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    expect(screen.queryByText("Vaqcrow Admin")).not.toBeInTheDocument();
  });

  it("renders the shell for a verified ADMIN", async () => {
    pathname.current = "/admin/pymes";
    const fake = adminSession();
    await fake.signIn({ email: "op@vaqcrow.test", password: "secret-123" });
    render(
      <SessionStoreProvider port={fake}>
        <AdminShell queuePort={new FakeAdminQueuePort(() => pageOf([PENDING]))}>
          <p>Contenido de consola</p>
        </AdminShell>
      </SessionStoreProvider>,
      { wrapper: swr }
    );

    expect(await screen.findByText("Vaqcrow Admin")).toBeInTheDocument();
    expect(screen.getByText("Contenido de consola")).toBeInTheDocument();
  });
});

describe("admin shell", () => {
  async function renderShell() {
    pathname.current = "/admin/pymes";
    const fake = adminSession();
    await fake.signIn({ email: "op@vaqcrow.test", password: "secret-123" });
    const queue = new FakeAdminQueuePort(() =>
      pageOf([PENDING, APPROVED], { counts: { pending: 9, changes: 0, approved: 1, rejected: 0 } })
    );
    render(
      <SessionStoreProvider port={fake}>
        <AdminShell queuePort={queue}>
          <p>Contenido</p>
        </AdminShell>
      </SessionStoreProvider>,
      { wrapper: swr }
    );
    return fake;
  }

  it("renders the brand, nav, chip with the role line and logout", async () => {
    await renderShell();

    expect(await screen.findByText("Vaqcrow Admin")).toBeInTheDocument();
    expect(screen.getByText("TESTNET · DEMO")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PyMEs/ })).toHaveAttribute("href", "/admin/pymes");
    expect(await screen.findByText("Admin Vaqcrow")).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Tema" })).toBeInTheDocument();
  });

  it("shows the global pending count on the PyMEs nav item, not the loaded page", async () => {
    await renderShell();
    const link = await screen.findByRole("link", { name: /PyMEs/ });
    // The page holds one pending row, but the server reports nine: the badge is global.
    expect(await within(link).findByText("9")).toBeInTheDocument();
  });

  it("renders Usuarios as an inert nav item instead of a dead link", async () => {
    await renderShell();
    expect(screen.queryByRole("link", { name: /Usuarios/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Usuarios/ })).toBeDisabled();
  });

  it("closes the session and returns to the admin login", async () => {
    const fake = await renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
    expect(await fake.getSession()).toEqual({ status: "signed-out" });
  });
});

describe("PyMEs queue", () => {
  function renderQueue(respond: AdminQueueResult | ((query: AdminQueueQuery) => AdminQueueResult)) {
    const queue = new FakeAdminQueuePort(typeof respond === "function" ? respond : () => respond);
    render(swr({ children: <PymesQueue port={queue} /> }));
    return queue;
  }

  it("renders the title, subtitle, states and row actions", async () => {
    renderQueue(pageOf([PENDING, CHANGES, APPROVED, REJECTED]));

    expect(await screen.findByRole("heading", { level: 1, name: "PyMEs" })).toBeInTheDocument();
    expect(
      screen.getByText("Solicitudes y campañas registradas. Toda decisión queda atribuida.")
    ).toBeInTheDocument();
    expect(await screen.findByText("Pendiente de revisión")).toBeInTheDocument();
    expect(screen.getByText("Requiere cambios")).toBeInTheDocument();
    expect(screen.getByText("Aprobada")).toBeInTheDocument();
    expect(screen.getByText("Rechazada")).toBeInTheDocument();
    expect(screen.getByText("VQ-0001")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Revisar solicitud" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Ver detalle" })).toHaveLength(3);
  });

  it("links every row action to that application's review", async () => {
    renderQueue(pageOf([PENDING, CHANGES]));

    expect(await screen.findByRole("link", { name: "Revisar solicitud" })).toHaveAttribute(
      "href",
      "/admin/pymes/VQ-0001"
    );
    expect(screen.getByRole("link", { name: "Ver detalle" })).toHaveAttribute("href", "/admin/pymes/VQ-0002");
  });

  it("drives the KPI numbers from the global server counts, not the loaded page", async () => {
    renderQueue(pageOf([PENDING], { counts: { pending: 7, changes: 3, approved: 5, rejected: 2 } }));

    const kpi = await screen.findByRole("button", { name: /Pendientes de revisión/ });
    expect(within(kpi).getByText("7")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /Requieren cambios/ })).getByText("3")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /Aprobadas/ })).getByText("5")).toBeInTheDocument();
  });

  it("sets the server-side state filter through a KPI card and clears it on a second click", async () => {
    const queue = renderQueue((query) =>
      query.state === "pending"
        ? pageOf([PENDING], { counts: { pending: 1, changes: 1, approved: 1, rejected: 1 } })
        : pageOf([PENDING, APPROVED], { counts: { pending: 1, changes: 0, approved: 1, rejected: 0 } })
    );
    await screen.findByText("Panadería Horizonte SRL");
    const kpi = await screen.findByRole("button", { name: /Pendientes de revisión/ });
    expect(kpi).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(kpi);
    expect(kpi).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(queue.queries.at(-1)?.state).toBe("pending"));
    expect(queue.queries.at(-1)?.page).toBe(1);
    expect(await screen.findByText("Panadería Horizonte SRL")).toBeInTheDocument();
    expect(screen.queryByText("Café Tostadero")).not.toBeInTheDocument();

    fireEvent.click(kpi);
    expect(kpi).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(queue.queries.at(-1)?.state).toBeUndefined());
    expect(await screen.findByText("Café Tostadero")).toBeInTheDocument();
  });

  it("searches through the port and resets to the first page", async () => {
    const queue = renderQueue((query) =>
      query.search === "VQ-0002" ? pageOf([CHANGES]) : pageOf([PENDING, CHANGES])
    );
    await screen.findByText("Panadería Horizonte SRL");

    const input = screen.getByRole("searchbox", { name: "Buscar PyMEs" });
    fireEvent.change(input, { target: { value: "VQ-0002" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => expect(queue.queries.at(-1)?.search).toBe("VQ-0002"));
    expect(queue.queries.at(-1)?.page).toBe(1);
    expect(await screen.findByText("Taller Delta")).toBeInTheDocument();
    expect(screen.queryByText("Panadería Horizonte SRL")).not.toBeInTheDocument();
  });

  it("paginates and sorts server-side", async () => {
    const queue = renderQueue((query) =>
      pageOf(query.page === 1 ? [PENDING] : [CHANGES], { page: query.page, total: 21 })
    );
    await screen.findByText("Panadería Horizonte SRL");

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(queue.queries.at(-1)?.page).toBe(2));
    expect(await screen.findByText("Taller Delta")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Último cambio" }));
    await waitFor(() => expect(queue.queries.at(-1)?.order).toBe("asc"));
    expect(queue.queries.at(-1)?.sort).toBe("updatedAt");
  });

  it("shows an honest empty state", async () => {
    renderQueue(pageOf([]));
    expect(await screen.findByText("No hay solicitudes.")).toBeInTheDocument();
  });

  it("shows a sanitized error and recovers through retry", async () => {
    let calls = 0;
    const queue = renderQueue(() => {
      calls += 1;
      return calls === 1 ? { ok: false, code: "unavailable" } : pageOf([PENDING]);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar las solicitudes.");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Panadería Horizonte SRL")).toBeInTheDocument();
    void queue;
  });

  it("renders the honest 'Sin dato' for an application without a business", async () => {
    renderQueue(pageOf([MISSING]));
    expect((await screen.findAllByText("Sin dato")).length).toBeGreaterThan(0);
  });
});
