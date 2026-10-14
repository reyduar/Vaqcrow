"use client";

import { useState, type FormEvent } from "react";
import {
  IoCheckmarkCircleOutline,
  IoMailOutline,
  IoPauseCircleOutline,
  IoPersonAddOutline,
  IoSearchOutline
} from "react-icons/io5";
import type { IconType } from "react-icons";
import useSWR from "swr";
import type {
  AdminUser,
  AdminUserRole,
  AdminUserStatus,
  AdminUsersPage,
  AdminUsersQuery,
  AuditLogPage,
  AuditLogQuery
} from "@vaqcrow/contracts";
import {
  activateConfirmCopy,
  auditQueryWithPage,
  auditQueryWithSearch,
  chatAccessConfirmCopy,
  chatAccessControlLabel,
  DEFAULT_ADMIN_AUDIT_QUERY,
  DEFAULT_ADMIN_USERS_QUERY,
  deactivateConfirmCopy,
  formatAuditTimestamp,
  formatLastActivityAt,
  KYC_COPY,
  MUTATION_ERROR_COPY,
  READ_ERROR_COPY,
  roleChangeConfirmCopy,
  roleChangeLabel,
  roleChangeTarget,
  ROLE_FILTERS,
  ROLE_LABEL,
  STATUS_FILTERS,
  totalPages,
  USER_STATUS_COPY,
  userActivationControl,
  usersQueryWithPage,
  usersQueryWithRole,
  usersQueryWithSearch,
  usersQueryWithStatus,
  type AdminUsersMutationResult,
  type AdminUsersPort
} from "@/application/admin/users";
import { createBrowserAdminUsersPort } from "@/infrastructure/admin/create-admin-users-port";
import { Badge } from "../badge";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
const INPUT = "h-11 rounded-control border border-control bg-transparent px-3 text-text-primary";

const STATUS_ICON: Readonly<Record<AdminUserStatus, IconType>> = {
  active: IoCheckmarkCircleOutline,
  inactive: IoPauseCircleOutline,
  invited: IoMailOutline
};

const STATUS_TEXT: Readonly<Record<"success" | "info" | "neutral", string>> = {
  success: "text-trust-success",
  info: "text-trust-info",
  neutral: "text-text-secondary"
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class AdminUsersLoadError extends Error {
  constructor(readonly code: string) {
    super(`admin users request failed: ${code}`);
    this.name = "AdminUsersLoadError";
  }
}

async function loadUsers(port: AdminUsersPort, query: AdminUsersQuery): Promise<AdminUsersPage> {
  const result = await port.listUsers(query);
  if (!result.ok) throw new AdminUsersLoadError(result.code);
  return result.page;
}

async function loadAudit(port: AdminUsersPort, query: AuditLogQuery): Promise<AuditLogPage> {
  const result = await port.listAudit(query);
  if (!result.ok) throw new AdminUsersLoadError(result.code);
  return result.page;
}

interface ConfirmRequest {
  readonly title: string;
  readonly body: string;
  readonly run: () => Promise<AdminUsersMutationResult>;
}

type InviteOutcome =
  | { readonly kind: "success"; readonly email: string }
  | { readonly kind: "error"; readonly message: string };

export interface AdminUsersProps {
  /** Injected in tests; production builds the browser port once. */
  readonly port?: AdminUsersPort;
}

/**
 * `/admin/users`: the Usuarios view of `Vaqcrow Admin.dc.html` (view `users`).
 *
 * The table renders the template's Usuario/Rol/Estado/Última actividad/Acciones
 * columns; search, the role/status filters, paging and the audit log are
 * server-side. Every confirm-then-act (deactivate/activate, role change) opens
 * the template's `alertdialog`. The Rol cell carries the PYME ↔ INVERSOR
 * role-change control (never ADMIN); the Usuario cell carries the read-only
 * simulated-KYC badge (D3); the signed-in admin's own row reads "Tu cuenta" and
 * is never toggled; an `invited` account gets no row action the template does
 * not design. The "Invitar operador" dialog is email-only.
 */
export function AdminUsers({ port }: AdminUsersProps) {
  const [resolvedPort] = useState<AdminUsersPort>(() => port ?? createBrowserAdminUsersPort());
  const [query, setQuery] = useState<AdminUsersQuery>(DEFAULT_ADMIN_USERS_QUERY);
  const [searchInput, setSearchInput] = useState("");
  const [auditQuery, setAuditQuery] = useState<AuditLogQuery>(DEFAULT_ADMIN_AUDIT_QUERY);
  const [auditSearchInput, setAuditSearchInput] = useState("");
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteOutcome, setInviteOutcome] = useState<InviteOutcome | null>(null);

  const users = useSWR<AdminUsersPage>(["admin-users", query], () => loadUsers(resolvedPort, query), {
    shouldRetryOnError: false,
    revalidateOnFocus: false
  });
  const audit = useSWR<AuditLogPage>(["admin-audit", auditQuery], () => loadAudit(resolvedPort, auditQuery), {
    shouldRetryOnError: false,
    revalidateOnFocus: false
  });

  const items = users.data?.items ?? [];
  const usersPages = users.data ? totalPages(users.data.total, users.data.pageSize) : 1;
  const auditItems = audit.data?.items ?? [];
  const auditPages = audit.data ? totalPages(audit.data.total, audit.data.pageSize) : 1;
  const hasFilterOrSearch = query.search !== undefined || query.role !== undefined || query.status !== undefined;

  function askSetActive(user: AdminUser, nextActive: boolean) {
    const copy = nextActive ? activateConfirmCopy(user.displayName) : deactivateConfirmCopy(user.displayName);
    setConfirm({ ...copy, run: () => resolvedPort.setUserActive(user.userId, { active: nextActive }) });
  }

  function askRoleChange(user: AdminUser) {
    const target = roleChangeTarget(user.role);
    if (!target) return;
    setConfirm({
      ...roleChangeConfirmCopy(user.displayName, target),
      run: () => resolvedPort.changeUserRole(user.userId, { role: target })
    });
  }

  /** The per-user assistant access toggle (#499, D9), off by default. */
  function askChatAccess(user: AdminUser) {
    const nextEnabled = !user.chatEnabled;
    setConfirm({
      ...chatAccessConfirmCopy(user.displayName, nextEnabled),
      run: () => resolvedPort.setChatAccess(user.userId, { enabled: nextEnabled })
    });
  }

  async function runConfirm() {
    if (!confirm) return;
    setConfirmPending(true);
    const result = await confirm.run();
    setConfirmPending(false);
    setConfirm(null);
    if (!result.ok) {
      setActionError(MUTATION_ERROR_COPY[result.code]);
      return;
    }
    setActionError(null);
    await Promise.all([users.mutate(), audit.mutate()]);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery((current) => usersQueryWithSearch(current, searchInput));
  }

  function submitAuditSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuditQuery((current) => auditQueryWithSearch(current, auditSearchInput));
  }

  function openInvite() {
    setInviteEmail("");
    setInviteOutcome(null);
    setInviteOpen(true);
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = inviteEmail.trim();
    if (!EMAIL_PATTERN.test(email)) {
      setInviteOutcome({ kind: "error", message: "Ingresá un correo válido." });
      return;
    }
    setInviteSending(true);
    setInviteOutcome(null);
    const result = await resolvedPort.inviteOperator({ email });
    setInviteSending(false);
    if (result.ok) {
      setInviteOutcome({ kind: "success", email: result.invitation.email });
      await users.mutate();
    } else {
      setInviteOutcome({ kind: "error", message: MUTATION_ERROR_COPY[result.code] });
    }
  }

  const usersEmptyMessage = hasFilterOrSearch
    ? "No hay usuarios que coincidan con la búsqueda o el filtro."
    : "No hay usuarios.";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[clamp(30px,4vw,40px)] leading-[1.1] font-bold tracking-[-0.03em]">Usuarios</h1>
          <p className="m-0 text-text-secondary">
            Roles y acceso. Los cambios de rol piden confirmación y quedan auditados.
          </p>
        </div>
        <button
          type="button"
          onClick={openInvite}
          className={`flex h-[46px] items-center gap-2 rounded-control bg-brand-accent px-4 text-[15px] font-semibold text-on-accent hover:bg-brand-accent-hover ${FOCUS_RING}`}
        >
          <IoPersonAddOutline aria-hidden="true" focusable="false" className="text-[18px]" />
          Invitar operador
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form
          role="search"
          onSubmit={submitSearch}
          className="flex h-12 basis-[320px] items-center gap-2.5 rounded-control border border-control px-3.5"
        >
          <IoSearchOutline aria-hidden="true" focusable="false" className="shrink-0 text-[19px] text-text-secondary" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar por nombre o correo"
            aria-label="Buscar usuarios"
            className="flex-1 border-0 bg-transparent text-text-primary outline-none"
          />
        </form>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          Rol
          <select
            value={query.role ?? ""}
            onChange={(event) =>
              setQuery((current) =>
                usersQueryWithRole(current, event.target.value === "" ? null : (event.target.value as AdminUserRole))
              )
            }
            className={INPUT}
          >
            <option value="">Todos</option>
            {ROLE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          Estado
          <select
            value={query.status ?? ""}
            onChange={(event) =>
              setQuery((current) =>
                usersQueryWithStatus(
                  current,
                  event.target.value === "" ? null : (event.target.value as AdminUserStatus)
                )
              )
            }
            className={INPUT}
          >
            <option value="">Todos</option>
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {actionError ? (
        <p role="alert" className="m-0 text-sm font-medium text-trust-critical">
          {actionError}
        </p>
      ) : null}

      {users.error ? (
        <div role="alert" className="flex flex-col gap-3 rounded-panel border border-page-border bg-raised p-5 text-text-primary">
          <p className="m-0 text-sm">
            {READ_ERROR_COPY[(users.error as AdminUsersLoadError).code as keyof typeof READ_ERROR_COPY] ??
              "No pudimos cargar los usuarios."}
          </p>
          <button
            type="button"
            onClick={() => void users.mutate()}
            className={`h-11 w-fit rounded-control border border-control px-4 text-sm font-semibold text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-panel border border-page-border">
          <table className="w-full min-w-[760px] border-collapse text-sm" aria-busy={users.isLoading ? "true" : undefined}>
            <thead>
              <tr className="bg-page-surface">
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Usuario</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Rol</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Estado</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Última actividad</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.isLoading ? (
                <tr>
                  <td colSpan={5} role="status" className="px-4 py-6 text-center text-sm text-text-secondary">
                    Cargando…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-text-secondary">
                    {usersEmptyMessage}
                  </td>
                </tr>
              ) : (
                items.map((user) => {
                  const status = USER_STATUS_COPY[user.status];
                  const StatusIcon = STATUS_ICON[user.status];
                  const kyc = KYC_COPY[user.kycStatus];
                  const activation = userActivationControl(user);
                  const roleTarget = roleChangeTarget(user.role);
                  return (
                    <tr key={user.userId} className="border-t border-page-border">
                      <th scope="row" className="px-4 py-3.5 text-left font-[650]">
                        <div>{user.displayName}</div>
                        <div className="text-xs font-normal text-text-secondary">{user.email}</div>
                        <div className="mt-1.5">
                          <Badge variant={kyc.variant} label={kyc.label} />
                        </div>
                      </th>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-pill bg-brand-accent-tint px-2 py-[3px] text-[11px] font-[650] tracking-[0.05em] text-brand-accent-text">
                            {ROLE_LABEL[user.role]}
                          </span>
                          {roleTarget ? (
                            <button
                              type="button"
                              onClick={() => askRoleChange(user)}
                              aria-label={`Cambiar rol de ${user.displayName}`}
                              className={`rounded text-[12px] font-semibold text-brand-accent-text hover:underline ${FOCUS_RING}`}
                            >
                              {roleChangeLabel(roleTarget)}
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-[5px] text-[13px] font-semibold ${STATUS_TEXT[status.tone]}`}>
                          <StatusIcon aria-hidden="true" focusable="false" className="text-[15px]" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-text-secondary">{formatLastActivityAt(user.lastActivityAt)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {activation.kind === "self" ? (
                            <span className="text-[13px] font-semibold text-text-secondary">{activation.label}</span>
                          ) : activation.kind === "toggle" ? (
                            <button
                              type="button"
                              onClick={() => askSetActive(user, activation.nextActive)}
                              aria-label={`${activation.label} a ${user.displayName}`}
                              className={`h-9 rounded-control border border-control px-3 text-[13px] font-semibold hover:bg-page-surface ${FOCUS_RING} ${
                                activation.nextActive ? "text-brand-accent-text" : "text-trust-critical"
                              }`}
                            >
                              {activation.label}
                            </button>
                          ) : (
                            <span aria-hidden="true" className="text-text-secondary">
                              —
                            </span>
                          )}
                          {/* The help assistant is for PYME/INVERSOR only (#499, D7). */}
                          {user.role === "ADMIN" ? null : (
                            <button
                              type="button"
                              onClick={() => askChatAccess(user)}
                              aria-label={`${chatAccessControlLabel(user.chatEnabled)} a ${user.displayName}`}
                              className={`h-9 rounded-control border border-control px-3 text-[13px] font-semibold hover:bg-page-surface ${FOCUS_RING} ${
                                user.chatEnabled ? "text-brand-accent-text" : "text-text-secondary"
                              }`}
                            >
                              {chatAccessControlLabel(user.chatEnabled)}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!users.error && usersPages > 1 ? (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setQuery((current) => usersQueryWithPage(current, current.page - 1))}
            disabled={query.page <= 1}
            className={`h-11 rounded-control border border-control px-4 text-sm font-semibold text-text-primary hover:bg-page-surface disabled:opacity-50 ${FOCUS_RING}`}
          >
            Anterior
          </button>
          <span className="text-sm text-text-secondary">
            Página {query.page} de {usersPages}
          </span>
          <button
            type="button"
            onClick={() => setQuery((current) => usersQueryWithPage(current, current.page + 1))}
            disabled={query.page >= usersPages}
            className={`h-11 rounded-control border border-control px-4 text-sm font-semibold text-text-primary hover:bg-page-surface disabled:opacity-50 ${FOCUS_RING}`}
          >
            Siguiente
          </button>
        </div>
      ) : null}

      <section className="flex flex-col gap-3 rounded-panel border border-page-border p-5">
        <h2 className="m-0 text-[17px] font-bold">Registro de auditoría</h2>
        <form
          role="search"
          onSubmit={submitAuditSearch}
          className="flex h-11 max-w-[360px] items-center gap-2.5 rounded-control border border-control px-3.5"
        >
          <IoSearchOutline aria-hidden="true" focusable="false" className="shrink-0 text-[17px] text-text-secondary" />
          <input
            type="search"
            value={auditSearchInput}
            onChange={(event) => setAuditSearchInput(event.target.value)}
            placeholder="Buscar en la auditoría"
            aria-label="Buscar en la auditoría"
            className="flex-1 border-0 bg-transparent text-text-primary outline-none"
          />
        </form>

        {audit.error ? (
          <div role="alert" className="flex flex-col gap-3">
            <p className="m-0 text-sm text-text-primary">
              {READ_ERROR_COPY[(audit.error as AdminUsersLoadError).code as keyof typeof READ_ERROR_COPY] ??
                "No pudimos cargar los datos."}
            </p>
            <button
              type="button"
              onClick={() => void audit.mutate()}
              className={`h-10 w-fit rounded-control border border-control px-4 text-sm font-semibold text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
            >
              Reintentar
            </button>
          </div>
        ) : audit.isLoading ? (
          <p role="status" className="m-0 text-sm text-text-secondary">
            Cargando…
          </p>
        ) : auditItems.length === 0 ? (
          <p className="m-0 text-sm text-text-secondary">No hay registros de auditoría.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0 p-0">
            {auditItems.map((entry) => (
              <li key={entry.id} className="flex gap-2.5 border-t border-page-border py-2 text-[13px]">
                <span className="font-mono whitespace-nowrap text-text-secondary">
                  {formatAuditTimestamp(entry.occurredAt)}
                </span>
                <span>{entry.summary}</span>
              </li>
            ))}
          </ul>
        )}

        {!audit.error && auditPages > 1 ? (
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setAuditQuery((current) => auditQueryWithPage(current, current.page - 1))}
              disabled={auditQuery.page <= 1}
              className={`h-10 rounded-control border border-control px-4 text-sm font-semibold text-text-primary hover:bg-page-surface disabled:opacity-50 ${FOCUS_RING}`}
            >
              Anterior
            </button>
            <span className="text-sm text-text-secondary">
              Página {auditQuery.page} de {auditPages}
            </span>
            <button
              type="button"
              onClick={() => setAuditQuery((current) => auditQueryWithPage(current, current.page + 1))}
              disabled={auditQuery.page >= auditPages}
              className={`h-10 rounded-control border border-control px-4 text-sm font-semibold text-text-primary hover:bg-page-surface disabled:opacity-50 ${FOCUS_RING}`}
            >
              Siguiente
            </button>
          </div>
        ) : null}
      </section>

      {confirm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(17,17,17,0.55)] p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-users-confirm-title"
            className="flex w-full max-w-[440px] flex-col gap-3.5 rounded-panel bg-raised p-6 shadow-2xl"
          >
            <h2 id="admin-users-confirm-title" className="m-0 text-xl font-bold">
              {confirm.title}
            </h2>
            <p className="m-0 text-sm leading-normal text-text-secondary">{confirm.body}</p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className={`h-11 rounded-control bg-transparent px-4 font-semibold text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void runConfirm()}
                disabled={confirmPending}
                className={`h-11 rounded-control bg-brand-accent px-4 font-[650] text-on-accent hover:bg-brand-accent-hover disabled:opacity-60 ${FOCUS_RING}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(17,17,17,0.55)] p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-users-invite-title"
            className="flex w-full max-w-[440px] flex-col gap-3.5 rounded-panel bg-raised p-6 shadow-2xl"
          >
            <h2 id="admin-users-invite-title" className="m-0 text-xl font-bold">
              Invitar operador
            </h2>
            <p className="m-0 text-sm leading-normal text-text-secondary">
              Se envía una invitación por correo. La persona define su nombre y contraseña al aceptarla.
            </p>
            {inviteOutcome?.kind === "success" ? (
              <p role="status" className="m-0 text-sm font-medium text-trust-success">
                Invitación enviada a {inviteOutcome.email}.
              </p>
            ) : (
              <form className="flex flex-col gap-3" onSubmit={submitInvite}>
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  Correo
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    className={`h-11 rounded-control border border-control bg-canvas px-3 text-text-primary`}
                  />
                </label>
                {inviteOutcome?.kind === "error" ? (
                  <p role="alert" className="m-0 text-sm font-medium text-trust-critical">
                    {inviteOutcome.message}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setInviteOpen(false)}
                    className={`h-11 rounded-control bg-transparent px-4 font-semibold text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={inviteSending}
                    className={`h-11 rounded-control bg-brand-accent px-4 font-[650] text-on-accent hover:bg-brand-accent-hover disabled:opacity-60 ${FOCUS_RING}`}
                  >
                    Enviar invitación
                  </button>
                </div>
              </form>
            )}
            {inviteOutcome?.kind === "success" ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className={`h-11 rounded-control border border-control px-4 font-semibold text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
                >
                  Cerrar
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
